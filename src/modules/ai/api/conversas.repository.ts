import { supabaseV2 } from "@/integrations/supabase/client.v2";
import { erroDoBanco } from "@/shared/lib/erro-do-banco";

import { erroDoTitulo } from "../domain/titulo";

export async function apagarConversa(id: string): Promise<void> {
  const { data, error } = await supabaseV2
    .from("ai_conversations")
    .delete()
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Só quem abriu a conversa pode apagá-la.");
  }
}

export async function renomearConversa(id: string, titulo: string): Promise<void> {
  const problema = erroDoTitulo(titulo);
  if (problema !== null) throw new Error(problema);

  const { data, error } = await supabaseV2
    .from("ai_conversations")
    .update({ titulo: titulo.trim() })
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Só quem abriu a conversa pode renomeá-la.");
  }
}
