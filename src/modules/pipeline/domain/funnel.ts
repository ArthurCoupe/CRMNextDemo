import { entraNoFunil, ORDEM_DOS_ESTAGIOS, type Estagio } from "./stage";

export interface LinhaDoFunil {
  readonly canal: string;
  readonly estagio: Estagio;
  readonly oportunidades: number;
  readonly oportunidadesNoCanal: number;
}

export interface LinhaDaSemana {
  readonly semana: string;
  readonly responsavelId: string | null;
  readonly responsavel: string;
  readonly toques: number;
  readonly r1Marcadas: number;
  readonly r1DistintasNaSemana: number;
}

export interface DegrauDoFunil {
  readonly estagio: Estagio;
  readonly oportunidades: number;
  readonly taxaDaAnterior: number | null;
}

export const ETAPAS_DA_PROGRESSAO: readonly Estagio[] = ORDEM_DOS_ESTAGIOS.filter(
  (estagio) => estagio !== "perdido" && estagio !== "descartado",
);

export function contagensPorEstagio(linhas: readonly LinhaDoFunil[]): Record<Estagio, number> {
  const contagens = Object.fromEntries(ORDEM_DOS_ESTAGIOS.map((estagio) => [estagio, 0])) as Record<
    Estagio,
    number
  >;
  for (const linha of linhas) {
    contagens[linha.estagio] = (contagens[linha.estagio] ?? 0) + linha.oportunidades;
  }
  return contagens;
}

export function funilEmDegraus(linhas: readonly LinhaDoFunil[]): readonly DegrauDoFunil[] {
  const contagens = contagensPorEstagio(linhas);
  return ETAPAS_DA_PROGRESSAO.map((estagio, i) => {
    const anterior = i === 0 ? null : contagens[ETAPAS_DA_PROGRESSAO[i - 1]];
    return {
      estagio,
      oportunidades: contagens[estagio],
      taxaDaAnterior: anterior === null || anterior === 0 ? null : contagens[estagio] / anterior,
    };
  });
}

export interface ReferenciaDoFunil {
  readonly valor: number;
  readonly ehOMaior: boolean;
}

export function referenciaDoFunil(degraus: readonly DegrauDoFunil[]): ReferenciaDoFunil {
  const topo = degraus[0]?.oportunidades ?? 0;
  if (topo > 0) return { valor: topo, ehOMaior: false };
  const maior = degraus.reduce((maximo, degrau) => Math.max(maximo, degrau.oportunidades), 0);
  return { valor: maior, ehOMaior: maior > 0 };
}

export function porCanal(
  linhas: readonly LinhaDoFunil[],
): ReadonlyMap<string, Record<Estagio, number>> {
  const mapa = new Map<string, Record<Estagio, number>>();
  for (const linha of linhas) {
    const atual = mapa.get(linha.canal) ?? contagensPorEstagio([]);
    atual[linha.estagio] += linha.oportunidades;
    mapa.set(linha.canal, atual);
  }
  return mapa;
}

export function taxaDeConversaoDoCanal(
  fechados: number,
  oportunidadesNoCanal: number,
): number | null {
  if (oportunidadesNoCanal === 0) return null;
  return fechados / oportunidadesNoCanal;
}

export function oportunidadesPorCanal(
  linhas: readonly LinhaDoFunil[],
): ReadonlyMap<string, number> {
  const mapa = new Map<string, number>();
  for (const linha of linhas) mapa.set(linha.canal, linha.oportunidadesNoCanal);
  return mapa;
}

export function somarBaldesDisjuntos(
  linhas: readonly { readonly oportunidades: number }[],
): number {
  return linhas.reduce((soma, linha) => soma + linha.oportunidades, 0);
}

export interface TotalDaSemana {
  readonly toques: number;
  readonly r1Marcadas: number;
  readonly pessoas: number;
}

export function totalDaSemana(linhas: readonly LinhaDaSemana[], semana: string): TotalDaSemana {
  const daSemana = linhas.filter((l) => l.semana === semana);
  return {
    toques: daSemana.reduce((soma, l) => soma + l.toques, 0),
    r1Marcadas: daSemana[0]?.r1DistintasNaSemana ?? 0,
    pessoas: daSemana.length,
  };
}

export const ETAPAS_DO_DENOMINADOR: readonly Estagio[] = ORDEM_DOS_ESTAGIOS.filter(entraNoFunil);
