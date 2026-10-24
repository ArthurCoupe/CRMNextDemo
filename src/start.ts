import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/attach-auth";
import { exigirSessaoPorPadrao } from "./integrations/supabase/exigir-sessao";
import { gerarNonce, HEADER_DA_CSP, montarCsp } from "./shared/lib/csp";
import { MODO_DEMO, rotaDesligadaNaDemo } from "./shared/lib/demo";
import { comHeadersDeSeguranca } from "./shared/lib/headers-de-seguranca";

let avisouSemSupabase = false;

const headersMiddleware = createMiddleware().server(async ({ next }) => {
  const nonce = gerarNonce();
  const { executarComNonce } = await import("./lib/nonce.server");
  const resultado = await executarComNonce(nonce, async () => await next());
  const resposta = comHeadersDeSeguranca(resultado.response);
  if (process.env.NODE_ENV === "production") {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!supabaseUrl && !avisouSemSupabase) {
      avisouSemSupabase = true;
      console.error("CSP sem a origem do Supabase: o navegador vai recusar toda chamada ao banco");
    }
    resposta.headers.set(HEADER_DA_CSP, montarCsp(nonce, supabaseUrl));
  }
  return { ...resultado, response: resposta };
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    const { lerNonce } = await import("./lib/nonce.server");
    return new Response(renderErrorPage(lerNonce()), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const demoMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (rotaDesligadaNaDemo(new URL(request.url).pathname)) {
    return new Response("Not found", { status: 404 });
  }
  return await next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [headersMiddleware, errorMiddleware, ...(MODO_DEMO ? [demoMiddleware] : [])],
  functionMiddleware: [attachSupabaseAuth, exigirSessaoPorPadrao],
}));
