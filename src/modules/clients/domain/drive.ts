export function extrairIdDaPasta(valor: string): string | null {
  const bruto = valor.trim();
  if (bruto === "") return null;

  const casamento = bruto.match(
    /^(?:https?:\/\/)?(?:www\.)?drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/,
  );
  if (casamento !== null) return casamento[1];

  const casamentoAntigo = bruto.match(
    /^(?:https?:\/\/)?(?:www\.)?drive\.google\.com\/open\?(?:.*[?&])?id=([A-Za-z0-9_-]+)/,
  );
  if (casamentoAntigo !== null) return casamentoAntigo[1];

  if (/^https?:\/\//.test(bruto) || bruto.includes("/")) return null;

  if (/^[A-Za-z0-9_-]{10,}$/.test(bruto)) return bruto;

  return null;
}
