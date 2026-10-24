import { interpretarValorEmReais } from "@/modules/financial/domain/expenses";
import type { Database } from "@/shared/types/database.types";

import {
  MAXIMO_DE_CAMPOS,
  MAXIMO_DE_OPCOES,
  TAMANHO_DA_OPCAO,
  TAMANHO_DO_TEXTO_DO_CAMPO,
  TETO_DE_CAMPOS,
  TETO_DO_NUMERO_DO_CAMPO,
} from "./limites";

export type TipoDeCampo = Database["public"]["Enums"]["pipeline_campo_tipo"];
export type ValorDeCampo = string | boolean | number;
export type ValoresDeCampos = Readonly<Record<string, ValorDeCampo>>;

export const FRASE_DO_TETO_DO_NUMERO = `precisa ser menor que ${TETO_DO_NUMERO_DO_CAMPO.toLocaleString("pt-BR")}`;

export interface CampoDoPipeline {
  readonly id: string;
  readonly pipelineId: string;
  readonly nome: string;
  readonly tipo: TipoDeCampo;
  readonly opcoes: readonly string[] | null;
  readonly obrigatorio: boolean;
  readonly ordem: number;
  readonly ativo: boolean;
}

export interface RascunhoDeCampo {
  readonly id?: string;
  readonly nome: string;
  readonly tipo: TipoDeCampo;
  readonly opcoes: readonly string[] | null;
  readonly obrigatorio: boolean;
  readonly ordem: number;
  readonly ativo: boolean;
}

export const ROTULO_DO_TIPO: Readonly<Record<TipoDeCampo, string>> = {
  texto: "Texto",
  sim_nao: "Sim/não",
  lista: "Lista",
  numero: "Número",
};

export const TIPOS_DE_CAMPO: readonly TipoDeCampo[] = Object.keys(ROTULO_DO_TIPO) as TipoDeCampo[];

export function ehTipoDeCampo(valor: string): valor is TipoDeCampo {
  return Object.hasOwn(ROTULO_DO_TIPO, valor);
}

function ordemDoJsonb(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

const tamanho = (texto: string): number => [...texto].length;

function problemaDoTipo(campo: CampoDoPipeline, valor: unknown): string | null {
  switch (campo.tipo) {
    case "texto":
      if (typeof valor !== "string") return `O campo ${campo.nome} espera texto.`;
      if (tamanho(valor) > TAMANHO_DO_TEXTO_DO_CAMPO) {
        return `O campo ${campo.nome} aceita até ${TAMANHO_DO_TEXTO_DO_CAMPO} caracteres.`;
      }
      return null;
    case "sim_nao":
      return typeof valor === "boolean" ? null : `O campo ${campo.nome} espera sim ou não.`;
    case "numero":
      return typeof valor === "number" &&
        Number.isFinite(valor) &&
        Math.abs(valor) < TETO_DO_NUMERO_DO_CAMPO
        ? null
        : `O campo ${campo.nome} espera um número.`;
    case "lista":
      if (typeof valor !== "string") return `O campo ${campo.nome} espera uma das opções.`;
      if (campo.opcoes !== null && !campo.opcoes.includes(valor)) {
        return `O campo ${campo.nome} só aceita: ${campo.opcoes.join(", ")}.`;
      }
      return null;
  }
}

export function problemasDosValores(
  campos: readonly CampoDoPipeline[],
  valores: ValoresDeCampos,
  antes?: ValoresDeCampos | null,
): string | null {
  if (valores === null || typeof valores !== "object" || Array.isArray(valores)) {
    return "Campos precisam ser um objeto.";
  }
  const presentes = Object.entries(valores).filter(([, v]) => v !== undefined);
  if (presentes.length > TETO_DE_CAMPOS) return `No máximo ${TETO_DE_CAMPOS} campos.`;

  const anterior = antes ?? null;
  const porId = new Map(campos.map((c) => [c.id, c]));
  for (const [chave, valor] of presentes.sort(([a], [b]) => ordemDoJsonb(a, b))) {
    const campo = porId.get(chave);
    if (campo === undefined) return "Campo desconhecido para este pipeline.";
    if (anterior !== null && valor === anterior[chave]) continue;
    if (!campo.ativo) return `O campo ${campo.nome} está desativado.`;
    const problema = problemaDoTipo(campo, valor);
    if (problema !== null) return problema;
  }

  if (anterior === null) {
    const faltando = [...campos]
      .filter((c) => c.ativo && c.obrigatorio)
      .sort((a, b) => a.ordem - b.ordem || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .find((c) => {
        const v = valores[c.id];
        return v === undefined || ((c.tipo === "texto" || c.tipo === "lista") && v === "");
      });
    if (faltando !== undefined) return `O campo ${faltando.nome} é obrigatório.`;
  }
  return null;
}

export function semCaixaNemAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizarCabecalho(nome: string): string {
  return semCaixaNemAcento(nome)
    .replace(/[\s-]+/g, "_")
    .replace(/^e_mail$/, "email");
}

export function chaveDeCampo(texto: string): string {
  return normalizarCabecalho(texto).replace(/[^a-z0-9_]/g, "");
}

export function apararValores(valores: ValoresDeCampos): ValoresDeCampos {
  const aparados: Record<string, ValorDeCampo> = {};
  for (const [id, valor] of Object.entries(valores)) {
    const limpo = typeof valor === "string" ? valor.trim() : valor;
    if (limpo !== "") aparados[id] = limpo;
  }
  return aparados;
}

export function problemasDaDefinicao(rascunho: readonly RascunhoDeCampo[]): string | null {
  if (rascunho.length > MAXIMO_DE_CAMPOS) {
    return `Máximo de ${MAXIMO_DE_CAMPOS} campos por pipeline.`;
  }
  const vistos = new Set<string>();
  for (const campo of rascunho) {
    const nome = campo.nome.trim();
    if (nome === "") return "Todo campo precisa de nome.";
    const chave = chaveDeCampo(nome);
    if (vistos.has(chave)) return `Nome de campo repetido: ${nome}.`;
    vistos.add(chave);
    if (campo.tipo !== "lista") continue;
    const opcoes = campo.opcoes ?? [];
    if (opcoes.length === 0) return `A lista ${nome} precisa de pelo menos uma opção.`;
    const chaves = opcoes.map(semCaixaNemAcento);
    if (chaves.includes("") || new Set(chaves).size !== chaves.length) {
      return `A lista ${nome} tem opção repetida ou vazia.`;
    }
    if (opcoes.some((opcao) => tamanho(opcao) > TAMANHO_DA_OPCAO)) {
      return `Cada opção aceita até ${TAMANHO_DA_OPCAO} caracteres.`;
    }
    if (opcoes.length > MAXIMO_DE_OPCOES) {
      return `A lista ${nome} aceita até ${MAXIMO_DE_OPCOES} opções.`;
    }
  }
  return null;
}

const SIM = new Set(["sim", "s", "true", "1", "x", "yes", "verdadeiro"]);
const NAO = new Set(["nao", "n", "false", "0", "no", "falso"]);

export function interpretarValorDoCsv(
  campo: CampoDoPipeline,
  texto: string,
): { valor?: ValorDeCampo; erro?: string } {
  const limpo = texto.trim();
  if (limpo === "") return { valor: undefined };
  switch (campo.tipo) {
    case "texto":
      return tamanho(limpo) > TAMANHO_DO_TEXTO_DO_CAMPO
        ? { erro: `texto com mais de ${TAMANHO_DO_TEXTO_DO_CAMPO} caracteres` }
        : { valor: limpo };
    case "sim_nao": {
      const chave = semCaixaNemAcento(limpo);
      if (SIM.has(chave)) return { valor: true };
      if (NAO.has(chave)) return { valor: false };
      return { erro: `'${limpo}' não é sim/não` };
    }
    case "numero": {
      const numero = interpretarValorEmReais(limpo);
      if (numero === null) return { erro: `'${limpo}' não é um número` };
      return Math.abs(numero) < TETO_DO_NUMERO_DO_CAMPO
        ? { valor: numero }
        : { erro: `'${limpo}' ${FRASE_DO_TETO_DO_NUMERO}` };
    }
    case "lista": {
      const chave = semCaixaNemAcento(limpo);
      const opcoes = campo.opcoes ?? [];
      const opcao = opcoes.find((o) => semCaixaNemAcento(o) === chave);
      return opcao === undefined
        ? { erro: `'${limpo}' não está entre as opções: ${opcoes.join(", ")}` }
        : { valor: opcao };
    }
  }
}

export function rotuloDoValor(campo: CampoDoPipeline, valor: ValorDeCampo | undefined): string {
  if (valor === undefined) return "";
  if (campo.tipo === "sim_nao" && typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (campo.tipo === "numero" && typeof valor === "number") {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 10 });
  }
  return String(valor);
}
