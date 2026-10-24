import { createClient } from "@supabase/supabase-js";
import { comRetentativaNoRest } from "@/shared/lib/fetch-supabase";
import type { Database } from "@/shared/types/database.types";
import { segredo } from "./segredos.server";

let avisouSemChave = false;

export async function dentroDoLimite(
  uid: string,
  balde: string,
  limite: number,
  janelaS: number,
): Promise<boolean | null> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chave = segredo("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chave) {
    if (!avisouSemChave) {
      avisouSemChave = true;
      console.error(
        "[limite] sem SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY: limite por usuário desligado",
      );
    }
    return null;
  }
  try {
    const servico = createClient<Database>(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: comRetentativaNoRest() },
    });
    const { data, error } = await servico.rpc("limite_do_usuario", {
      p_uid: uid,
      p_bucket: balde,
      p_limite: limite,
      p_janela_s: janelaS,
    });
    if (error) {
      console.error(`[limite] limite_do_usuario falhou: ${error.code || "sem código"}`);
      return null;
    }
    return data;
  } catch (erro) {
    console.error(
      `[limite] limite_do_usuario falhou: ${erro instanceof Error ? erro.name : "erro"}`,
    );
    return null;
  }
}
