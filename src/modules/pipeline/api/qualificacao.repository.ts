import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";

import {
  interpretarCatalogo,
  montarCatalogoParaGravar,
  problemaNoCatalogo,
  type CatalogoDeQualificacao,
  type ObjetoJson,
  type PerguntaDoCatalogo,
} from "../domain/qualification";

export interface CatalogoLidoParaEdicao {
  readonly catalogo: CatalogoDeQualificacao;
  readonly bruto: ObjetoJson;
  readonly atualizadoEm: string;
}

export async function lerCatalogoParaEdicao(): Promise<CatalogoLidoParaEdicao> {
  const { data, error } = await supabaseV2
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", "qualification_questions")
    .single();

  if (error) throw erroDoBanco(error);
  const valor = data.value;
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new Error("Catálogo de qualificação ausente ou com formato inválido.");
  }
  return { catalogo: interpretarCatalogo(valor), bruto: valor, atualizadoEm: data.updated_at };
}

export async function salvarCatalogoDeQualificacao(
  lido: CatalogoLidoParaEdicao,
  perguntas: readonly PerguntaDoCatalogo[],
): Promise<void> {
  const problema = problemaNoCatalogo(perguntas);
  if (problema !== null) throw new Error(problema);
  const valor = montarCatalogoParaGravar(lido.bruto, perguntas);
  interpretarCatalogo(valor);

  const { data, error } = await supabaseV2
    .from("app_settings")
    .update({ value: valor })
    .eq("key", "qualification_questions")
    .eq("updated_at", lido.atualizadoEm)
    .select("key");

  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "As perguntas não foram salvas: alguém salvou antes de você, ou a sessão não é de owner. Recarregue a página e refaça.",
    );
  }
}
