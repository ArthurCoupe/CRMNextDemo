const ORIGEM_SENTINELA = "http://destino.invalid";

export function destinoSeguro(valor: unknown): string {
  if (typeof valor !== "string") return "/";
  try {
    const url = new URL(valor, ORIGEM_SENTINELA);
    if (url.origin !== ORIGEM_SENTINELA || url.pathname.startsWith("//")) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
