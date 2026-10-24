import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/types/database.types";

export type Cliente = SupabaseClient<Database>;

export type PapelDeMensagem = "user" | "model";

export interface MensagemDoHistorico {
  readonly id: string;
  readonly papel: PapelDeMensagem;
  readonly conteudo: string;
  readonly criadaEm: string;
}

export interface ConversaResumo {
  readonly id: string;
  readonly titulo: string | null;
  readonly atualizadaEm: string;
}

export async function lerConversa(
  supabase: Cliente,
  conversaId: string,
  limite: number,
): Promise<readonly MensagemDoHistorico[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, papel, conteudo, created_at")
    .eq("conversation_id", conversaId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error !== null) throw new Error(`ai_messages: ${error.message}`);

  return (data ?? [])
    .map((m) => ({
      id: m.id,
      papel: m.papel as PapelDeMensagem,
      conteudo: m.conteudo,
      criadaEm: m.created_at,
    }))
    .reverse();
}

export async function conversaPertenceAoUsuario(
  supabase: Cliente,
  conversaId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversaId)
    .maybeSingle();
  if (error !== null) throw new Error(`ai_conversations: ${error.message}`);

  return data !== null;
}

export async function criarConversa(
  supabase: Cliente,
  profileId: string,
  titulo: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ profile_id: profileId, titulo })
    .select("id")
    .single();
  if (error !== null) throw new Error(`ai_conversations: ${error.message}`);

  return data.id;
}

export async function gravarMensagem(
  supabase: Cliente,
  conversaId: string,
  papel: PapelDeMensagem,
  conteudo: string,
): Promise<void> {
  const { error } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversaId, papel, conteudo });
  if (error !== null) throw new Error(`ai_messages: ${error.message}`);
}

export async function lerConversasRecentes(
  supabase: Cliente,
  limite: number,
): Promise<readonly ConversaResumo[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, titulo, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (error !== null) throw new Error(`ai_conversations: ${error.message}`);

  return (data ?? []).map((c) => ({ id: c.id, titulo: c.titulo, atualizadaEm: c.updated_at }));
}
