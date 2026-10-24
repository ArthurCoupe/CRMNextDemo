import { describe, expect, it } from "vitest";
import type { CampoDoPipeline } from "./campos";
import { CsvInvalido, lerCsv } from "./csv";
import {
  decodificarCsv,
  LIMITE_DE_LINHAS,
  mapearCabecalho,
  mapearLinha,
  MODELO_CSV,
  prepararImportacao,
} from "./importacao";

const CAB = [
  "Nome",
  "Telefone",
  "E-mail",
  "Canal",
  "BU",
  "Valor estimado",
  "Frentes",
  "Coluna Estranha",
];

describe("mapearCabecalho", () => {
  it("reconhece por nome normalizado e lista as ignoradas", () => {
    const m = mapearCabecalho(CAB);
    expect(m.indices.nome).toBe(0);
    expect(m.indices.email).toBe(2);
    expect(m.indices.valor_estimado).toBe(5);
    expect(m.ignoradas).toEqual(["Coluna Estranha"]);
  });
  it("🔴 sem coluna nome, recusa o arquivo", () => {
    expect(() => mapearCabecalho(["telefone"])).toThrow("nome");
  });
  it("🔴 alias linha_de_negocio -> bu não fica morto atrás da lista de chaves reconhecidas", () => {
    const m = mapearCabecalho(["Nome", "Linha de Negócio"]);
    expect(m.indices.bu).toBe(1);
    const l = mapearLinha(["Padaria", "Sistemas"], 2, m);
    expect(l.dados.bu).toBe("sistemas");
  });
  it("aliases valor -> valor_estimado, obs -> observacoes e E-Mail -> email continuam funcionando", () => {
    const m = mapearCabecalho(["Nome", "Valor", "Obs", "E-Mail"]);
    expect(m.indices.valor_estimado).toBe(1);
    expect(m.indices.observacoes).toBe(2);
    expect(m.indices.email).toBe(3);
  });
  it("🔴 coluna repetida no cabeçalho (mesma chave reconhecida) recusa o arquivo", () => {
    expect(() => mapearCabecalho(["Nome", "Valor", "Valor Estimado"])).toThrow(CsvInvalido);
    expect(() => mapearCabecalho(["Nome", "Nome"])).toThrow("Coluna repetida");
  });
});

describe("mapearLinha", () => {
  const m = mapearCabecalho(CAB);
  it("normaliza telefone, e-mail, canal, bu, valor e frentes", () => {
    const l = mapearLinha(
      [
        "Ana Silva",
        "(11) 99999-0000",
        "ANA@X.com",
        "Indicação",
        "Demanda",
        "1.500,50",
        "trafego|comercial",
        "x",
      ],
      2,
      m,
    );
    expect(l.erros).toEqual([]);
    expect(l.dados).toMatchObject({
      nome: "Ana Silva",
      telefone: "(11) 99999-0000",
      telefone_normalizado: "11999990000",
      email: "ana@x.com",
      canal: "indicacao",
      bu: "demanda",
      valor_estimado: 1500.5,
      frentes: ["trafego", "comercial"],
    });
  });
  it("🔴 nome vazio, canal desconhecido, e-mail sem @ e valor ilegível viram erros — e a linha válida acima é o controle", () => {
    const l = mapearLinha(["", "12", "sem-arroba", "telegrama", "", "abc", "", ""], 3, m);
    expect(l.erros).toEqual(
      expect.arrayContaining([
        expect.stringContaining("nome"),
        expect.stringContaining("canal"),
        expect.stringContaining("e-mail"),
        expect.stringContaining("valor"),
      ]),
    );
    expect(l.dados.telefone_normalizado).toBeNull();
  });
  it("valor estimado no teto de numeric(12,2): 9999999999 passa, 99999999999 é erro da linha", () => {
    const ok = mapearLinha(["Ana", "", "", "", "", "9999999999", "", ""], 2, m);
    expect(ok.erros).toEqual([]);
    expect(ok.dados.valor_estimado).toBe(9999999999);
    const estourado = mapearLinha(["Ana", "", "", "", "", "99999999999", "", ""], 3, m);
    expect(estourado.erros).toEqual(['valor estimado acima do limite: "99999999999"']);
    expect(estourado.dados.valor_estimado).toBeNull();
  });
  it("valor negativo é ilegível para o parser (o teto simétrico da RPC nunca é alcançado daqui)", () => {
    const negativo = mapearLinha(["Ana", "", "", "", "", "-99999999999", "", ""], 4, m);
    expect(negativo.erros).toEqual(['valor estimado ilegível: "-99999999999"']);
    expect(negativo.dados.valor_estimado).toBeNull();
  });
  it("frentes com valor desconhecido vira erro nomeando o campo", () => {
    const l = mapearLinha(["Ana", "", "", "", "", "", "trafego|voo", ""], 2, m);
    expect(l.erros).toEqual(expect.arrayContaining([expect.stringContaining("frentes")]));
  });
});

describe("prepararImportacao", () => {
  it("duplicata dentro do arquivo (mesmo telefone ou e-mail) vira erro na segunda", () => {
    const csv = lerCsv(
      "nome;telefone;email\nA;11999990000;\nB;(11)99999-0000;\nC;;c@x.com\nD;;C@X.COM\n",
    );
    const { linhas } = prepararImportacao(csv);
    expect(linhas.map((l) => l.erros.length)).toEqual([0, 1, 0, 1]);
    expect(linhas[1].erros[0]).toContain("linha 2");
  });
  it("acima do limite recusa com a contagem", () => {
    const corpo = Array.from({ length: LIMITE_DE_LINHAS + 1 }, (_, i) => `L${i}`).join("\n");
    expect(() => prepararImportacao(lerCsv(`nome\n${corpo}\n`))).toThrow("1001");
  });
  it("MODELO_CSV é válido de ponta a ponta (lerCsv + prepararImportacao)", () => {
    const csv = lerCsv(MODELO_CSV);
    expect(csv.cabecalho).toHaveLength(14);
    const { mapa, linhas } = prepararImportacao(csv);
    expect(mapa.ignoradas).toEqual([]);
    expect(Object.keys(mapa.indices)).toHaveLength(14);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].erros).toEqual([]);
    expect(linhas[0].dados.bu).toBe("demanda");
  });
});

describe("decodificarCsv", () => {
  it("UTF-8 com BOM e Windows-1252 dão o mesmo texto", () => {
    const utf8 = new TextEncoder().encode("\uFEFFnome\nJúlio");
    expect(decodificarCsv(utf8.buffer)).toBe("\uFEFFnome\nJúlio");
    const cp1252 = new Uint8Array([0x6e, 0x6f, 0x6d, 0x65, 0x0a, 0x4a, 0xfa, 0x6c, 0x69, 0x6f]);
    expect(decodificarCsv(cp1252.buffer)).toBe("nome\nJúlio");
  });
  it("bytes UTF-8 inválidos caem para windows-1252 em vez de lançar", () => {
    const invalido = new Uint8Array([0x6e, 0x6f, 0x6d, 0x65, 0xff, 0xfe]);
    expect(() => decodificarCsv(invalido.buffer)).not.toThrow();
  });
});

const SITES = "67200000-0000-4000-8000-000000000001";
function campo(
  sobrescreve: Partial<CampoDoPipeline> & Pick<CampoDoPipeline, "id" | "nome" | "tipo">,
): CampoDoPipeline {
  return {
    pipelineId: SITES,
    opcoes: null,
    obrigatorio: false,
    ordem: 1,
    ativo: true,
    ...sobrescreve,
  };
}
const TEM_SITE = campo({
  id: "c7000000-0000-4000-8000-000000000001",
  nome: "Tem site?",
  tipo: "sim_nao",
});
const NICHO = campo({
  id: "c7000000-0000-4000-8000-000000000002",
  nome: "Nicho de atuação",
  tipo: "lista",
  opcoes: ["Clínica", "Varejo", "Serviços"],
  ordem: 2,
});
const CAMPOS = [TEM_SITE, NICHO];
const CAB_COM_CAMPOS = ["nome", "telefone", "tem site", "nicho de atuação", "cor favorita"];

describe("mapearCabecalho com campos do pipeline (terceiro balde)", () => {
  it("casa coluna com campo pelo nome normalizado (sem caixa, acento nem pontuação): 2 personalizadas, 1 ignorada", () => {
    const m = mapearCabecalho(CAB_COM_CAMPOS, CAMPOS);
    expect(Object.keys(m.indices)).toEqual(["nome", "telefone"]);
    expect(m.personalizadas).toEqual([
      { coluna: "tem site", indice: 2, campo: TEM_SITE },
      { coluna: "nicho de atuação", indice: 3, campo: NICHO },
    ]);
    expect(m.ignoradas).toEqual(["cor favorita"]);
  });
  it("sem campos (chamadores antigos), as colunas caem em ignoradas e personalizadas fica vazia", () => {
    const m = mapearCabecalho(CAB_COM_CAMPOS);
    expect(m.personalizadas).toEqual([]);
    expect(m.ignoradas).toEqual(["tem site", "nicho de atuação", "cor favorita"]);
  });
  it("🔴 coluna nativa vence campo homônimo: um campo 'Telefone' nunca é casado", () => {
    const telefone = campo({
      id: "c7000000-0000-4000-8000-000000000003",
      nome: "Telefone",
      tipo: "texto",
    });
    const m = mapearCabecalho(["nome", "telefone"], [telefone]);
    expect(m.indices.telefone).toBe(1);
    expect(m.personalizadas).toEqual([]);
  });
  it("campo inativo não é casado: a coluna vai para ignoradas", () => {
    const m = mapearCabecalho(["nome", "tem site"], [{ ...TEM_SITE, ativo: false }]);
    expect(m.personalizadas).toEqual([]);
    expect(m.ignoradas).toEqual(["tem site"]);
  });
  it("🔴 duas colunas para o mesmo campo recusam o arquivo, como a coluna nativa repetida", () => {
    expect(() => mapearCabecalho(["nome", "tem site", "Tem Site?"], CAMPOS)).toThrow(
      "Coluna repetida",
    );
  });
  it("🔴 cabeçalho vazio (`;;` do Excel) não casa campo nenhum nem vira 'Coluna repetida' — mesmo com um campo cujo nome é só pontuação", () => {
    const soPontuacao = campo({
      id: "c7000000-0000-4000-8000-000000000004",
      nome: "?",
      tipo: "texto",
    });
    const m = mapearCabecalho(["nome", "", "", "  ", "!!"], [...CAMPOS, soPontuacao]);
    expect(m.personalizadas).toEqual([]);
    expect(m.ignoradas).toEqual(["!!"]);
  });
});

describe("mapearLinha com campos", () => {
  const m = mapearCabecalho(CAB_COM_CAMPOS, CAMPOS);
  it("converte por tipo e grava pela chave = id do campo; a lista grava a opção canônica", () => {
    const l = mapearLinha(["Clínica Sul", "11977770002", "Sim", "clinica", "azul"], 2, m);
    expect(l.erros).toEqual([]);
    expect(l.campos).toEqual({ [TEM_SITE.id]: true, [NICHO.id]: "Clínica" });
  });
  it("🔴 valor inválido é erro DA LINHA, nomeando a coluna: 'talvez' em sim/não", () => {
    const l = mapearLinha(["Loja Norte", "", "talvez", "", ""], 3, m);
    expect(l.erros).toEqual(["coluna tem site: 'talvez' não é sim/não"]);
    expect(l.campos).toEqual({});
  });
  it("célula vazia não grava chave (nunca null)", () => {
    const l = mapearLinha(["Sem campos", "", "", "  ", ""], 4, m);
    expect(l.erros).toEqual([]);
    expect(l.campos).toEqual({});
    expect(TEM_SITE.id in l.campos).toBe(false);
  });
  it("prepararImportacao repassa os campos e o mapa com as três listas", () => {
    const csv = lerCsv("nome;tem site;cor favorita\nA;não;verde\nB;;\n");
    const { mapa, linhas } = prepararImportacao(csv, CAMPOS);
    expect(mapa.personalizadas.map((p) => p.campo.nome)).toEqual(["Tem site?"]);
    expect(mapa.ignoradas).toEqual(["cor favorita"]);
    expect(linhas.map((l) => l.campos)).toEqual([{ [TEM_SITE.id]: false }, {}]);
  });
});
