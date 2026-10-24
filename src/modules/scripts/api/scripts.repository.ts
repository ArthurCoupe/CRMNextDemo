import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";
import type { Estagio } from "@/modules/pipeline/domain/stage";
import type { Database } from "@/shared/types/database.types";

import type { CanalDeScript, MomentoDeScript, TipoDeScript } from "../domain/script";

const TETO_DE_SCRIPTS = 200;

const COLUNAS =
  "id, tipo, title, body, nicho, canal, momento, pipeline_stage, sort_order, active, updated_at";

export interface Script {
  readonly id: string;
  readonly tipo: TipoDeScript;
  readonly title: string;
  readonly body: string;
  readonly nicho: string;
  readonly canal: CanalDeScript;
  readonly momento: MomentoDeScript;
  readonly pipelineStage: Estagio | null;
  readonly sortOrder: number;
  readonly active: boolean;
  readonly updatedAt: string;
}

export interface FiltrosDeScript {
  readonly tipo: TipoDeScript;
  readonly nicho?: string;
  readonly canal?: CanalDeScript;
  readonly momento?: MomentoDeScript;
  readonly busca?: string;
}

export interface DadosDeScript {
  readonly tipo: TipoDeScript;
  readonly title: string;
  readonly body: string;
  readonly nicho: string;
  readonly canal: CanalDeScript;
  readonly momento: MomentoDeScript;
  readonly pipelineStage: Estagio | null;
}

export type AlteracaoDeScript = Partial<Omit<DadosDeScript, "pipelineStage">>;

interface LinhaDeScript {
  id: string;
  tipo: TipoDeScript;
  title: string;
  body: string;
  nicho: string;
  canal: CanalDeScript;
  momento: MomentoDeScript;
  pipeline_stage: Estagio | null;
  sort_order: number;
  active: boolean;
  updated_at: string;
}

function paraScript(s: LinhaDeScript): Script {
  return {
    id: s.id,
    tipo: s.tipo,
    title: s.title,
    body: s.body,
    nicho: s.nicho,
    canal: s.canal,
    momento: s.momento,
    pipelineStage: s.pipeline_stage,
    sortOrder: s.sort_order,
    active: s.active,
    updatedAt: s.updated_at,
  };
}

async function buscarScripts(filtros: FiltrosDeScript, termo: string): Promise<readonly Script[]> {
  const { data, error } = await supabaseV2.rpc("buscar_scripts", {
    p_tipo: filtros.tipo,
    p_termo: termo,
    ...(filtros.nicho !== undefined && { p_nicho: filtros.nicho }),
    ...(filtros.canal !== undefined && { p_canal: filtros.canal }),
    ...(filtros.momento !== undefined && { p_momento: filtros.momento }),
  });

  if (error !== null) throw erroDoBanco(error);
  return ((data ?? []) as unknown as LinhaDeScript[]).map(paraScript);
}

export async function listarScripts(filtros: FiltrosDeScript): Promise<readonly Script[]> {
  const termo = filtros.busca?.trim() ?? "";
  if (termo !== "") return buscarScripts(filtros, termo);

  let consulta = supabaseV2
    .from("scripts")
    .select(COLUNAS)
    .eq("tipo", filtros.tipo)
    .eq("active", true);

  if (filtros.nicho !== undefined) consulta = consulta.eq("nicho", filtros.nicho);
  if (filtros.canal !== undefined) consulta = consulta.eq("canal", filtros.canal);
  if (filtros.momento !== undefined) consulta = consulta.eq("momento", filtros.momento);

  const { data, error } = await consulta.order("sort_order").order("title").limit(TETO_DE_SCRIPTS);

  if (error !== null) throw erroDoBanco(error);

  return ((data ?? []) as unknown as LinhaDeScript[]).map(paraScript);
}

export async function listarScriptsDeWhatsApp(): Promise<readonly Script[]> {
  const { data, error } = await supabaseV2
    .from("scripts")
    .select(COLUNAS)
    .eq("canal", "whatsapp")
    .eq("active", true)
    .order("sort_order")
    .order("title")
    .limit(TETO_DE_SCRIPTS);

  if (error !== null) throw erroDoBanco(error);

  return ((data ?? []) as unknown as LinhaDeScript[]).map(paraScript);
}

export async function listarNichos(tipo: TipoDeScript): Promise<readonly string[]> {
  const { data, error } = await supabaseV2
    .from("scripts")
    .select("nicho")
    .eq("tipo", tipo)
    .eq("active", true)
    .limit(TETO_DE_SCRIPTS);

  if (error !== null) throw erroDoBanco(error);

  return [
    ...new Set(((data ?? []) as unknown as Array<{ nicho: string }>).map((s) => s.nicho)),
  ].sort();
}

function nichoOuTodos(nicho: string): string {
  const limpo = nicho.trim();
  return limpo === "" ? "todos" : limpo;
}

export async function criarScript(dados: DadosDeScript): Promise<void> {
  const { data, error } = await supabaseV2
    .from("scripts")
    .insert({
      tipo: dados.tipo,
      title: dados.title,
      body: dados.body,
      nicho: nichoOuTodos(dados.nicho),
      canal: dados.canal,
      momento: dados.momento,
      pipeline_stage: dados.pipelineStage,
    })
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Criar script é do owner e do manager.");
  }
}

export async function atualizarScript(
  id: string,
  dados: AlteracaoDeScript,
  updatedAt: string,
): Promise<void> {
  const alteracao: Pick<
    Database["public"]["Tables"]["scripts"]["Update"],
    "tipo" | "title" | "body" | "nicho" | "canal" | "momento"
  > = {};
  if (dados.tipo !== undefined) alteracao.tipo = dados.tipo;
  if (dados.title !== undefined) alteracao.title = dados.title;
  if (dados.body !== undefined) alteracao.body = dados.body;
  if (dados.nicho !== undefined) alteracao.nicho = nichoOuTodos(dados.nicho);
  if (dados.canal !== undefined) alteracao.canal = dados.canal;
  if (dados.momento !== undefined) alteracao.momento = dados.momento;

  const { data, error } = await supabaseV2
    .from("scripts")
    .update(alteracao)
    .eq("id", id)
    .eq("updated_at", updatedAt)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Alguém editou este script enquanto você escrevia. Recarregue e refaça.");
  }
}

export async function definirSituacaoDoScript(id: string, ativo: boolean): Promise<void> {
  const { data, error } = await supabaseV2
    .from("scripts")
    .update({ active: ativo })
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Arquivar script é do owner e do manager.");
  }
}

export async function apagarScript(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("scripts").delete().eq("id", id).select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "Só owner e manager apagam script. Se ele já foi apagado em outra tela, recarregue a página.",
    );
  }
}

export async function registrarUso(scriptId: string, clienteId?: string): Promise<void> {
  const linha: Database["public"]["Tables"]["script_usage_log"]["Insert"] = {
    script_id: scriptId,
  };
  if (clienteId !== undefined) linha.client_id = clienteId;

  const { error } = await supabaseV2.from("script_usage_log").insert(linha);

  if (error !== null) throw erroDoBanco(error);
}

const JANELA_DE_USOS_RECENTES = 200;

export async function listarMaisUsados(
  tipo: TipoDeScript,
): Promise<readonly { scriptId: string; titulo: string; usos: number }[]> {
  const { data, error } = await supabaseV2
    .from("script_usage_log")
    .select("script_id, scripts!inner(id, title, tipo)")
    .eq("scripts.tipo", tipo)
    .eq("scripts.active", true)
    .order("used_at", { ascending: false })
    .limit(JANELA_DE_USOS_RECENTES);

  if (error !== null) throw erroDoBanco(error);

  const contagem = new Map<string, { titulo: string; usos: number }>();
  for (const linha of (data ?? []) as unknown as Array<{
    script_id: string;
    scripts: { id: string; title: string; tipo: TipoDeScript } | null;
  }>) {
    if (linha.scripts === null) continue;
    const atual = contagem.get(linha.script_id);
    contagem.set(linha.script_id, {
      titulo: linha.scripts.title,
      usos: (atual?.usos ?? 0) + 1,
    });
  }

  return [...contagem.entries()]
    .map(([scriptId, v]) => ({ scriptId, titulo: v.titulo, usos: v.usos }))
    .sort((a, b) => b.usos - a.usos);
}
