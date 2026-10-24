import type { UnidadeDeNegocio } from "./expenses";
import type { DataISO } from "./mes-civil";

export interface ResultadoDaBu {
  readonly bu: UnidadeDeNegocio;
  readonly receitaBruta: number;
  readonly imposto: number;
  readonly taxas: number;
  readonly receitaLiquida: number;
  readonly custoGastos: number;
  readonly custoFolha: number;
  readonly custoParticipacao: number;
  readonly custoDireto: number;
  readonly custoRateado: number;
  readonly resultado: number;
  readonly margemPct: number | null;
  readonly proporcaoPct: number | null;
}

function duasCasas(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs(valor) * 100)) / 100;
}

export function ratearPorCaixa(
  compartilhado: number,
  caixaPorBu: ReadonlyMap<UnidadeDeNegocio, number>,
): ReadonlyMap<UnidadeDeNegocio, number> {
  let total = 0;
  for (const caixa of caixaPorBu.values()) total += caixa;

  const rateado = new Map<UnidadeDeNegocio, number>();
  for (const [bu, caixa] of caixaPorBu) {
    rateado.set(bu, total === 0 ? 0 : duasCasas((compartilhado * caixa) / total));
  }
  return rateado;
}

export function margemPct(resultado: number, receitaLiquida: number): number | null {
  if (receitaLiquida === 0) return null;
  const sinal = resultado / receitaLiquida < 0 ? -1 : 1;
  return (sinal * Math.round(Math.abs((100 * resultado) / receitaLiquida) * 10)) / 10;
}

export const TOLERANCIA_DA_MARGEM_PP = 0.1;
export const TOLERANCIA_DO_RATEIO = 0.01;

function dentroDaTolerancia(a: number, b: number, tolerancia: number): boolean {
  return Math.abs(duasCasas(a - b)) <= tolerancia;
}

export interface Divergencia {
  readonly bu: UnidadeDeNegocio;
  readonly grandeza: "rateio" | "resultado" | "margem";
  readonly doBanco: number | null;
  readonly recalculado: number | null;
}

export function conferirResultado(
  linhas: readonly ResultadoDaBu[],
  custoCompartilhado: number,
): readonly Divergencia[] {
  const caixa = new Map<UnidadeDeNegocio, number>(linhas.map((l) => [l.bu, l.receitaBruta]));
  const rateado = ratearPorCaixa(custoCompartilhado, caixa);
  const divergencias: Divergencia[] = [];

  for (const linha of linhas) {
    const rateioEsperado = rateado.get(linha.bu) ?? 0;
    if (!dentroDaTolerancia(linha.custoRateado, rateioEsperado, TOLERANCIA_DO_RATEIO)) {
      divergencias.push({
        bu: linha.bu,
        grandeza: "rateio",
        doBanco: linha.custoRateado,
        recalculado: rateioEsperado,
      });
    }

    const resultadoEsperado = duasCasas(linha.receitaLiquida - linha.custoDireto - rateioEsperado);
    if (duasCasas(linha.resultado) !== resultadoEsperado) {
      divergencias.push({
        bu: linha.bu,
        grandeza: "resultado",
        doBanco: linha.resultado,
        recalculado: resultadoEsperado,
      });
    }

    const margemEsperada = margemPct(linha.resultado, linha.receitaLiquida);
    const margemBate =
      linha.margemPct === null || margemEsperada === null
        ? linha.margemPct === margemEsperada
        : dentroDaTolerancia(linha.margemPct, margemEsperada, TOLERANCIA_DA_MARGEM_PP);
    if (!margemBate) {
      divergencias.push({
        bu: linha.bu,
        grandeza: "margem",
        doBanco: linha.margemPct,
        recalculado: margemEsperada,
      });
    }
  }

  return divergencias;
}

export function rateioFecha(linhas: readonly ResultadoDaBu[], custoCompartilhado: number): boolean {
  let caixaTotal = 0;
  for (const linha of linhas) caixaTotal += linha.receitaBruta;
  if (caixaTotal === 0) return true;

  let soma = 0;
  for (const linha of linhas) soma += linha.custoRateado;
  return Math.abs(duasCasas(soma) - duasCasas(custoCompartilhado)) <= 0.01;
}

export function breakEvenEmClientes(custoFixoTotal: number, ticketMedioMrr: number): number | null {
  if (ticketMedioMrr <= 0) return null;
  if (custoFixoTotal <= 0) return 0;
  return Math.ceil(custoFixoTotal / ticketMedioMrr);
}

export function progressoDaMeta(mrrFirme: number, meta: number): number | null {
  if (meta <= 0) return null;
  return mrrFirme / meta;
}

export interface ProgressoParaBarra {
  readonly percentual: number;
  readonly falta: number;
}

export function progressoParaBarra(atual: number, meta: number | null): ProgressoParaBarra | null {
  if (meta === null) return null;
  const razao = progressoDaMeta(atual, meta);
  if (razao === null) return null;
  return {
    percentual: Math.min(100, Math.max(0, Math.round(razao * 100))),
    falta: Math.max(0, meta - atual),
  };
}

export type SituacaoDoMes = "parcial" | "congelado" | "reconstruido";

export function situacaoDoMes(
  mes: DataISO,
  mesCorrente: DataISO,
  temSnapshot: boolean,
): SituacaoDoMes {
  if (mes >= mesCorrente) return "parcial";
  return temSnapshot ? "congelado" : "reconstruido";
}

export const ROTULO_DA_SITUACAO: Readonly<Record<SituacaoDoMes, string>> = {
  parcial: "mês corrente · ainda correndo",
  congelado: "fechado · congelado no dia 1º",
  reconstruido: "reconstruído com os parâmetros de hoje",
};
