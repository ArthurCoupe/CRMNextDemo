import type { Contrato, LinhaDeNegocio } from "./contract";

export function contaParaTcv(contrato: Contrato): boolean {
  return (
    contrato.tipo === "tcv" && contrato.status !== "cancelled" && contrato.cobrancaAtiva === true
  );
}

export function somarTcv(contratos: readonly Contrato[]): number {
  const centavos = contratos
    .filter(contaParaTcv)
    .reduce((soma, c) => soma + Math.round((c.valorTotal ?? 0) * 100), 0);
  return centavos / 100;
}

export function somarTcvPorLinhaDeNegocio(
  contratos: readonly Contrato[],
): Record<LinhaDeNegocio, number> {
  const total: Record<LinhaDeNegocio, number> = { demanda: 0, sistemas: 0, compartilhado: 0 };
  for (const contrato of contratos.filter(contaParaTcv)) {
    total[contrato.linhaDeNegocio] += Math.round((contrato.valorTotal ?? 0) * 100);
  }
  return {
    demanda: total.demanda / 100,
    sistemas: total.sistemas / 100,
    compartilhado: total.compartilhado / 100,
  };
}
