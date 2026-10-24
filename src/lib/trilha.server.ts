import { createClient } from "@supabase/supabase-js";
import type { Json } from "@/shared/types/database.types";
import { segredo } from "./segredos.server";

export type EventoDaTrilha = "sessao_recusada" | "csp_violacao" | "origem_recusada";

let avisouSemChave = false;

export async function registrarEventoDeSeguranca(
  evento: EventoDaTrilha,
  alvo: string,
  ip: string | undefined,
  detalhes?: { [chave: string]: Json },
): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chave = segredo("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chave) {
    if (!avisouSemChave) {
      avisouSemChave = true;
      console.error("[trilha] sem SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY: eventos não gravados");
    }
    return;
  }
  try {
    const servico = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await servico.rpc("registrar_evento_de_seguranca", {
      p_evento: evento,
      p_alvo: alvo.slice(0, 256),
      ...(detalhes ? { p_detalhes: detalhes } : {}),
      p_ip: ip,
    });
    if (error)
      console.error(`[trilha] ${evento} recusado pelo banco: ${error.code || "sem código"}`);
  } catch (erro) {
    console.error(`[trilha] ${evento} não gravado: ${erro instanceof Error ? erro.name : "erro"}`);
  }
}
