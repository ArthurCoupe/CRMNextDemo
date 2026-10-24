import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";
import type { TipoDeAviso } from "../domain/notificacoes";
import { CHAVE_DA_PASSADA, interpretarPassada, type UltimaPassada } from "../domain/passada";

export const LIMITE_DO_HISTORICO = 100;

export interface AvisoEnviado {
  readonly id: string;
  readonly tipo: TipoDeAviso;
  readonly assunto: string;
  readonly para: string;
  readonly enviadoEm: string | null;
  readonly erro: string | null;
  readonly criadoEm: string;
}

export async function lerHistorico(): Promise<readonly AvisoEnviado[]> {
  const { data, error } = await supabaseV2
    .from("notification_log")
    .select("id, tipo, assunto, destinatario_email, enviado_em, erro, criado_em")
    .order("criado_em", { ascending: false })
    .limit(LIMITE_DO_HISTORICO);

  if (error) throw erroDoBanco(error);

  return (data ?? []).map((linha) => ({
    id: linha.id,
    tipo: linha.tipo,
    assunto: linha.assunto,
    para: linha.destinatario_email,
    enviadoEm: linha.enviado_em,
    erro: linha.erro,
    criadoEm: linha.criado_em,
  }));
}

export async function lerDesligados(profileId: string): Promise<readonly TipoDeAviso[]> {
  const { data, error } = await supabaseV2
    .from("notification_preferences")
    .select("tipo")
    .eq("profile_id", profileId)
    .eq("ativo", false);

  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => linha.tipo);
}

export async function definirPreferencia(
  profileId: string,
  tipo: TipoDeAviso,
  ativo: boolean,
): Promise<void> {
  if (ativo) {
    // eslint-disable-next-line no-restricted-syntax
    const { error } = await supabaseV2
      .from("notification_preferences")
      .delete()
      .eq("profile_id", profileId)
      .eq("tipo", tipo);
    if (error) throw erroDoBanco(error);
    return;
  }

  const { data: inserida, error: erroDeInsert } = await supabaseV2
    .from("notification_preferences")
    .insert({ profile_id: profileId, tipo, ativo: false })
    .select("tipo");

  if (erroDeInsert === null) {
    if ((inserida ?? []).length === 0) {
      throw new Error("Não foi possível salvar a preferência.");
    }
    return;
  }

  if (erroDeInsert.code !== "23505") throw erroDoBanco(erroDeInsert);

  const { data: atualizada, error: erroDeUpdate } = await supabaseV2
    .from("notification_preferences")
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("tipo", tipo)
    .select("tipo");

  if (erroDeUpdate) throw erroDoBanco(erroDeUpdate);
  if ((atualizada ?? []).length === 0) {
    throw new Error("Não foi possível salvar a preferência.");
  }
}

export async function lerUltimaPassada(): Promise<UltimaPassada | null> {
  const { data, error } = await supabaseV2
    .from("app_settings")
    .select("value")
    .eq("key", CHAVE_DA_PASSADA)
    .maybeSingle();

  if (error) throw erroDoBanco(error);
  if (data === null) return null;

  const passada = interpretarPassada(data.value);
  if (passada === null) {
    throw new Error("o carimbo da última passada está num formato que a tela não entende");
  }
  return passada;
}
