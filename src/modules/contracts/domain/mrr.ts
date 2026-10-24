import { todaySP } from "@/shared/lib/date";

import type { Contrato, LinhaDeNegocio } from "./contract";

export type ContratoParaMrr = Pick<
  Contrato,
  "tipo" | "status" | "cobrancaAtiva" | "valorMensal" | "inicio" | "fim"
>;

function mesDe(dataCivil: string): string {
  return dataCivil.slice(0, 7);
}

export function contaParaMrr(contrato: ContratoParaMrr, mes: string = mesDe(todaySP())): boolean {
  return (
    contrato.tipo === "mrr" &&
    contrato.status !== "cancelled" &&
    contrato.cobrancaAtiva === true &&
    mesDe(contrato.inicio) <= mes &&
    (contrato.fim === null || mes <= mesDe(contrato.fim))
  );
}

export function somarMrr(
  contratos: readonly ContratoParaMrr[],
  mes: string = mesDe(todaySP()),
): number {
  const centavos = contratos
    .filter((c) => contaParaMrr(c, mes))
    .reduce((soma, c) => soma + Math.round((c.valorMensal ?? 0) * 100), 0);
  return centavos / 100;
}

export function somarMrrPorLinhaDeNegocio(
  contratos: readonly Contrato[],
  mes: string = mesDe(todaySP()),
): Record<LinhaDeNegocio, number> {
  const total: Record<LinhaDeNegocio, number> = { demanda: 0, sistemas: 0, compartilhado: 0 };
  for (const contrato of contratos.filter((c) => contaParaMrr(c, mes))) {
    total[contrato.linhaDeNegocio] += Math.round((contrato.valorMensal ?? 0) * 100);
  }
  return {
    demanda: total.demanda / 100,
    sistemas: total.sistemas / 100,
    compartilhado: total.compartilhado / 100,
  };
}
