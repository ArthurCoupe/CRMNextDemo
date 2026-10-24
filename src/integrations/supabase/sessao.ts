import { createServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";

export interface ClienteQueVerificaSessao {
  auth: {
    getClaims(): PromiseLike<{ data: { claims: { sub?: string } } | null; error: unknown }>;
    getSession(): PromiseLike<{ data: { session: Session | null } }>;
  };
}

export async function sessaoVerificada(cliente: ClienteQueVerificaSessao): Promise<Session | null> {
  const { data: claims, error } = await cliente.auth.getClaims();
  if (error || !claims?.claims?.sub) return null;
  const { data } = await cliente.auth.getSession();
  return data.session;
}

const obterSessaoNoServidor = createServerFn({ method: "GET" }).handler(async () => {
  const { criarClienteSsr } = await import("./client.ssr");
  return {
    session: await sessaoVerificada(criarClienteSsr() as unknown as ClienteQueVerificaSessao),
  };
});

export async function obterSessao(): Promise<Session | null> {
  if (typeof window === "undefined") {
    const { session } = await obterSessaoNoServidor();
    return session;
  }
  const { supabase } = await import("./client.browser");
  const { data } = await supabase.auth.getSession();
  return data.session;
}
