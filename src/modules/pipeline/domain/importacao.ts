import { interpretarValorEmReais } from "@/modules/financial/domain/expenses";
import {
  chaveDeCampo,
  interpretarValorDoCsv,
  normalizarCabecalho,
  semCaixaNemAcento as normalizarChave,
  type CampoDoPipeline,
  type ValoresDeCampos,
} from "./campos";
import { CsvInvalido, type CsvLido } from "./csv";

export { normalizarCabecalho };

export const LIMITE_DE_LINHAS = 1000;

export const COLUNAS_RECONHECIDAS = [
  "nome",
  "contato",
  "telefone",
  "email",
  "segmento",
  "nicho",
  "canal",
  "bu",
  "responsavel",
  "valor_estimado",
  "origem",
  "indicado_por",
  "observacoes",
  "frentes",
] as const;

const ALIAS: Readonly<Record<string, (typeof COLUNAS_RECONHECIDAS)[number]>> = {
  linha_de_negocio: "bu",
  valor: "valor_estimado",
  obs: "observacoes",
};

export interface LinhaDeImportacao {
  readonly numero: number;
  readonly dados: DadosDaLinha;
  readonly campos: ValoresDeCampos;
  readonly erros: readonly string[];
}

export interface DadosDaLinha {
  readonly nome: string;
  readonly contato: string | null;
  readonly telefone: string | null;
  readonly telefone_normalizado: string | null;
  readonly email: string | null;
  readonly segmento: string | null;
  readonly nicho: string | null;
  readonly canal: "indicacao" | "pago" | "inbound" | "outbound" | null;
  readonly bu: "demanda" | "sistemas" | null;
  readonly responsavel: string | null;
  readonly valor_estimado: number | null;
  readonly origem: string | null;
  readonly indicado_por: string | null;
  readonly observacoes: string | null;
  readonly frentes: readonly ("posicionamento" | "trafego" | "comercial" | "sistemas")[] | null;
}

export interface Mapeamento {
  readonly indices: Readonly<Partial<Record<(typeof COLUNAS_RECONHECIDAS)[number], number>>>;
  readonly personalizadas: readonly { coluna: string; indice: number; campo: CampoDoPipeline }[];
  readonly ignoradas: readonly string[];
}

export function mapearCabecalho(
  cabecalho: readonly string[],
  campos: readonly CampoDoPipeline[] = [],
): Mapeamento {
  const indices: Partial<Record<(typeof COLUNAS_RECONHECIDAS)[number], number>> = {};
  const personalizadas: { coluna: string; indice: number; campo: CampoDoPipeline }[] = [];
  const ignoradas: string[] = [];
  const reconhecidas = new Set<string>(COLUNAS_RECONHECIDAS);
  const ativos = campos.filter((campo) => campo.ativo);
  cabecalho.forEach((original, indice) => {
    const normalizado = normalizarCabecalho(original);
    const chave =
      ALIAS[normalizado] ??
      (reconhecidas.has(normalizado)
        ? (normalizado as (typeof COLUNAS_RECONHECIDAS)[number])
        : undefined);
    if (chave === undefined) {
      const chaveDaColuna = chaveDeCampo(original);
      if (chaveDaColuna === "") {
        if (original.trim() !== "") ignoradas.push(original);
        return;
      }
      const campo = ativos.find((c) => chaveDeCampo(c.nome) === chaveDaColuna);
      if (campo === undefined) {
        ignoradas.push(original);
        return;
      }
      if (personalizadas.some((p) => p.campo.id === campo.id)) {
        throw new CsvInvalido(`Coluna repetida no cabeçalho: ${campo.nome}`);
      }
      personalizadas.push({ coluna: original, indice, campo });
      return;
    }
    if (indices[chave] !== undefined) {
      throw new CsvInvalido(`Coluna repetida no cabeçalho: ${chave}`);
    }
    indices[chave] = indice;
  });
  if (indices.nome === undefined) throw new CsvInvalido("O arquivo não tem uma coluna de nome.");
  return { indices, personalizadas, ignoradas };
}

function normalizarTelefone(texto: string | null): string | null {
  const digitos = (texto ?? "").replace(/\D/g, "");
  return digitos.length >= 8 ? digitos : null;
}

const CANAIS: Readonly<Record<string, DadosDaLinha["canal"]>> = {
  indicacao: "indicacao",
  pago: "pago",
  inbound: "inbound",
  outbound: "outbound",
};

const BUS: Readonly<Record<string, DadosDaLinha["bu"]>> = {
  demanda: "demanda",
  sistemas: "sistemas",
};

const FRENTES: Readonly<Record<string, NonNullable<DadosDaLinha["frentes"]>[number]>> = {
  posicionamento: "posicionamento",
  trafego: "trafego",
  comercial: "comercial",
  sistemas: "sistemas",
};

const TETO_DO_VALOR_ESTIMADO = 1e10;

export function mapearLinha(
  celulas: readonly string[],
  numero: number,
  mapa: Mapeamento,
): LinhaDeImportacao {
  const erros: string[] = [];
  const bruto = (chave: (typeof COLUNAS_RECONHECIDAS)[number]): string => {
    const indice = mapa.indices[chave];
    return indice === undefined ? "" : (celulas[indice] ?? "").trim();
  };
  const ouNull = (chave: (typeof COLUNAS_RECONHECIDAS)[number]): string | null => {
    const valor = bruto(chave);
    return valor === "" ? null : valor;
  };

  const nome = bruto("nome");
  if (nome === "") erros.push("nome é obrigatório");

  const telefone = ouNull("telefone");
  const telefone_normalizado = normalizarTelefone(telefone);

  const emailBruto = bruto("email");
  let email: string | null = null;
  if (emailBruto !== "") {
    const arroba = emailBruto.indexOf("@");
    if (arroba <= 0 || arroba === emailBruto.length - 1) {
      erros.push(`e-mail inválido: "${emailBruto}"`);
    } else {
      email = emailBruto.toLowerCase();
    }
  }

  const canalBruto = bruto("canal");
  let canal: DadosDaLinha["canal"] = null;
  if (canalBruto !== "") {
    const resolvido = CANAIS[normalizarChave(canalBruto)];
    if (resolvido === undefined) erros.push(`canal desconhecido: "${canalBruto}"`);
    else canal = resolvido;
  }

  const buBruto = bruto("bu");
  let bu: DadosDaLinha["bu"] = null;
  if (buBruto !== "") {
    const resolvido = BUS[normalizarChave(buBruto)];
    if (resolvido === undefined) erros.push(`bu desconhecida: "${buBruto}"`);
    else bu = resolvido;
  }

  const valorBruto = bruto("valor_estimado");
  let valor_estimado: number | null = null;
  if (valorBruto !== "") {
    const interpretado = interpretarValorEmReais(valorBruto);
    if (interpretado === null) erros.push(`valor estimado ilegível: "${valorBruto}"`);
    else if (Math.abs(interpretado) >= TETO_DO_VALOR_ESTIMADO)
      erros.push(`valor estimado acima do limite: "${valorBruto}"`);
    else valor_estimado = interpretado;
  }

  const frentesBruto = bruto("frentes");
  let frentes: DadosDaLinha["frentes"] = null;
  if (frentesBruto !== "") {
    const partes = frentesBruto.split("|").map((parte) => parte.trim());
    const resolvidas: NonNullable<DadosDaLinha["frentes"]>[number][] = [];
    for (const parte of partes) {
      const resolvida = FRENTES[normalizarChave(parte)];
      if (resolvida === undefined) {
        erros.push(`frentes com valor desconhecido: "${parte}"`);
      } else {
        resolvidas.push(resolvida);
      }
    }
    if (resolvidas.length > 0) frentes = resolvidas;
  }

  const campos: Record<string, ValoresDeCampos[string]> = {};
  for (const { coluna, indice, campo } of mapa.personalizadas) {
    const { valor, erro } = interpretarValorDoCsv(campo, celulas[indice] ?? "");
    if (erro !== undefined) erros.push(`coluna ${coluna}: ${erro}`);
    else if (valor !== undefined) campos[campo.id] = valor;
  }

  const dados: DadosDaLinha = {
    nome,
    contato: ouNull("contato"),
    telefone,
    telefone_normalizado,
    email,
    segmento: ouNull("segmento"),
    nicho: ouNull("nicho"),
    canal,
    bu,
    responsavel: ouNull("responsavel"),
    valor_estimado,
    origem: ouNull("origem"),
    indicado_por: ouNull("indicado_por"),
    observacoes: ouNull("observacoes"),
    frentes,
  };

  return { numero, dados, campos, erros };
}

export function prepararImportacao(
  csv: CsvLido,
  campos: readonly CampoDoPipeline[] = [],
): {
  mapa: Mapeamento;
  linhas: readonly LinhaDeImportacao[];
} {
  if (csv.linhas.length > LIMITE_DE_LINHAS) {
    throw new CsvInvalido(
      `O arquivo tem ${csv.linhas.length} linhas de dados; o limite é ${LIMITE_DE_LINHAS}.`,
    );
  }
  const mapa = mapearCabecalho(csv.cabecalho, campos);
  const vistoPorTelefone = new Map<string, number>();
  const vistoPorEmail = new Map<string, number>();
  const linhas = csv.linhas.map((celulas, indice) => {
    const linha = mapearLinha(celulas, indice + 2, mapa);
    if (linha.erros.length > 0) return linha;

    const origemTelefone = linha.dados.telefone_normalizado
      ? vistoPorTelefone.get(linha.dados.telefone_normalizado)
      : undefined;
    const origemEmail = linha.dados.email ? vistoPorEmail.get(linha.dados.email) : undefined;
    const origem = origemTelefone ?? origemEmail;
    if (origem !== undefined) {
      return {
        ...linha,
        erros: [
          ...linha.erros,
          `duplicada dentro do arquivo (mesmo telefone/e-mail da linha ${origem})`,
        ],
      };
    }

    if (linha.dados.telefone_normalizado)
      vistoPorTelefone.set(linha.dados.telefone_normalizado, linha.numero);
    if (linha.dados.email) vistoPorEmail.set(linha.dados.email, linha.numero);
    return linha;
  });
  return { mapa, linhas };
}

export function decodificarCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export const MODELO_CSV =
  "nome;contato;telefone;email;segmento;nicho;canal;bu;responsavel;valor_estimado;origem;indicado_por;observacoes;frentes\n" +
  "Padaria do Júlio;Júlio;(11) 99999-0000;julio@padaria.com;Alimentação;Padaria;indicacao;demanda;;1500,00;lista-feira-2026;;Indicado por um cliente da carteira;trafego|comercial\n";
