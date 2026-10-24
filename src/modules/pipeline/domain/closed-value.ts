import { brl } from "@/shared/lib/format";

export interface ValorFechado {
  readonly mrr: number | null;
  readonly tcv: number | null;
}

export function partesDoValorFechado(valor: ValorFechado): readonly string[] {
  const partes: string[] = [];
  if (valor.mrr !== null && valor.mrr > 0) partes.push(`${brl(valor.mrr)}/mês`);
  if (valor.tcv !== null && valor.tcv > 0) partes.push(brl(valor.tcv));
  return partes;
}

export function temValorFechado(valor: ValorFechado): boolean {
  return partesDoValorFechado(valor).length > 0;
}
