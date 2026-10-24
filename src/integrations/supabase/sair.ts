import {
  AuthUnknownError,
  isAuthApiError,
  isAuthSessionMissingError,
  type AuthError,
} from "@supabase/supabase-js";
import { MODO_DEMO } from "@/shared/lib/demo";
import { supabase } from "./client.browser";

const CODIGOS_DE_SESSAO_MORTA = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "session_expired",
]);

function sessaoMorta(error: AuthError): boolean {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthApiError(error) && CODIGOS_DE_SESSAO_MORTA.has(error.code ?? ""))
  );
}

function jwtRecusado(error: AuthError): boolean {
  return isAuthApiError(error) && [401, 403, 404].includes(error.status);
}

const ESCOPO = MODO_DEMO ? "local" : "global";

async function revogar(token: string): Promise<AuthError | null> {
  const { error } = await supabase.auth.admin.signOut(token, ESCOPO);
  if (error === null || sessaoMorta(error)) return null;
  if (!jwtRecusado(error)) return error;

  const renovada = await supabase.auth.refreshSession();
  if (renovada.error) return sessaoMorta(renovada.error) ? null : renovada.error;
  const novo = renovada.data.session?.access_token;
  if (!novo) return null;
  const segunda = await supabase.auth.admin.signOut(novo, ESCOPO);
  if (segunda.error === null || sessaoMorta(segunda.error)) return null;
  return segunda.error;
}

let emCurso: Promise<{ error: AuthError | null }> | null = null;

export function sairDaConta(): Promise<{ error: AuthError | null }> {
  emCurso ??= sair().finally(() => {
    emCurso = null;
  });
  return emCurso;
}

async function sair(): Promise<{ error: AuthError | null }> {
  try {
    const { data, error: erroDaSessao } = await supabase.auth.getSession();
    if (erroDaSessao && !sessaoMorta(erroDaSessao)) return { error: erroDaSessao };

    const token = data.session?.access_token;
    if (token) {
      const error = await revogar(token);
      if (error) return { error };
    }

    await supabase.auth.signOut({ scope: "local" });
    return { error: null };
  } catch (e) {
    return { error: new AuthUnknownError("Falha inesperada ao sair.", e) };
  }
}

const ESPERA_DO_SIGNOUT_LOCAL_MS = 4_000;

export async function sairSoDesteNavegador(): Promise<void> {
  let espera: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    supabase.auth.signOut({ scope: "local" }).catch(() => undefined),
    new Promise<void>((pronto) => {
      espera = setTimeout(pronto, ESPERA_DO_SIGNOUT_LOCAL_MS);
    }),
  ]);
  clearTimeout(espera);
  const seguro = window.location.protocol === "https:" ? "; Secure" : "";
  for (const par of document.cookie.split(";")) {
    const nome = par.split("=")[0]?.trim() ?? "";
    if (nome.startsWith("sb-")) {
      document.cookie = `${nome}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax${seguro}`;
    }
  }
}
