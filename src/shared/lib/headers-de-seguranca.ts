export const HEADERS_DE_SEGURANCA: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
};

export function comHeadersDeSeguranca(resposta: Response): Response {
  try {
    for (const [nome, valor] of Object.entries(HEADERS_DE_SEGURANCA))
      resposta.headers.set(nome, valor);
    return resposta;
  } catch {
    const headers = new Headers(resposta.headers);
    for (const [nome, valor] of Object.entries(HEADERS_DE_SEGURANCA)) headers.set(nome, valor);
    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers,
    });
  }
}
