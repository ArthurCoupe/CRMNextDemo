export function inteiroPositivoOuNulo(texto: string): number | null | undefined {
  const limpo = texto.trim();
  if (limpo === "") return null;
  if (!/^[0-9]+$/.test(limpo)) return undefined;
  const n = Number(limpo);
  return n > 0 ? n : undefined;
}
