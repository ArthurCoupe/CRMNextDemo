import { supabaseV2 } from "@/integrations/supabase/client.v2";
import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { CampoDoPipeline, RascunhoDeCampo } from "../domain/campos";
import {
  TETO_DE_CAMPOS,
  TETO_DE_ESTAGIOS,
  TETO_DE_MOTIVOS,
  TETO_DE_PIPELINES,
} from "../domain/limites";
import type { EstagioDoPipeline, MotivoDeSaida, Pipeline, TipoDeEstagio } from "../domain/pipeline";

const COLUNAS_DE_PIPELINE = "id, nome, ordem, ativo";
const COLUNAS_DE_ESTAGIO = "id, pipeline_id, nome, ordem, tipo";
const COLUNAS_DE_MOTIVO = "id, pipeline_id, tipo, rotulo, ordem, ativo";
const COLUNAS_DE_CAMPO = "id, pipeline_id, nome, tipo, opcoes, obrigatorio, ordem, ativo";

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n > teto) {
    throw new Error(
      `A lista de ${oQue} passou do teto de ${teto} e pode estar incompleta. ` +
        `Escolher a partir de lista truncada esconde opção válida.`,
    );
  }
}

export async function listarPipelines(incluirArquivados = false): Promise<Pipeline[]> {
  let consulta = supabaseV2.from("pipelines").select(COLUNAS_DE_PIPELINE);
  if (!incluirArquivados) consulta = consulta.eq("ativo", true);
  const { data, error } = await consulta
    .order("ordem")
    .order("nome")
    .limit(TETO_DE_PIPELINES + 1);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_DE_PIPELINES, "pipelines");
  return (data ?? []).map((l) => ({ id: l.id, nome: l.nome, ordem: l.ordem, ativo: l.ativo }));
}

export async function listarEstagios(pipelineId: string): Promise<EstagioDoPipeline[]> {
  const { data, error } = await supabaseV2
    .from("pipeline_stages")
    .select(COLUNAS_DE_ESTAGIO)
    .eq("pipeline_id", pipelineId)
    .order("ordem")
    .limit(TETO_DE_ESTAGIOS + 1);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_DE_ESTAGIOS, "estágios");
  return (data ?? []).map((l) => ({
    id: l.id,
    pipelineId: l.pipeline_id,
    nome: l.nome,
    ordem: l.ordem,
    tipo: l.tipo,
  }));
}

const NOME_DE_PIPELINE_REPETIDO = "Já existe um pipeline com esse nome.";

function paraEstagioDaRpc(e: { id?: string; nome: string; tipo: TipoDeEstagio }) {
  return { id: e.id ?? null, nome: e.nome.trim(), tipo: e.tipo };
}

export async function criarPipeline(dados: {
  nome: string;
  estagios: ReadonlyArray<{ nome: string; tipo: TipoDeEstagio }>;
}): Promise<string> {
  const { data, error } = await supabaseV2.rpc("create_pipeline", {
    p_nome: dados.nome.trim(),
    p_estagios: dados.estagios.map(paraEstagioDaRpc),
  });
  if (error?.code === "23505") throw new Error(NOME_DE_PIPELINE_REPETIDO);
  if (error) throw erroDoBanco(error);
  return data;
}

export async function renomearPipeline(id: string, nome: string): Promise<void> {
  const { data, error } = await supabaseV2
    .from("pipelines")
    .update({ nome: nome.trim() })
    .eq("id", id)
    .select("id");
  if (error?.code === "23505") throw new Error(NOME_DE_PIPELINE_REPETIDO);
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error("Renomear pipeline é do owner e do manager.");
}

export async function arquivarPipeline(id: string, ativo: boolean): Promise<void> {
  const { data, error } = await supabaseV2
    .from("pipelines")
    .update({ ativo })
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error("Arquivar pipeline é do owner e do manager.");
}

export async function apagarPipeline(id: string): Promise<void> {
  const { error } = await supabaseV2.rpc("apagar_pipeline", { p_pipeline_id: id });
  if (error) {
    throw erroDoBanco(
      error.code === "42501"
        ? { ...error, message: "Apagar pipeline é do owner e do manager." }
        : error,
    );
  }
}

export async function salvarEstagios(
  pipelineId: string,
  estagios: ReadonlyArray<{ id?: string; nome: string; tipo: TipoDeEstagio }>,
): Promise<void> {
  const { error } = await supabaseV2.rpc("save_pipeline_stages", {
    p_pipeline_id: pipelineId,
    p_estagios: estagios.map(paraEstagioDaRpc),
  });
  if (error?.code === "23503") {
    throw new Error("Mova as oportunidades desse estágio antes de removê-lo.");
  }
  if (error) throw erroDoBanco(error);
}

function tipoDeMotivo(valor: string): MotivoDeSaida["tipo"] {
  if (valor === "perda" || valor === "descarte") return valor;
  throw new Error(`motivos_de_saida: tipo de motivo desconhecido "${valor}".`);
}

export async function listarMotivos(
  pipelineId: string,
  incluirInativos = false,
): Promise<MotivoDeSaida[]> {
  let consulta = supabaseV2
    .from("motivos_de_saida")
    .select(COLUNAS_DE_MOTIVO)
    .eq("pipeline_id", pipelineId);
  if (!incluirInativos) consulta = consulta.eq("ativo", true);
  const { data, error } = await consulta
    .order("tipo")
    .order("ordem")
    .limit(TETO_DE_MOTIVOS + 1);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_DE_MOTIVOS, "motivos");
  return (data ?? []).map((l) => ({
    id: l.id,
    pipelineId: l.pipeline_id,
    tipo: tipoDeMotivo(l.tipo),
    rotulo: l.rotulo,
    ordem: l.ordem,
    ativo: l.ativo,
  }));
}

const RECUSA_DE_MOTIVO = "Editar motivos é do owner e do manager.";

export async function salvarMotivos(
  pipelineId: string,
  motivos: ReadonlyArray<{
    id?: string;
    tipo: MotivoDeSaida["tipo"];
    rotulo: string;
    ativo: boolean;
  }>,
): Promise<void> {
  const atuais = await listarMotivos(pipelineId, true);
  const mantidos = new Set(motivos.map((m) => m.id).filter((id): id is string => id !== undefined));

  for (const antigo of atuais) {
    if (mantidos.has(antigo.id)) continue;
    const { data, error } = await supabaseV2
      .from("motivos_de_saida")
      .delete()
      .eq("id", antigo.id)
      .select("id");
    if (error?.code === "23503") {
      throw new Error(
        "Este motivo já foi usado em alguma oportunidade e não pode ser apagado. Desative-o em vez de apagar.",
      );
    }
    if (error) throw erroDoBanco(error);
    if ((data ?? []).length === 0) throw new Error(RECUSA_DE_MOTIVO);
  }

  const posicao = { perda: 0, descarte: 0 };
  for (const m of motivos) {
    posicao[m.tipo] += 1;
    const rotulo = m.rotulo.trim();
    const ordem = posicao[m.tipo];
    const { data, error } =
      m.id === undefined
        ? await supabaseV2
            .from("motivos_de_saida")
            .insert({ pipeline_id: pipelineId, tipo: m.tipo, rotulo, ordem, ativo: m.ativo })
            .select("id")
        : await supabaseV2
            .from("motivos_de_saida")
            .update({ rotulo, ordem, ativo: m.ativo })
            .eq("id", m.id)
            .eq("pipeline_id", pipelineId)
            .select("id");
    if (error?.code === "23505") {
      throw new Error(`Já existe um motivo de ${m.tipo} com esse rótulo.`);
    }
    if (error) throw erroDoBanco(error);
    if ((data ?? []).length === 0) throw new Error(RECUSA_DE_MOTIVO);
  }
}

export async function listarCampos(
  pipelineId: string,
  incluirInativos = false,
): Promise<CampoDoPipeline[]> {
  let consulta = supabaseV2
    .from("pipeline_campos")
    .select(COLUNAS_DE_CAMPO)
    .eq("pipeline_id", pipelineId);
  if (!incluirInativos) consulta = consulta.eq("ativo", true);
  const { data, error } = await consulta.order("ordem").limit(TETO_DE_CAMPOS + 1);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_DE_CAMPOS, "campos");
  return (data ?? []).map((l) => ({
    id: l.id,
    pipelineId: l.pipeline_id,
    nome: l.nome,
    tipo: l.tipo,
    opcoes: l.opcoes,
    obrigatorio: l.obrigatorio,
    ordem: l.ordem,
    ativo: l.ativo,
  }));
}

const RECUSA_DE_CAMPO = "Você não pode editar os campos deste pipeline.";

export async function salvarCampos(
  pipelineId: string,
  rascunho: ReadonlyArray<RascunhoDeCampo>,
): Promise<void> {
  const atuais = await listarCampos(pipelineId, true);
  const mantidos = new Set(
    rascunho.map((c) => c.id).filter((id): id is string => id !== undefined),
  );

  for (const antigo of atuais) {
    if (mantidos.has(antigo.id)) continue;
    const { data, error } = await supabaseV2
      .from("pipeline_campos")
      .delete()
      .eq("id", antigo.id)
      .eq("pipeline_id", pipelineId)
      .select("id");
    if (error) throw erroDoBanco(error);
    if ((data ?? []).length === 0) throw new Error(RECUSA_DE_CAMPO);
  }

  for (const c of rascunho) {
    const colunas = {
      nome: c.nome.trim(),
      tipo: c.tipo,
      opcoes: c.opcoes === null ? null : [...c.opcoes],
      obrigatorio: c.obrigatorio,
      ordem: c.ordem,
      ativo: c.ativo,
    };
    const { data, error } =
      c.id === undefined
        ? await supabaseV2
            .from("pipeline_campos")
            .insert({ pipeline_id: pipelineId, ...colunas })
            .select("id")
        : await supabaseV2
            .from("pipeline_campos")
            .update(colunas)
            .eq("id", c.id)
            .eq("pipeline_id", pipelineId)
            .select("id");
    if (error?.code === "23505") {
      throw new Error("Já existe um campo com esse nome neste pipeline.");
    }
    if (error) throw erroDoBanco(error);
    if ((data ?? []).length === 0) throw new Error(RECUSA_DE_CAMPO);
  }
}
