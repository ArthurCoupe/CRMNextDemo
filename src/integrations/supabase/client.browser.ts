import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/types/database.types";
import { comRetentativaNoRest } from "@/shared/lib/fetch-supabase";

function obterConfig(): { url: string; key: string } {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const faltando = [
      ...(url ? [] : ["VITE_SUPABASE_URL"]),
      ...(key ? [] : ["VITE_SUPABASE_PUBLISHABLE_KEY"]),
    ];
    throw new Error(`Variáveis de ambiente do Supabase ausentes: ${faltando.join(", ")}.`);
  }

  return { url, key };
}

const { url, key } = obterConfig();

export const supabase = createBrowserClient<Database>(url, key, {
  cookieOptions: {
    sameSite: "lax",
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  },
  global: { fetch: comRetentativaNoRest() },
});

export function conferirToken(token: string) {
  const descartavel = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "sb-conferencia-de-link",
    },
  });
  return descartavel.auth.getUser(token);
}
