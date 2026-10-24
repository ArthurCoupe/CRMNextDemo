import type { Database } from "@/shared/types/database.types";

import { indiceDoMes, mesesDesde, primeiroDiaDoMes, type DataISO } from "./mes-civil";

export {
  hojeEmSaoPaulo,
  indiceDoMes,
  mesEAno,
  mesesDesde,
  primeiroDiaDoMes,
  type DataISO,
} from "./mes-civil";

export type CategoriaDeDespesa = Database["public"]["Enums"]["expense_category"];
export type RecorrenciaDeDespesa = Database["public"]["Enums"]["expense_recurrence"];
export type UnidadeDeNegocio = Database["public"]["Enums"]["business_unit"];

export const ROTULO_DA_CATEGORIA: Readonly<Record<CategoriaDeDespesa, string>> = {
  estrutural: "Estrutural",
  operacional: "Operacional",
  pessoal_socio: "Pessoal e sócios",
  divida: "Dívida",
  imposto: "Imposto",
};

export const ROTULO_DA_RECORRENCIA: Readonly<Record<RecorrenciaDeDespesa, string>> = {
  mensal: "Mensal",
  parcelado: "Parcelado",
  pontual: "Pontual",
};

export const ROTULO_DA_BU: Readonly<Record<UnidadeDeNegocio, string>> = {
  demanda: "Demanda",
  sistemas: "Sistemas",
  compartilhado: "Compartilhado",
};

export interface BaseDaDespesa {
  readonly recorrencia: RecorrenciaDeDespesa;
  readonly inicio: DataISO;
  readonly fim: DataISO | null;
  readonly parcelasTotal: number | null;
}

export function despesaCorreEm(base: BaseDaDespesa, mesReferencia: DataISO): boolean | null {
  const decorridos = mesesDesde(base.inicio, mesReferencia);
  if (decorridos === null) return null;

  if (decorridos < 0) return false;

  if (base.fim !== null) {
    const desdeOFim = mesesDesde(base.fim, mesReferencia);
    if (desdeOFim === null) return null;
    if (desdeOFim > 0) return false;
  }

  if (base.recorrencia === "pontual") return decorridos === 0;

  if (base.recorrencia === "parcelado") {
    if (base.parcelasTotal === null) return null;
    return decorridos < base.parcelasTotal;
  }

  return true;
}

export function despesaEncerradaEm(base: BaseDaDespesa, mesReferencia: DataISO): boolean | null {
  const decorridos = mesesDesde(base.inicio, mesReferencia);
  if (decorridos === null) return null;

  if (decorridos < 0) return false;

  if (base.fim !== null) {
    const desdeOFim = mesesDesde(base.fim, mesReferencia);
    if (desdeOFim === null) return null;
    if (desdeOFim > 0) return true;
  }

  if (base.recorrencia === "pontual") return decorridos > 0;

  if (base.recorrencia === "parcelado") {
    if (base.parcelasTotal === null) return null;
    return decorridos >= base.parcelasTotal;
  }

  return false;
}

export function parcelasPagasAte(
  inicio: DataISO,
  parcelasTotal: number | null,
  mesReferencia: DataISO,
): number | null {
  if (parcelasTotal === null) return null;
  const decorridos = mesesDesde(inicio, mesReferencia);
  if (decorridos === null) return null;
  return Math.min(parcelasTotal, Math.max(0, decorridos + 1));
}

export function parcelasRestantes(
  inicio: DataISO,
  parcelasTotal: number | null,
  mesReferencia: DataISO,
): number | null {
  const pagas = parcelasPagasAte(inicio, parcelasTotal, mesReferencia);
  if (pagas === null || parcelasTotal === null) return null;
  return parcelasTotal - pagas;
}

export function ultimaParcelaEm(inicio: DataISO, parcelasTotal: number | null): DataISO | null {
  if (parcelasTotal === null || parcelasTotal <= 0) return null;
  const indice = indiceDoMes(inicio);
  if (indice === null) return null;
  return primeiroDiaDoMes(indice + (parcelasTotal - 1));
}

const AGRUPAMENTO_DE_MILHAR = /^[1-9][0-9]{0,2}(?:([.,])[0-9]{3})(?:\1[0-9]{3})*$/;

export function interpretarValorEmReais(texto: string): number | null {
  const limpo = texto.trim();
  if (limpo === "") return null;

  if (!/^[0-9.,]+$/.test(limpo)) return null;

  if (/^[0-9]+$/.test(limpo)) {
    const centavosInteiros = Number(limpo) * 100;
    return Number.isSafeInteger(centavosInteiros) ? centavosInteiros / 100 : null;
  }

  if (AGRUPAMENTO_DE_MILHAR.test(limpo)) {
    const inteiro = Number(limpo.replace(/[.,]/g, "")) * 100;
    return Number.isSafeInteger(inteiro) ? inteiro / 100 : null;
  }

  const corte = Math.max(limpo.lastIndexOf("."), limpo.lastIndexOf(","));
  const separadorDecimal = limpo.charAt(corte);
  const antesDoDecimal = limpo.slice(0, corte);
  const parteDecimal = limpo.slice(corte + 1);

  if (!/^[0-9]{1,2}$/.test(parteDecimal)) return null;

  const agrupada = AGRUPAMENTO_DE_MILHAR.exec(antesDoDecimal);
  const parteInteira = /^[0-9]+$/.test(antesDoDecimal)
    ? antesDoDecimal
    : agrupada !== null && agrupada[1] !== separadorDecimal
      ? antesDoDecimal.replace(/[.,]/g, "")
      : null;
  if (parteInteira === null) return null;

  const centavos = Number(parteInteira) * 100 + Number((parteDecimal + "0").slice(0, 2));
  return Number.isSafeInteger(centavos) ? centavos / 100 : null;
}

export function recorrenciaParaGravar(
  ehAgrupador: boolean,
  recorrencia: RecorrenciaDeDespesa,
): RecorrenciaDeDespesa {
  return ehAgrupador ? "mensal" : recorrencia;
}

export function parcelasParaGravar(
  recorrencia: RecorrenciaDeDespesa,
  parcelas: number | null,
): number | null {
  return recorrencia === "parcelado" ? parcelas : null;
}

export function fimParaGravar(
  recorrencia: RecorrenciaDeDespesa,
  fim: DataISO | null,
): DataISO | null {
  return recorrencia === "mensal" ? fim : null;
}

export interface DespesaEfetiva {
  readonly id: string;
  readonly descricao: string;
  readonly valor: number;
  readonly categoria: CategoriaDeDespesa;
  readonly bu: UnidadeDeNegocio;
  readonly recorrencia: RecorrenciaDeDespesa;
  readonly fornecedor: string | null;
  readonly meioDePagamento: string | null;
  readonly agrupadorId: string | null;
  readonly agrupador: string | null;
  readonly totalDoAgrupador: number | null;
  readonly parcelasTotal: number | null;
  readonly parcelasPagas: number | null;
  readonly parcelasRestantes: number | null;
  readonly ultimaParcelaEm: DataISO | null;
  readonly inicio: DataISO;
  readonly fim: DataISO | null;
  readonly mesReferencia: DataISO;
}

export interface AgrupadorNaArvore {
  readonly id: string;
  readonly nome: string;
  readonly total: number | null;
  readonly filhos: readonly DespesaEfetiva[];
}

export interface ArvoreDeGastos {
  readonly agrupadores: readonly AgrupadorNaArvore[];
  readonly soltas: readonly DespesaEfetiva[];
}

export function montarArvore(linhas: readonly DespesaEfetiva[]): ArvoreDeGastos {
  const porAgrupador = new Map<string, DespesaEfetiva[]>();
  const soltas: DespesaEfetiva[] = [];

  for (const linha of linhas) {
    if (linha.agrupadorId === null) {
      soltas.push(linha);
      continue;
    }
    const irmas = porAgrupador.get(linha.agrupadorId);
    if (irmas === undefined) porAgrupador.set(linha.agrupadorId, [linha]);
    else irmas.push(linha);
  }

  const agrupadores: AgrupadorNaArvore[] = [];
  for (const [id, filhos] of porAgrupador) {
    const primeiro = filhos[0];
    agrupadores.push({
      id,
      nome: primeiro.agrupador ?? "Agrupador sem nome",
      total: primeiro.totalDoAgrupador,
      filhos,
    });
  }

  agrupadores.sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

  return { agrupadores, soltas };
}

export interface MesProjetado {
  readonly mes: DataISO;
  readonly custoTotal: number;
  readonly custoDemanda: number;
  readonly custoSistemas: number;
  readonly custoCompartilhado: number;
  readonly despesas: number;
  readonly custoGastos: number;
  readonly custoFolha: number;
  readonly pessoasNaFolha: number;
  readonly folhaDemanda: number;
  readonly folhaSistemas: number;
  readonly folhaCompartilhado: number;
}

export interface MesDeQueda {
  readonly mesFim: DataISO;
  readonly valorQueSai: number;
  readonly despesas: number;
  readonly custoNoMesDoFim: number | null;
  readonly custoDepois: number | null;
}

export interface QuedaDeCusto {
  readonly ultimoMes: DataISO;
  readonly valorQueSai: number;
  readonly custoNoMesDoFim: number | null;
  readonly custoDepois: number | null;
  readonly caiuDeFato: boolean | null;
}

export function proximaQueda(meses: readonly MesDeQueda[]): QuedaDeCusto | null {
  let escolhido: MesDeQueda | null = null;
  let menorIndice = Number.POSITIVE_INFINITY;

  for (const mes of meses) {
    const indice = indiceDoMes(mes.mesFim);
    if (indice === null) continue;
    if (indice < menorIndice) {
      menorIndice = indice;
      escolhido = mes;
    }
  }

  if (escolhido === null) return null;

  return {
    ultimoMes: escolhido.mesFim,
    valorQueSai: escolhido.valorQueSai,
    custoNoMesDoFim: escolhido.custoNoMesDoFim,
    custoDepois: escolhido.custoDepois,
    caiuDeFato:
      escolhido.custoDepois === null || escolhido.custoNoMesDoFim === null
        ? null
        : escolhido.custoDepois < escolhido.custoNoMesDoFim,
  };
}
