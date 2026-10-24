export const HASH_DO_CSS_DO_SONNER = "sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=";

export const HASH_DE_STYLE_VAZIO = "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

export const HEADER_DA_CSP = "Content-Security-Policy" as const;

export const CAMINHO_DO_RELATORIO = "/api/csp-report";

export function publicarNonceDaPagina(doc: Document): string | undefined {
  const script = doc.querySelector<HTMLScriptElement>("script[nonce]");
  const nonce = script?.nonce || script?.getAttribute("nonce") || undefined;
  if (nonce) (globalThis as { __webpack_nonce__?: string }).__webpack_nonce__ = nonce;
  return nonce;
}

export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function origemWs(url: string): string {
  return url.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}

export function montarCsp(nonce: string, supabaseUrl: string | undefined): string {
  const supa = supabaseUrl ? ` ${supabaseUrl} ${origemWs(supabaseUrl)}` : "";
  const supaHttp = supabaseUrl ? ` ${supabaseUrl}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.hcaptcha.com`,
    `connect-src 'self'${supa} https://*.hcaptcha.com`,
    `img-src 'self' data:${supaHttp}`,
    "font-src 'self' data:",
    "style-src 'self' https://*.hcaptcha.com",
    `style-src-elem 'self' 'nonce-${nonce}' '${HASH_DO_CSS_DO_SONNER}' '${HASH_DE_STYLE_VAZIO}' https://*.hcaptcha.com`,
    "style-src-attr 'unsafe-inline'",
    "frame-src https://*.hcaptcha.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `report-uri ${CAMINHO_DO_RELATORIO}`,
  ].join("; ");
}
