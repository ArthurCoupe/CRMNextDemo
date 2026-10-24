import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { Database } from "@/shared/types/database.types";

import { supabaseV2 } from "@/integrations/supabase/client.v2";

import { problemaNaSecao } from "../domain/secao";

export type AreaDoPlaybook = Database["public"]["Enums"]["playbook_area"];

export interface SecaoDoPlaybook {
  readonly id: string;
  readonly area: AreaDoPlaybook;
  readonly title: string;
  readonly content: string;
  readonly sort_order: number;
  readonly updated_at: string;
}

const COLUNAS_DA_SECAO = "id, area, title, content, sort_order, updated_at";

const TETO_DE_SECOES = 200;

export async function listarSecoes(area: AreaDoPlaybook): Promise<readonly SecaoDoPlaybook[]> {
  const { data, error } = await supabaseV2
    .from("playbook_sections")
    .select(COLUNAS_DA_SECAO)
    .eq("area", area)
    .order("sort_order")
    .order("title")
    .limit(TETO_DE_SECOES);

  if (error !== null) throw erroDoBanco(error);
  return (data ?? []) as unknown as SecaoDoPlaybook[];
}

export async function buscarSecoes(termo: string): Promise<readonly SecaoDoPlaybook[]> {
  const termoLimpo = termo.trim();
  if (termoLimpo === "") return [];

  const { data, error } = await supabaseV2.rpc("buscar_secoes_playbook", { p_termo: termoLimpo });

  if (error !== null) throw erroDoBanco(error);
  return data ?? [];
}

export interface DadosDaSecao {
  readonly title: string;
  readonly area: AreaDoPlaybook;
  readonly sortOrder: number;
  readonly content: string;
}

export async function salvarSecao(
  id: string,
  dados: DadosDaSecao,
  updatedAt: string,
): Promise<void> {
  const problema = problemaNaSecao({ titulo: dados.title, ordem: dados.sortOrder });
  if (problema !== null) throw new Error(problema);
  const title = dados.title.trim();

  const { data, error } = await supabaseV2
    .from("playbook_sections")
    .update({ title, area: dados.area, sort_order: dados.sortOrder, content: dados.content })
    .eq("id", id)
    .eq("updated_at", updatedAt)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Alguém editou esta seção enquanto você escrevia. Recarregue e refaça.");
  }
}
