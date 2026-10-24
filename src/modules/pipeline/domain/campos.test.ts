import { describe, expect, it } from "vitest";

import { MAXIMO_DE_CAMPOS, MAXIMO_DE_OPCOES, TAMANHO_DA_OPCAO } from "./limites";
import {
  apararValores,
  chaveDeCampo,
  FRASE_DO_TETO_DO_NUMERO,
  interpretarValorDoCsv,
  problemasDaDefinicao,
  problemasDosValores,
  ROTULO_DO_TIPO,
  rotuloDoValor,
  type CampoDoPipeline,
  type RascunhoDeCampo,
  type ValoresDeCampos,
} from "./campos";

const PIPELINE = "10000000-0000-4000-8000-0000000000aa";
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const D = "dddddddd-0000-4000-8000-000000000004";
const E = "eeeeeeee-0000-4000-8000-000000000005";
const F = "ffffffff-0000-4000-8000-000000000006";
const DE_OUTRO_PIPELINE = "99999999-0000-4000-8000-000000000009";

function campo(
  parcial: Partial<CampoDoPipeline> & Pick<CampoDoPipeline, "id" | "nome" | "tipo">,
): CampoDoPipeline {
  return {
    pipelineId: PIPELINE,
    opcoes: null,
    obrigatorio: false,
    ordem: 0,
    ativo: true,
    ...parcial,
  };
}

const TEM_SITE = campo({ id: A, nome: "Tem site?", tipo: "sim_nao", obrigatorio: true, ordem: 1 });
const NICHO = campo({
  id: B,
  nome: "Nicho de atuação",
  tipo: "lista",
  opcoes: ["Clínica", "Varejo", "Serviços"],
  ordem: 2,
});
const OBSERVACAO = campo({ id: C, nome: "Observação", tipo: "texto", ordem: 3 });
const QTD = campo({ id: D, nome: "Qtd de lojas", tipo: "numero", ordem: 4 });
const ANTIGO = campo({ id: E, nome: "Antigo", tipo: "texto", ordem: 5, ativo: false });
const CIDADE = campo({ id: F, nome: "Cidade", tipo: "texto", obrigatorio: true, ordem: 6 });

const CAMPOS = [TEM_SITE, NICHO, OBSERVACAO, QTD, ANTIGO, CIDADE];

const chaves = (n: number): ValoresDeCampos =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`x${i + 1}`, i + 1]));
const naoObjeto = (v: unknown) => v as ValoresDeCampos;
const EMOJI = "\u{1F600}";

const SO_ACEITA = "O campo Nicho de atuação só aceita: Clínica, Varejo, Serviços.";

const CASOS: ReadonlyArray<[number, ValoresDeCampos, ValoresDeCampos | undefined, string | null]> =
  [
    [1, {}, {}, null],
    [2, naoObjeto([]), {}, "Campos precisam ser um objeto."],
    [3, naoObjeto("x"), {}, "Campos precisam ser um objeto."],
    [4, naoObjeto(null), {}, "Campos precisam ser um objeto."],
    [5, chaves(31), {}, "No máximo 30 campos."],
    [6, chaves(30), {}, "Campo desconhecido para este pipeline."],
    [7, { x: 1 }, {}, "Campo desconhecido para este pipeline."],
    [8, { [DE_OUTRO_PIPELINE]: true }, {}, "Campo desconhecido para este pipeline."],
    [9, { [A.toUpperCase()]: true }, {}, "Campo desconhecido para este pipeline."],
    [10, { [`{${A}}`]: true }, {}, "Campo desconhecido para este pipeline."],
    [11, { [A]: "sim" }, {}, "O campo Tem site? espera sim ou não."],
    [12, naoObjeto({ [A]: null }), {}, "O campo Tem site? espera sim ou não."],
    [13, { [A]: true }, {}, null],
    [14, { [B]: "Indústria" }, {}, SO_ACEITA],
    [15, { [B]: 7 }, {}, "O campo Nicho de atuação espera uma das opções."],
    [16, { [B]: "" }, {}, SO_ACEITA],
    [17, { [B]: "Varejo" }, {}, null],
    [18, { [C]: "a".repeat(501) }, {}, "O campo Observação aceita até 500 caracteres."],
    [19, { [C]: "a".repeat(500) }, {}, null],
    [20, { [C]: EMOJI.repeat(500) }, {}, null],
    [21, { [C]: EMOJI.repeat(501) }, {}, "O campo Observação aceita até 500 caracteres."],
    [22, { [C]: 12 }, {}, "O campo Observação espera texto."],
    [23, { [D]: "12" }, {}, "O campo Qtd de lojas espera um número."],
    [24, { [D]: 1.5 }, {}, null],
    [25, { [E]: "x" }, {}, "O campo Antigo está desativado."],
    [26, { [E]: "x" }, { [E]: "x" }, null],
    [27, { [E]: "y" }, { [E]: "x" }, "O campo Antigo está desativado."],
    [28, { [E]: "x" }, undefined, "O campo Antigo está desativado."],
    [29, {}, undefined, "O campo Tem site? é obrigatório."],
    [30, { [A]: false }, undefined, "O campo Cidade é obrigatório."],
    [31, { [A]: false, [F]: "" }, undefined, "O campo Cidade é obrigatório."],
    [32, { [A]: false, [F]: "SP" }, undefined, null],
    [33, { [A]: true, [B]: "" }, undefined, SO_ACEITA],
    [34, { [C]: "a" }, {}, null],
    [35, { [A]: true, [D]: "x" }, {}, "O campo Qtd de lojas espera um número."],
    [36, { [D]: "x", x: 1 }, {}, "Campo desconhecido para este pipeline."],
    [37, { [C]: "b", [A]: "sim" }, {}, "O campo Tem site? espera sim ou não."],
    [38, { [C]: 5 }, { [C]: 5 }, null],
    [39, { [A]: true }, { [A]: false }, null],
    [40, { [D]: 1 }, { [D]: 1.0 }, null],
    [41, { [A]: true, [F]: "SP" }, { [A]: true }, null],
    [42, { [A]: true, [F]: "SP", [E]: "x" }, undefined, "O campo Antigo está desativado."],
    [43, { [A]: true, [F]: "SP" }, undefined, null],
    [44, { [A]: true, [F]: "SP", [B]: "Clínica", [D]: 3, [C]: "ok" }, undefined, null],
    [45, { [A]: true, [F]: "SP", [C]: "" }, undefined, null],
    [46, { [A]: 1 }, {}, "O campo Tem site? espera sim ou não."],
    [47, { [B]: "varejo" }, {}, SO_ACEITA],
    [48, { [B]: "Varejo" }, { [B]: "Varejo " }, null],
    [49, { [D]: 1e10 }, {}, "O campo Qtd de lojas espera um número."],
    [50, { [D]: 9999999999 }, {}, null],
    [51, { [D]: -1e10 }, {}, "O campo Qtd de lojas espera um número."],
    [52, { [D]: 9999999999.99 }, {}, null],
    [53, { [D]: Number("9".repeat(100_000)) }, {}, "O campo Qtd de lojas espera um número."],
    [54, { [D]: 1e10 }, { [D]: 1e10 }, null],
  ];

describe("problemasDosValores espelha private.problemas_dos_campos — 54 casos, frase a frase", () => {
  for (const [caso, valores, antes, frase] of CASOS) {
    it(`caso ${caso} → ${frase ?? "<null>"}`, () => {
      expect(problemasDosValores(CAMPOS, valores, antes)).toBe(frase);
    });
  }

  it("`null` em antes é INSERT, igual a omitir (o gatilho passa `case when tg_op = 'INSERT' then null`)", () => {
    expect(problemasDosValores(CAMPOS, {}, null)).toBe("O campo Tem site? é obrigatório.");
  });

  it("chave com `undefined` não existe no JSON que viaja: nem conta no teto, nem é julgada", () => {
    const trintaMaisUndefined = { ...chaves(30), [A]: undefined } as unknown as ValoresDeCampos;
    expect(problemasDosValores(CAMPOS, trintaMaisUndefined, {})).toBe(
      "Campo desconhecido para este pipeline.",
    );
    const soUndefined = { [A]: undefined } as unknown as ValoresDeCampos;
    expect(problemasDosValores(CAMPOS, soUndefined, undefined)).toBe(
      "O campo Tem site? é obrigatório.",
    );
  });

  it("NaN e Infinity não são número em JSON (viram null) — a frase é a de número", () => {
    expect(problemasDosValores(CAMPOS, { [D]: Number.NaN }, {})).toBe(
      "O campo Qtd de lojas espera um número.",
    );
    expect(problemasDosValores(CAMPOS, { [D]: Number.POSITIVE_INFINITY }, {})).toBe(
      "O campo Qtd de lojas espera um número.",
    );
  });
});

describe("interpretarValorDoCsv", () => {
  it("célula vazia (ou só espaço) é chave ausente em todo tipo — nunca grava null", () => {
    for (const c of [TEM_SITE, NICHO, OBSERVACAO, QTD]) {
      expect(interpretarValorDoCsv(c, "")).toEqual({ valor: undefined });
      expect(interpretarValorDoCsv(c, "   ")).toEqual({ valor: undefined });
    }
  });

  it("sim_nao aceita a lista da spec sem caixa nem acento", () => {
    for (const t of ["sim", "S", "TRUE", "1", "x", "Yes", "Verdadeiro", " sim "]) {
      expect(interpretarValorDoCsv(TEM_SITE, t)).toEqual({ valor: true });
    }
    for (const t of ["não", "NÃO", "nao", "n", "false", "0", "No", "Falso"]) {
      expect(interpretarValorDoCsv(TEM_SITE, t)).toEqual({ valor: false });
    }
    expect(interpretarValorDoCsv(TEM_SITE, "talvez")).toEqual({ erro: "'talvez' não é sim/não" });
  });

  it("numero usa o parser de valor_estimado: vírgula decimal, milhar, e recusa o que não é número", () => {
    expect(interpretarValorDoCsv(QTD, "12")).toEqual({ valor: 12 });
    expect(interpretarValorDoCsv(QTD, "1,5")).toEqual({ valor: 1.5 });
    expect(interpretarValorDoCsv(QTD, "1.250")).toEqual({ valor: 1250 });
    expect(interpretarValorDoCsv(QTD, "abc")).toEqual({ erro: "'abc' não é um número" });
    expect(interpretarValorDoCsv(QTD, "R$ 10")).toEqual({ erro: "'R$ 10' não é um número" });
  });

  it("numero recusa na leitura do arquivo o que o banco recusaria pelo teto (|n| >= 1e10)", () => {
    expect(FRASE_DO_TETO_DO_NUMERO).toBe("precisa ser menor que 10.000.000.000");
    expect(interpretarValorDoCsv(QTD, "9999999999")).toEqual({ valor: 9999999999 });
    expect(interpretarValorDoCsv(QTD, "9.999.999.999,99")).toEqual({ valor: 9999999999.99 });
    for (const texto of ["10000000000", "10.000.000.000", "10.000.000.000,00"]) {
      expect(interpretarValorDoCsv(QTD, texto)).toEqual({
        erro: `'${texto}' ${FRASE_DO_TETO_DO_NUMERO}`,
      });
    }
    for (const texto of ["-10000000000", "1e10", "100000000000000"]) {
      expect(interpretarValorDoCsv(QTD, texto)).toEqual({ erro: `'${texto}' não é um número` });
    }
  });

  it("numero aceito na leitura passa no espelho do banco; recusado pelo teto, o banco também recusaria", () => {
    expect(interpretarValorDoCsv(QTD, "9.999.999.999,99")).toEqual({ valor: 9999999999.99 });
    expect(problemasDosValores([QTD], { [QTD.id]: 9999999999.99 })).toBeNull();
    expect(problemasDosValores([QTD], { [QTD.id]: 10000000000 })).toBe(
      "O campo Qtd de lojas espera um número.",
    );
  });

  it("lista casa sem caixa/acento e grava a opção CANÔNICA", () => {
    expect(interpretarValorDoCsv(NICHO, "clinica")).toEqual({ valor: "Clínica" });
    expect(interpretarValorDoCsv(NICHO, " SERVIÇOS ")).toEqual({ valor: "Serviços" });
    expect(interpretarValorDoCsv(NICHO, "Indústria")).toEqual({
      erro: "'Indústria' não está entre as opções: Clínica, Varejo, Serviços",
    });
  });

  it("texto apara e recusa acima de 500 caracteres (contando code points, como o banco)", () => {
    expect(interpretarValorDoCsv(OBSERVACAO, "  oi  ")).toEqual({ valor: "oi" });
    expect(interpretarValorDoCsv(OBSERVACAO, "a".repeat(500))).toEqual({ valor: "a".repeat(500) });
    expect(interpretarValorDoCsv(OBSERVACAO, EMOJI.repeat(500))).toEqual({
      valor: EMOJI.repeat(500),
    });
    expect(interpretarValorDoCsv(OBSERVACAO, "a".repeat(501))).toEqual({
      erro: "texto com mais de 500 caracteres",
    });
  });

  it("o que interpretarValorDoCsv aceita, problemasDosValores aceita — as duas pontas concordam", () => {
    const valores: Record<string, string | number | boolean> = {};
    for (const [c, t] of [
      [TEM_SITE, "sim"],
      [NICHO, "varejo"],
      [OBSERVACAO, "ok"],
      [QTD, "3"],
      [CIDADE, "SP"],
    ] as const) {
      const { valor } = interpretarValorDoCsv(c, t);
      if (valor !== undefined) valores[c.id] = valor;
    }
    expect(problemasDosValores(CAMPOS, valores, undefined)).toBeNull();
  });
});

describe("apararValores — o objeto que viaja ao banco", () => {
  it("apara texto, remove a chave que ficou vazia, e não toca boolean nem number", () => {
    expect(apararValores({ [C]: "  SP ", [F]: "   ", [A]: true, [D]: 3 })).toEqual({
      [C]: "SP",
      [A]: true,
      [D]: 3,
    });
  });

  it("🔴 obrigatório preenchido só com espaços é 'obrigatório' para problemasDosValores — o mesmo objeto que vai ao banco", () => {
    expect(problemasDosValores(CAMPOS, apararValores({ [A]: true, [F]: "   " }))).toBe(
      "O campo Cidade é obrigatório.",
    );
    expect(problemasDosValores(CAMPOS, apararValores({ [A]: true, [F]: " SP " }))).toBeNull();
  });
});

describe("rotuloDoValor e ROTULO_DO_TIPO", () => {
  it("sim/não, número em pt-BR, texto e lista crus, ausente vira vazio", () => {
    expect(rotuloDoValor(TEM_SITE, true)).toBe("Sim");
    expect(rotuloDoValor(TEM_SITE, false)).toBe("Não");
    expect(rotuloDoValor(QTD, 1234.5)).toBe("1.234,5");
    expect(rotuloDoValor(QTD, 3)).toBe("3");
    expect(rotuloDoValor(OBSERVACAO, "ok")).toBe("ok");
    expect(rotuloDoValor(NICHO, "Clínica")).toBe("Clínica");
    expect(rotuloDoValor(QTD, undefined)).toBe("");
  });

  it("valor gravado com tipo que não bate mais com o campo (tipo editado depois) vira texto, nunca [object]", () => {
    expect(rotuloDoValor(OBSERVACAO, true)).toBe("true");
    expect(rotuloDoValor(TEM_SITE, "sim")).toBe("sim");
  });

  it("os quatro rótulos de tipo", () => {
    expect(ROTULO_DO_TIPO).toEqual({
      texto: "Texto",
      sim_nao: "Sim/não",
      lista: "Lista",
      numero: "Número",
    });
  });
});

describe("problemasDaDefinicao", () => {
  const texto = (nome: string, extra: Partial<RascunhoDeCampo> = {}): RascunhoDeCampo => ({
    nome,
    tipo: "texto",
    opcoes: null,
    obrigatorio: false,
    ordem: 0,
    ativo: true,
    ...extra,
  });
  const lista = (nome: string, opcoes: readonly string[] | null): RascunhoDeCampo =>
    texto(nome, { tipo: "lista", opcoes });

  it("rascunho válido (os quatro tipos, lista com opções, vazio) → null", () => {
    expect(problemasDaDefinicao([])).toBeNull();
    expect(
      problemasDaDefinicao([
        texto("Observação"),
        texto("Tem site?", { tipo: "sim_nao", obrigatorio: true }),
        texto("Qtd de lojas", { tipo: "numero" }),
        lista("Nicho de atuação", ["Clínica", "Varejo", "Serviços"]),
      ]),
    ).toBeNull();
  });

  it("🔴 nome vazio (ou só espaço) → 'Todo campo precisa de nome.'", () => {
    expect(problemasDaDefinicao([texto("Tem site?"), texto("  ")])).toBe(
      "Todo campo precisa de nome.",
    );
  });

  it("🔴 nome repetido sem caixa, acento nem espaço nas pontas → 'Nome de campo repetido: X.'", () => {
    expect(problemasDaDefinicao([texto("Endereço"), texto(" endereco ")])).toBe(
      "Nome de campo repetido: endereco.",
    );
    expect(problemasDaDefinicao([texto("Endereço"), texto("Endereço 2")])).toBeNull();
  });

  it("🔴 lista sem opções (null ou []) → 'A lista X precisa de pelo menos uma opção.'", () => {
    expect(problemasDaDefinicao([lista("Nicho", null)])).toBe(
      "A lista Nicho precisa de pelo menos uma opção.",
    );
    expect(problemasDaDefinicao([lista("Nicho", [])])).toBe(
      "A lista Nicho precisa de pelo menos uma opção.",
    );
  });

  it("🔴 opção repetida (sem caixa/acento) ou vazia → 'A lista X tem opção repetida ou vazia.'", () => {
    expect(problemasDaDefinicao([lista("Nicho", ["Clínica", "clinica"])])).toBe(
      "A lista Nicho tem opção repetida ou vazia.",
    );
    expect(problemasDaDefinicao([lista("Nicho", ["Varejo", " "])])).toBe(
      "A lista Nicho tem opção repetida ou vazia.",
    );
  });

  it("🔴 opção com mais de 60 caracteres → 'Cada opção aceita até 60 caracteres.'; 60 passa (a MESMA frase do gatilho)", () => {
    expect(problemasDaDefinicao([lista("Nicho", ["ok", "x".repeat(TAMANHO_DA_OPCAO + 1)])])).toBe(
      `Cada opção aceita até ${TAMANHO_DA_OPCAO} caracteres.`,
    );
    expect(problemasDaDefinicao([lista("Nicho", ["ok", "x".repeat(TAMANHO_DA_OPCAO)])])).toBeNull();
  });

  it("🔴 dois nomes que só diferem em pontuação/espaço colidem na chave da importação → 'Nome de campo repetido: X.'", () => {
    expect(chaveDeCampo("Tem site?")).toBe(chaveDeCampo("tem-site"));
    expect(problemasDaDefinicao([texto("Tem site?"), texto("Tem site")])).toBe(
      "Nome de campo repetido: Tem site.",
    );
    expect(problemasDaDefinicao([texto("Tem site?"), texto("Tem site 2")])).toBeNull();
  });

  it("🔴 mais de 30 opções → 'A lista X aceita até 30 opções.'; exatamente 30 passa", () => {
    const opcoes = (n: number) => Array.from({ length: n }, (_, i) => `Opção ${i + 1}`);
    expect(problemasDaDefinicao([lista("Nicho", opcoes(MAXIMO_DE_OPCOES + 1))])).toBe(
      `A lista Nicho aceita até ${MAXIMO_DE_OPCOES} opções.`,
    );
    expect(problemasDaDefinicao([lista("Nicho", opcoes(MAXIMO_DE_OPCOES))])).toBeNull();
  });

  it("🔴 mais de 30 campos → 'Máximo de 30 campos por pipeline.' — antes de qualquer outra frase; 30 passa", () => {
    const campos = (n: number) => Array.from({ length: n }, (_, i) => texto(`Campo ${i + 1}`));
    expect(problemasDaDefinicao([texto(""), ...campos(MAXIMO_DE_CAMPOS)])).toBe(
      `Máximo de ${MAXIMO_DE_CAMPOS} campos por pipeline.`,
    );
    expect(problemasDaDefinicao(campos(MAXIMO_DE_CAMPOS))).toBeNull();
  });

  it("a primeira frase é a da primeira linha que falha, na ordem do rascunho", () => {
    expect(problemasDaDefinicao([lista("Nicho", []), texto("")])).toBe(
      "A lista Nicho precisa de pelo menos uma opção.",
    );
  });
});
