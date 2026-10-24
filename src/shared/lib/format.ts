const FORMATO_BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function brl(valor: number | null | undefined): string {
  return FORMATO_BRL.format(valor ?? 0);
}

const FORMATO_PCT = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function pct(fracao: number | null | undefined): string {
  return FORMATO_PCT.format(fracao ?? 0);
}

const FORMATO_COMPACTO = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function compactBrl(valor: number | null | undefined): string {
  return FORMATO_COMPACTO.format(valor ?? 0);
}

export function plural(n: number, singular: string, mais: string): string {
  return `${n} ${n === 1 ? singular : mais}`;
}
