import {
  FRENTES_DE_SERVICO,
  type LinhaDeNegocio,
  type FrenteDeServico,
} from "@/modules/contracts/domain/contract";

export const LINHAS_DA_MATRIZ: readonly LinhaDeNegocio[] = ["demanda", "sistemas"] as const;

export interface CelulaDeMrr {
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly total: number;
  readonly firme: number;
  readonly contratos: number;
}

export interface CelulaDeTcv {
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly total: number;
  readonly projetos: number;
}

export interface LinhaDeMrrPorUnidade {
  readonly bu: LinhaDeNegocio;
  readonly mrr_total: number | null;
  readonly mrr_firme: number | null;
  readonly contratos: number | null;
}

export interface LinhaDeTcvPorUnidade {
  readonly bu: LinhaDeNegocio;
  readonly tcv_total: number | null;
  readonly projetos: number | null;
}

export function celulasDeMrr(linhas: readonly LinhaDeMrrPorUnidade[]): readonly CelulaDeMrr[] {
  return LINHAS_DA_MATRIZ.map((linhaDeNegocio) => {
    const encontrada = linhas.find((l) => l.bu === linhaDeNegocio);
    return {
      linhaDeNegocio,
      total: encontrada?.mrr_total ?? 0,
      firme: encontrada?.mrr_firme ?? 0,
      contratos: encontrada?.contratos ?? 0,
    };
  });
}

export function celulasDeTcv(linhas: readonly LinhaDeTcvPorUnidade[]): readonly CelulaDeTcv[] {
  return LINHAS_DA_MATRIZ.map((linhaDeNegocio) => {
    const encontrada = linhas.find((l) => l.bu === linhaDeNegocio);
    return {
      linhaDeNegocio,
      total: encontrada?.tcv_total ?? 0,
      projetos: encontrada?.projetos ?? 0,
    };
  });
}

export function linhasForaDaMatriz(
  linhas: readonly { readonly bu: LinhaDeNegocio }[],
): readonly LinhaDeNegocio[] {
  return [...new Set(linhas.map((l) => l.bu))].filter((bu) => !LINHAS_DA_MATRIZ.includes(bu));
}

export interface LinhaDeFaturamento {
  readonly frente: FrenteDeServico;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly mrrMensal: number;
  readonly tcvTotal: number;
  readonly caixaMes: number;
}

export interface LinhaDeReceitaPorFrente {
  readonly front: FrenteDeServico;
  readonly bu: LinhaDeNegocio;
  readonly mrr_mensal: number | null;
  readonly tcv_total: number | null;
  readonly caixa_mes: number | null;
}

const ORDEM_DAS_FRENTES = FRENTES_DE_SERVICO;

export function linhasDeFaturamento(
  linhas: readonly LinhaDeReceitaPorFrente[],
): readonly LinhaDeFaturamento[] {
  return [...linhas]
    .map((l) => ({
      frente: l.front,
      linhaDeNegocio: l.bu,
      mrrMensal: l.mrr_mensal ?? 0,
      tcvTotal: l.tcv_total ?? 0,
      caixaMes: l.caixa_mes ?? 0,
    }))
    .sort((a, b) => ORDEM_DAS_FRENTES.indexOf(a.frente) - ORDEM_DAS_FRENTES.indexOf(b.frente));
}

export function totalDeCaixa(linhas: readonly LinhaDeFaturamento[]): number {
  return linhas.reduce((soma, l) => soma + l.caixaMes, 0);
}

export interface ProjetoAtrasado {
  readonly id: string;
  readonly cliente: string;
  readonly projeto: string;
  readonly prazoDeEntrega: string;
  readonly diasDeAtraso: number;
  readonly valorTotal: number;
  readonly parcelaMensal: number;
  readonly mesesExtra: number;
}
