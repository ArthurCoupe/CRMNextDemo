import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";

import type { Database } from "@/shared/types/database.types";

export type PapelDoUsuario = Database["public"]["Enums"]["app_role"];

interface ClienteQueSabeOPapel {
  rpc(nome: "current_app_role"): PromiseLike<{
    data: PapelDoUsuario | null;
    error: unknown;
  }>;
}

type LeituraDoPapel = { readonly papel: PapelDoUsuario | null } | { readonly falha: true };

async function lerPapel(cliente: ClienteQueSabeOPapel): Promise<LeituraDoPapel> {
  const { data, error } = await cliente.rpc("current_app_role");
  if (error) return { falha: true };
  return { papel: data ?? null };
}

const obterPapelNoServidor = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeituraDoPapel> => {
    const { criarClienteSsr } = await import("./client.ssr");
    return lerPapel(criarClienteSsr() as unknown as ClienteQueSabeOPapel);
  },
);

export class FalhaAoLerPapel extends Error {
  override readonly name = "FalhaAoLerPapel";
}

export async function obterPapel(): Promise<{ readonly papel: PapelDoUsuario | null }> {
  let leitura: LeituraDoPapel;
  if (typeof window === "undefined") {
    leitura = await obterPapelNoServidor();
  } else {
    const { supabase } = await import("./client.browser");
    leitura = await lerPapel(supabase as unknown as ClienteQueSabeOPapel);
  }
  if ("falha" in leitura) throw new FalhaAoLerPapel("falha ao ler o papel");
  return { papel: leitura.papel };
}

export function exigirPapel(
  permitidos: readonly PapelDoUsuario[],
  papel: PapelDoUsuario | null,
): void {
  if (papel === null || !permitidos.includes(papel)) {
    throw redirect({ to: "/acesso-negado", search: { exigido: permitidos.join(", ") } });
  }
}
