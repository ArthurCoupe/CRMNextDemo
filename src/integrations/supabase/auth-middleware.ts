import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { comRetentativaNoRest } from "@/shared/lib/fetch-supabase";

import type { Database } from "@/shared/types/database.types";

export interface PedidoAutenticado {
  readonly supabase: ReturnType<typeof createClient<Database>>;
  readonly userId: string;
  readonly claims: NonNullable<
    Awaited<ReturnType<ReturnType<typeof createClient<Database>>["auth"]["getClaims"]>>["data"]
  >["claims"];
}

export async function autenticarPedido(
  request: Request | undefined,
): Promise<PedidoAutenticado | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  const authHeader = request?.headers?.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (token === "") return null;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: comRetentativaNoRest(),
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub, claims: data.claims };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const pedido = await autenticarPedido(getRequest());
    if (pedido === null) {
      throw new Error("Unauthorized: Invalid token");
    }
    return next({
      context: {
        supabase: pedido.supabase,
        userId: pedido.userId,
        claims: pedido.claims,
      },
    });
  },
);
