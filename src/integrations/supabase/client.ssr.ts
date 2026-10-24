import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import type { Database } from "@/shared/types/database.types";
import { comRetentativaNoRest } from "@/shared/lib/fetch-supabase";

export function criarClienteSsr() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const faltando = [
      ...(url ? [] : ["SUPABASE_URL"]),
      ...(key ? [] : ["SUPABASE_PUBLISHABLE_KEY"]),
    ];
    throw new Error(
      `Variáveis de ambiente do Supabase ausentes no servidor: ${faltando.join(", ")}.`,
    );
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          setCookie(name, value, options);
        }
      },
    },
    global: { fetch: comRetentativaNoRest() },
  });
}
