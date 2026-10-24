export interface Desconto {
  readonly reais: number;
  readonly fracao: number | null;
}

export function desconto(precoCatalogo: number, valor: number): Desconto {
  const catalogo = Math.round(precoCatalogo * 100);
  const centavos = catalogo - Math.round(valor * 100);
  return { reais: centavos / 100, fracao: catalogo > 0 ? centavos / catalogo : null };
}
