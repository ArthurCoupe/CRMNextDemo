import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { Database, Json } from "@/shared/types/database.types";

import { LIMITE_DE_EVENTOS, LIMITE_DO_BOARD, TETO_DO_NUMERO_DO_CAMPO } from "../domain/limites";

import { supabaseV2 } from "@/integrations/supabase/client.v2";
import type { DadosDeAtribuicao } from "../domain/attribution";
import type { Canal } from "../domain/channel";
import type { ValorFechado } from "../domain/closed-value";
import type { TipoDeEvento } from "../domain/event-type";
import type { LinhaDaSemana, LinhaDoFunil } from "../domain/funnel";
import type { LinhaDeImportacao } from "../domain/importacao";
import {
  interpretarCatalogo,
  type CatalogoDeQualificacao,
  type RespostaCongelada,
} from "../domain/qualification";
import type { ValoresDeCampos } from "../domain/campos";
import type { EstagioDoPipeline } from "../domain/pipeline";
import { motivoExigidoPor, type MotivoDeSaidaEscolhido } from "../domain/saida";
import { rotuloDoEstagio, type Estagio } from "../domain/stage";

type LinhaDeNegocio = Database["public"]["Enums"]["business_unit"];
type FrenteDeServico = Database["public"]["Enums"]["service_front"];

export type LinhaDeNegocioDaOportunidade = Exclude<LinhaDeNegocio, "compartilhado">;

const COLUNAS_DE_OPORTUNIDADE =
  "id, name, segment, nicho, stage, stage_changed_at, owner_id, contact_name, " +
  "contact_email, contact_phone, lead_source, channel, referred_by, business_unit, " +
  "expected_fronts, estimated_value, notes, next_followup_at, " +
  "r1_agendada_em, r1_realizada_em, r2_agendada_em, r2_realizada_em, " +
  "motivo_id, motivo_obs, em_nutricao, nutrir_ate, " +
  "utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_url, " +
  "attribution_id, created_at, " +
  "campos, " +
  "pipeline_id, stage_id, pipeline_stages(nome), motivos_de_saida(rotulo), " +
  "profiles(full_name), " +
  "qualification_answers(question_key, option_index, points, is_ko)";

const TETO_DO_TIME = 50;

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n >= teto) {
    throw new Error(
      `A lista de ${oQue} veio no teto de ${teto} e pode estar incompleta. ` +
        `Escolher a partir de lista truncada esconde opção válida.`,
    );
  }
}

type LinhaDeOportunidade = Omit<Database["public"]["Tables"]["opportunities"]["Row"], "campos"> & {
  campos: ValoresDeCampos;
  profiles: { full_name: string } | null;
  pipeline_stages: { nome: string } | null;
  motivos_de_saida: { rotulo: string } | null;
  qualification_answers: ReadonlyArray<{
    question_key: string;
    option_index: number;
    points: number;
    is_ko: boolean;
  }>;
};

export interface OportunidadeListada {
  readonly id: string;
  readonly nome: string;
  readonly segmento: string | null;
  readonly nicho: string | null;
  readonly estagio: Estagio;
  readonly pipelineId: string;
  readonly estagioId: string;
  readonly estagioNome: string;
  readonly estagioMudouEm: string;
  readonly responsavelId: string | null;
  readonly responsavelNome: string | null;
  readonly contatoNome: string | null;
  readonly contatoEmail: string | null;
  readonly contatoTelefone: string | null;
  readonly origem: string | null;
  readonly canal: string | null;
  readonly indicadoPor: string | null;
  readonly linhaDeNegocio: LinhaDeNegocio | null;
  readonly frentesEsperadas: readonly FrenteDeServico[] | null;
  readonly valorEstimado: number | null;
  readonly observacoes: string | null;
  readonly fechadoMrr: number | null;
  readonly fechadoTcv: number | null;
  readonly clienteId: string | null;
  readonly proximoFollowUp: string | null;
  readonly r1AgendadaEm: string | null;
  readonly r1RealizadaEm: string | null;
  readonly r2AgendadaEm: string | null;
  readonly r2RealizadaEm: string | null;
  readonly motivoId: string | null;
  readonly motivoRotulo: string | null;
  readonly motivoObs: string | null;
  readonly emNutricao: boolean;
  readonly nutrirAte: string | null;
  readonly atribuicao: DadosDeAtribuicao;
  readonly attributionId: string | null;
  readonly criadaEm: string;
  readonly campos: ValoresDeCampos;
  readonly respostas: readonly RespostaCongelada[];
}

function paraOportunidade(
  linha: LinhaDeOportunidade,
  fechado: ValorFechado | undefined,
  clienteId: string | null,
): OportunidadeListada {
  return {
    id: linha.id,
    nome: linha.name,
    segmento: linha.segment,
    nicho: linha.nicho,
    estagio: linha.stage,
    pipelineId: linha.pipeline_id,
    estagioId: linha.stage_id,
    estagioNome: linha.pipeline_stages?.nome ?? rotuloDoEstagio(linha.stage),
    estagioMudouEm: linha.stage_changed_at,
    responsavelId: linha.owner_id,
    responsavelNome: linha.profiles?.full_name ?? null,
    contatoNome: linha.contact_name,
    contatoEmail: linha.contact_email,
    contatoTelefone: linha.contact_phone,
    origem: linha.lead_source,
    canal: linha.channel,
    indicadoPor: linha.referred_by,
    linhaDeNegocio: linha.business_unit,
    frentesEsperadas: linha.expected_fronts,
    valorEstimado: linha.estimated_value,
    observacoes: linha.notes,
    fechadoMrr: fechado?.mrr ?? null,
    fechadoTcv: fechado?.tcv ?? null,
    clienteId,
    proximoFollowUp: linha.next_followup_at,
    r1AgendadaEm: linha.r1_agendada_em,
    r1RealizadaEm: linha.r1_realizada_em,
    r2AgendadaEm: linha.r2_agendada_em,
    r2RealizadaEm: linha.r2_realizada_em,
    motivoId: linha.motivo_id,
    motivoRotulo: linha.motivos_de_saida?.rotulo ?? null,
    motivoObs: linha.motivo_obs,
    emNutricao: linha.em_nutricao,
    nutrirAte: linha.nutrir_ate,
    atribuicao: {
      utmSource: linha.utm_source,
      utmMedium: linha.utm_medium,
      utmCampaign: linha.utm_campaign,
      utmContent: linha.utm_content,
      utmTerm: linha.utm_term,
      landingUrl: linha.landing_url,
    },
    attributionId: linha.attribution_id,
    criadaEm: linha.created_at,
    campos: linha.campos,
    respostas: linha.qualification_answers.map((resposta) => ({
      questionKey: resposta.question_key,
      optionIndex: resposta.option_index,
      points: resposta.points,
      isKo: resposta.is_ko,
    })),
  };
}

async function lerFechadosPorOportunidade(): Promise<Map<string, ValorFechado>> {
  const { data, error } = await supabaseV2.rpc("get_closed_by_opportunity");
  if (error) throw erroDoBanco(error);
  return new Map(
    (data ?? []).map((linha) => [
      linha.opportunity_id,
      { mrr: linha.closed_mrr, tcv: linha.closed_tcv },
    ]),
  );
}

const TETO_DE_ORIGENS = 500;

async function lerClientesDasVendas(): Promise<Map<string, string>> {
  const { data, error } = await supabaseV2.rpc("get_origens_dos_clientes");
  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_DE_ORIGENS, "vendas de origem");
  return new Map(linhas.map((linha) => [linha.opportunity_id, linha.client_id]));
}

export async function listarOportunidades(
  pipelineId: string | null,
): Promise<OportunidadeListada[]> {
  let consulta = supabaseV2.from("opportunities").select(COLUNAS_DE_OPORTUNIDADE);
  if (pipelineId !== null) consulta = consulta.eq("pipeline_id", pipelineId);
  const [board, fechados, clientes] = await Promise.all([
    consulta.order("stage_changed_at", { ascending: false }).limit(LIMITE_DO_BOARD),
    lerFechadosPorOportunidade(),
    lerClientesDasVendas(),
  ]);

  if (board.error) throw erroDoBanco(board.error);
  return (board.data as unknown as LinhaDeOportunidade[]).map((linha) =>
    paraOportunidade(linha, fechados.get(linha.id), clientes.get(linha.id) ?? null),
  );
}

export interface CorrecaoDeSaida {
  readonly motivoId?: string;
  readonly obs?: string | null;
}

export async function moverParaEstagio(
  oportunidadeId: string,
  destino: EstagioDoPipeline,
  estagioAtualId: string,
  motivo: MotivoDeSaidaEscolhido | null = null,
): Promise<void> {
  const exigido = motivoExigidoPor(destino.tipo);
  if (exigido !== null && (motivo === null || motivo.tipo !== exigido)) {
    throw new Error(`Mover para "${destino.tipo}" exige o motivo antes de gravar.`);
  }

  const { data, error } = await supabaseV2
    .from("opportunities")
    .update({
      stage_id: destino.id,
      stage: destino.tipo,
      motivo_id: motivo?.motivoId ?? null,
      motivo_obs: motivo?.obs ?? null,
    })
    .eq("id", oportunidadeId)
    .eq("stage_id", estagioAtualId)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length > 0) return;

  const conferencia = await supabaseV2
    .from("opportunities")
    .select("id, stage_id")
    .eq("id", oportunidadeId)
    .maybeSingle();
  if (conferencia.error) throw erroDoBanco(conferencia.error);
  if (conferencia.data !== null && conferencia.data.stage_id !== estagioAtualId) {
    throw new Error("Esta oportunidade já foi movida por outra pessoa. Recarregue o board.");
  }
  throw new Error("Mover a oportunidade de etapa é do owner e do manager.");
}

export interface CamposDeReuniao {
  readonly r1AgendadaEm?: string | null;
  readonly r1RealizadaEm?: string | null;
  readonly r2AgendadaEm?: string | null;
  readonly r2RealizadaEm?: string | null;
}

export async function atualizarDatasDeReuniao(
  oportunidadeId: string,
  campos: CamposDeReuniao,
): Promise<void> {
  const payload: Database["public"]["Tables"]["opportunities"]["Update"] = {};
  if (campos.r1AgendadaEm !== undefined) payload.r1_agendada_em = campos.r1AgendadaEm;
  if (campos.r1RealizadaEm !== undefined) payload.r1_realizada_em = campos.r1RealizadaEm;
  if (campos.r2AgendadaEm !== undefined) payload.r2_agendada_em = campos.r2AgendadaEm;
  if (campos.r2RealizadaEm !== undefined) payload.r2_realizada_em = campos.r2RealizadaEm;

  const { data, error } = await supabaseV2
    .from("opportunities")
    .update(payload)
    .eq("id", oportunidadeId)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Gravar a data de reunião é do owner e do manager.");
  }
}

export interface DadosEditaveisDaOportunidade {
  readonly nome?: string;
  readonly contatoNome?: string | null;
  readonly contatoEmail?: string | null;
  readonly contatoTelefone?: string | null;
  readonly segmento?: string | null;
  readonly nicho?: string | null;
  readonly responsavelId?: string | null;
  readonly proximoFollowup?: string | null;
  readonly canal?: Canal | null;
  readonly linhaDeNegocio?: LinhaDeNegocioDaOportunidade | null;
  readonly valorEstimado?: number | null;
  readonly origem?: string | null;
  readonly indicadoPor?: string | null;
  readonly observacoes?: string | null;
  readonly frentesEsperadas?: readonly FrenteDeServico[];
  readonly campos?: ValoresDeCampos;
}

export async function atualizarDadosDaOportunidade(
  id: string,
  campos: DadosEditaveisDaOportunidade,
): Promise<void> {
  const vazioVirandoNulo = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim();

  if (campos.nome !== undefined && campos.nome.trim() === "") {
    throw new Error("O nome da oportunidade não pode ficar em branco.");
  }
  if (campos.valorEstimado !== undefined && campos.valorEstimado !== null) {
    if (!Number.isFinite(campos.valorEstimado)) {
      throw new Error("O valor estimado precisa ser um número.");
    }
    if (Math.round(Math.abs(campos.valorEstimado) * 100) / 100 >= TETO_DO_NUMERO_DO_CAMPO) {
      throw new Error("O valor estimado passa do limite de R$ 9.999.999.999,99.");
    }
  }

  const alteracao: Pick<
    Database["public"]["Tables"]["opportunities"]["Update"],
    | "name"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
    | "segment"
    | "nicho"
    | "owner_id"
    | "next_followup_at"
    | "channel"
    | "business_unit"
    | "campos"
    | "estimated_value"
    | "lead_source"
    | "referred_by"
    | "notes"
    | "expected_fronts"
  > = {};
  if (campos.nome !== undefined) alteracao.name = campos.nome.trim();
  if (campos.contatoNome !== undefined)
    alteracao.contact_name = vazioVirandoNulo(campos.contatoNome) ?? null;
  if (campos.contatoEmail !== undefined)
    alteracao.contact_email = vazioVirandoNulo(campos.contatoEmail) ?? null;
  if (campos.contatoTelefone !== undefined)
    alteracao.contact_phone = vazioVirandoNulo(campos.contatoTelefone) ?? null;
  if (campos.segmento !== undefined) alteracao.segment = vazioVirandoNulo(campos.segmento) ?? null;
  if (campos.nicho !== undefined) alteracao.nicho = vazioVirandoNulo(campos.nicho) ?? null;
  if (campos.responsavelId !== undefined) alteracao.owner_id = campos.responsavelId;
  if (campos.proximoFollowup !== undefined)
    alteracao.next_followup_at = vazioVirandoNulo(campos.proximoFollowup) ?? null;
  if (campos.canal !== undefined) alteracao.channel = campos.canal;
  if (campos.linhaDeNegocio !== undefined) alteracao.business_unit = campos.linhaDeNegocio;
  if (campos.campos !== undefined) alteracao.campos = campos.campos;
  if (campos.valorEstimado !== undefined) alteracao.estimated_value = campos.valorEstimado;
  if (campos.origem !== undefined) alteracao.lead_source = vazioVirandoNulo(campos.origem) ?? null;
  if (campos.indicadoPor !== undefined)
    alteracao.referred_by = vazioVirandoNulo(campos.indicadoPor) ?? null;
  if (campos.observacoes !== undefined)
    alteracao.notes = vazioVirandoNulo(campos.observacoes) ?? null;
  if (campos.frentesEsperadas !== undefined)
    alteracao.expected_fronts = [...campos.frentesEsperadas];

  if (Object.keys(alteracao).length === 0) return;

  const { data, error } = await supabaseV2
    .from("opportunities")
    .update(alteracao)
    .eq("id", id)
    .select("id");

  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Editar os dados da oportunidade é do owner e do manager.");
  }
}

export async function corrigirMotivoDeSaida(
  oportunidadeId: string,
  estagioAtualId: string,
  correcao: CorrecaoDeSaida,
): Promise<void> {
  const alteracao: Pick<
    Database["public"]["Tables"]["opportunities"]["Update"],
    "motivo_id" | "motivo_obs"
  > = {};
  if (correcao.motivoId !== undefined) alteracao.motivo_id = correcao.motivoId;
  if (correcao.obs !== undefined) alteracao.motivo_obs = correcao.obs;

  if (Object.keys(alteracao).length === 0) return;

  const { data, error } = await supabaseV2
    .from("opportunities")
    .update(alteracao)
    .eq("id", oportunidadeId)
    .eq("stage_id", estagioAtualId)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "O motivo não foi corrigido: ou corrigir é do owner e do manager, ou a oportunidade saiu desse estágio enquanto a ficha estava aberta. Feche e reabra a ficha para ver onde ela está.",
    );
  }
}

export interface CamposDeNutricao {
  readonly emNutricao?: boolean;
  readonly nutrirAte?: string | null;
}

export async function atualizarNutricao(
  oportunidadeId: string,
  campos: CamposDeNutricao,
): Promise<void> {
  const payload: Database["public"]["Tables"]["opportunities"]["Update"] = {};
  if (campos.emNutricao !== undefined) payload.em_nutricao = campos.emNutricao;
  if (campos.nutrirAte !== undefined) payload.nutrir_ate = campos.nutrirAte;

  const { data, error } = await supabaseV2
    .from("opportunities")
    .update(payload)
    .eq("id", oportunidadeId)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Gravar a nutrição é do owner e do manager.");
  }
}

export async function apagarOportunidade(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("opportunities").delete().eq("id", id).select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "A oportunidade não foi apagada: apagar é do owner e do manager, ou ela já foi apagada em outra tela. Recarregue o board para conferir.",
    );
  }
}

export interface DadosDeNovaOportunidade {
  readonly nome: string;
  readonly segmento?: string | null;
  readonly nicho?: string | null;
  readonly contatoNome?: string | null;
  readonly contatoEmail?: string | null;
  readonly contatoTelefone?: string | null;
  readonly canal?: string | null;
  readonly linhaDeNegocio?: LinhaDeNegocio | null;
  readonly responsavelId?: string | null;
  readonly proximoFollowUp?: string | null;
  readonly pipelineId: string;
  readonly estagioId?: string | null;
  readonly campos?: ValoresDeCampos;
}

export async function criarOportunidade(dados: DadosDeNovaOportunidade): Promise<string> {
  const { data, error } = await supabaseV2
    .from("opportunities")
    .insert({
      pipeline_id: dados.pipelineId,
      stage_id: dados.estagioId ?? undefined,
      name: dados.nome,
      segment: dados.segmento ?? null,
      nicho: dados.nicho ?? null,
      contact_name: dados.contatoNome ?? null,
      contact_email: dados.contatoEmail ?? null,
      contact_phone: dados.contatoTelefone ?? null,
      channel: (dados.canal ?? null) as Database["public"]["Enums"]["acquisition_channel"] | null,
      business_unit: dados.linhaDeNegocio ?? null,
      owner_id: dados.responsavelId ?? null,
      next_followup_at: dados.proximoFollowUp ?? null,
      campos: dados.campos,
    })
    .select("id")
    .single();

  if (error) throw erroDoBanco(error);
  return data.id;
}

export interface ResultadoDaLinha {
  readonly numero: number;
  readonly acao: "nova" | "atualiza" | "erro";
  readonly motivo: string | null;
  readonly oportunidadeId: string | null;
  readonly aviso?: string;
}

function paraLinhaDoJsonb(linha: LinhaDeImportacao, arquivo: string): Record<string, Json> {
  const d = linha.dados;
  return {
    numero: linha.numero,
    arquivo,
    ...(Object.keys(linha.campos).length > 0 ? { campos: { ...linha.campos } } : {}),
    nome: d.nome,
    contato: d.contato,
    telefone: d.telefone,
    telefone_normalizado: d.telefone_normalizado,
    email: d.email,
    segmento: d.segmento,
    nicho: d.nicho,
    canal: d.canal,
    bu: d.bu,
    responsavel: d.responsavel,
    valor_estimado: d.valor_estimado,
    origem: d.origem,
    indicado_por: d.indicado_por,
    observacoes: d.observacoes,
    frentes: d.frentes ? [...d.frentes] : null,
  };
}

export async function importarOportunidades(
  pipelineId: string,
  linhas: readonly LinhaDeImportacao[],
  previa: boolean,
  arquivo: string,
): Promise<ResultadoDaLinha[]> {
  const validas = linhas.filter((linha) => linha.erros.length === 0);
  const resultados = new Map<number, ResultadoDaLinha>();

  for (const linha of linhas) {
    if (linha.erros.length === 0) continue;
    resultados.set(linha.numero, {
      numero: linha.numero,
      acao: "erro",
      motivo: linha.erros[0] ?? "linha inválida",
      oportunidadeId: null,
    });
  }

  if (validas.length > 0) {
    const { data, error } = await supabaseV2.rpc("import_opportunities", {
      p_pipeline_id: pipelineId,
      p_linhas: validas.map((linha) => paraLinhaDoJsonb(linha, arquivo)),
      p_previa: previa,
    });
    if (error) throw erroDoBanco(error);

    for (const linha of data ?? []) {
      if (linha.acao === "nova" || linha.acao === "atualiza") {
        resultados.set(linha.linha, {
          numero: linha.linha,
          acao: linha.acao,
          motivo: linha.motivo,
          oportunidadeId: linha.opportunity_id,
          ...(linha.aviso ? { aviso: linha.aviso } : {}),
        });
      } else if (linha.acao === "erro") {
        resultados.set(linha.linha, {
          numero: linha.linha,
          acao: "erro",
          motivo: linha.motivo,
          oportunidadeId: null,
        });
      } else {
        resultados.set(linha.linha, {
          numero: linha.linha,
          acao: "erro",
          motivo: `ação desconhecida do banco: "${linha.acao}"`,
          oportunidadeId: null,
        });
      }
    }
  }

  return [...resultados.values()].sort((a, b) => a.numero - b.numero);
}

export interface AlvoDoLote {
  readonly id: string;
  readonly stageId: string;
}

export interface AcaoEmLote {
  readonly ownerId?: string;
  readonly estagioId?: string;
  readonly motivoId?: string;
  readonly motivoObs?: string;
  readonly campos?: ValoresDeCampos;
}

export async function atualizarEmLote(
  alvos: readonly AlvoDoLote[],
  acao: AcaoEmLote,
): Promise<number> {
  const args: Database["public"]["Functions"]["bulk_update_opportunities"]["Args"] = {
    p_alvos: alvos.map((alvo) => ({ id: alvo.id, stage_id: alvo.stageId })),
  };
  if (acao.ownerId !== undefined) args.p_owner_id = acao.ownerId;
  if (acao.estagioId !== undefined) args.p_estagio_id = acao.estagioId;
  if (acao.motivoId !== undefined) args.p_motivo_id = acao.motivoId;
  if (acao.motivoObs !== undefined) args.p_motivo_obs = acao.motivoObs;
  if (acao.campos !== undefined) args.p_campos = acao.campos;

  const { data, error } = await supabaseV2.rpc("bulk_update_opportunities", args);
  if (error) throw erroDoBanco(error);
  const alteradas = data ?? 0;
  if (alteradas === 0) {
    throw new Error("Nenhuma oportunidade foi alterada. Recarregue o board.");
  }
  return alteradas;
}

export async function carregarCatalogo(): Promise<CatalogoDeQualificacao> {
  const { data, error } = await supabaseV2
    .from("app_settings")
    .select("value")
    .eq("key", "qualification_questions")
    .single();

  if (error) throw erroDoBanco(error);
  return interpretarCatalogo(data.value);
}

export interface RespostaParaGravar extends RespostaCongelada {
  readonly catalogVersion: number;
}

export async function responderPergunta(
  oportunidadeId: string,
  resposta: RespostaParaGravar,
  respondidoPor: string | null,
): Promise<void> {
  const { error } = await supabaseV2.from("qualification_answers").upsert(
    {
      opportunity_id: oportunidadeId,
      question_key: resposta.questionKey,
      option_index: resposta.optionIndex,
      points: resposta.points,
      is_ko: resposta.isKo,
      catalog_version: resposta.catalogVersion,
      answered_by: respondidoPor,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "opportunity_id,question_key" },
  );
  if (error) throw erroDoBanco(error);
}

export interface EventoDaOportunidade {
  readonly id: string;
  readonly tipo: TipoDeEvento;
  readonly deEstagio: Estagio | null;
  readonly paraEstagio: Estagio | null;
  readonly conteudo: string | null;
  readonly autorId: string | null;
  readonly autorNome: string | null;
  readonly editadoEm: string | null;
  readonly editadoPorNome: string | null;
  readonly conteudoOriginal: string | null;
  readonly correcoes: readonly CorrecaoDaNota[];
  readonly criadoEm: string;
}

export interface CorrecaoDaNota {
  readonly id: string;
  readonly antes: string | null;
  readonly depois: string;
  readonly corrigidoEm: string;
  readonly corrigidoPorNome: string | null;
}

const TETO_DE_CORRECOES_DA_NOTA = 50;

export async function listarEventos(oportunidadeId: string): Promise<EventoDaOportunidade[]> {
  const { data, error } = await supabaseV2
    .from("opportunity_events")
    .select(
      "id, event_type, from_stage, to_stage, content, actor_id, editado_em, conteudo_original, created_at, " +
        "profiles!opportunity_events_actor_id_fkey(full_name), " +
        "editor:profiles!opportunity_events_editado_por_fkey(full_name), " +
        "correcoes_de_nota(id, antes, depois, corrigido_em, autor:profiles!correcoes_de_nota_corrigido_por_fkey(full_name))",
    )
    .eq("opportunity_id", oportunidadeId)
    .order("created_at", { ascending: false })
    .limit(LIMITE_DE_EVENTOS)
    .order("corrigido_em", { referencedTable: "correcoes_de_nota", ascending: false })
    .limit(TETO_DE_CORRECOES_DA_NOTA, { referencedTable: "correcoes_de_nota" });

  if (error) throw erroDoBanco(error);
  return (
    data as unknown as Array<{
      id: string;
      event_type: TipoDeEvento;
      from_stage: Estagio | null;
      to_stage: Estagio | null;
      content: string | null;
      actor_id: string | null;
      editado_em: string | null;
      conteudo_original: string | null;
      created_at: string;
      profiles: { full_name: string } | null;
      editor: { full_name: string } | null;
      correcoes_de_nota: Array<{
        id: string;
        antes: string | null;
        depois: string;
        corrigido_em: string;
        autor: { full_name: string } | null;
      }> | null;
    }>
  ).map((linha) => ({
    id: linha.id,
    tipo: linha.event_type,
    deEstagio: linha.from_stage,
    paraEstagio: linha.to_stage,
    conteudo: linha.content,
    autorId: linha.actor_id,
    autorNome: linha.profiles?.full_name ?? null,
    editadoEm: linha.editado_em,
    editadoPorNome: linha.editor?.full_name ?? null,
    conteudoOriginal: linha.conteudo_original,
    correcoes: (linha.correcoes_de_nota ?? []).map((c) => ({
      id: c.id,
      antes: c.antes,
      depois: c.depois,
      corrigidoEm: c.corrigido_em,
      corrigidoPorNome: c.autor?.full_name ?? null,
    })),
    criadoEm: linha.created_at,
  }));
}

export type TipoRegistravel = Exclude<TipoDeEvento, "stage_change">;

export async function registrarToque(
  oportunidadeId: string,
  tipo: TipoRegistravel,
  texto: string,
): Promise<void> {
  const { error } = await supabaseV2.from("opportunity_events").insert({
    opportunity_id: oportunidadeId,
    event_type: tipo,
    content: texto,
  });
  if (error) throw erroDoBanco(error);
}

export async function corrigirTextoDoEvento(
  eventoId: string,
  texto: string,
  editadoEmLido: string | null,
): Promise<void> {
  const { data, error } =
    editadoEmLido === null
      ? await supabaseV2
          .from("opportunity_events")
          .update({ content: texto })
          .eq("id", eventoId)
          .is("editado_em", null)
          .select("id")
      : await supabaseV2
          .from("opportunity_events")
          .update({ content: texto })
          .eq("id", eventoId)
          .eq("editado_em", editadoEmLido)
          .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "A nota não foi corrigida: ela mudou em outra tela, ou corrigir é de quem escreveu, do owner e do manager (mudança de etapa não se corrige).",
    );
  }
}

export interface ToqueDeAtribuicao extends DadosDeAtribuicao {
  readonly attributionId: string;
  readonly criadoEm: string;
}

export type ResultadoDoVinculo =
  | { readonly status: "vinculado"; readonly toque: ToqueDeAtribuicao }
  | { readonly status: "nao_encontrado" }
  | { readonly status: "ja_vinculado" };

export async function vincularRef(
  oportunidadeId: string,
  attributionId: string,
): Promise<ResultadoDoVinculo> {
  const { data, error } = await supabaseV2.rpc("link_attribution", {
    p_opportunity_id: oportunidadeId,
    p_attribution_id: attributionId,
  });
  if (error) throw erroDoBanco(error);

  const bruto = data as {
    status: "vinculado" | "nao_encontrado" | "ja_vinculado";
    toque?: {
      attribution_id: string;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_content: string | null;
      utm_term: string | null;
      landing_url: string | null;
      created_at: string;
    };
  };

  if (bruto.status !== "vinculado") return { status: bruto.status };
  if (bruto.toque === undefined) {
    throw new Error("Resposta inesperada de link_attribution: vinculado sem toque.");
  }
  return {
    status: "vinculado",
    toque: {
      attributionId: bruto.toque.attribution_id,
      utmSource: bruto.toque.utm_source,
      utmMedium: bruto.toque.utm_medium,
      utmCampaign: bruto.toque.utm_campaign,
      utmContent: bruto.toque.utm_content,
      utmTerm: bruto.toque.utm_term,
      landingUrl: bruto.toque.landing_url,
      criadoEm: bruto.toque.created_at,
    },
  };
}

export interface ResponsavelParaSelecao {
  readonly id: string;
  readonly nome: string;
  readonly ativo: boolean;
}

const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listarResponsaveis(
  responsavelAtualId?: string | null,
): Promise<ResponsavelParaSelecao[]> {
  const titular =
    typeof responsavelAtualId === "string" && FORMATO_DE_UUID.test(responsavelAtualId)
      ? responsavelAtualId
      : null;

  let consulta = supabaseV2.from("profiles").select("id, full_name, active");
  consulta =
    titular === null ? consulta.eq("active", true) : consulta.or(`active.eq.true,id.eq.${titular}`);

  const { data, error } = await consulta.order("full_name").limit(TETO_DO_TIME);

  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as Array<{ id: string; full_name: string; active: boolean }>;
  recusaSeTruncou(linhas.length, TETO_DO_TIME, "responsáveis");
  return linhas.map((perfil) => ({
    id: perfil.id,
    nome: perfil.full_name,
    ativo: perfil.active,
  }));
}

export async function lerFunilPorCanal(desde: string | null = null): Promise<LinhaDoFunil[]> {
  const { data, error } = await supabaseV2.rpc("get_funnel_by_channel", {
    p_desde: desde ?? undefined,
  });
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    canal: linha.canal,
    estagio: linha.estagio,
    oportunidades: linha.oportunidades,
    oportunidadesNoCanal: linha.oportunidades_no_canal,
  }));
}

export async function lerAtividadeSemanal(desde: string | null = null): Promise<LinhaDaSemana[]> {
  const { data, error } = await supabaseV2.rpc("get_weekly_activity", {
    p_desde: desde ?? undefined,
  });
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    semana: linha.semana,
    responsavelId: linha.responsavel_id,
    responsavel: linha.responsavel,
    toques: linha.toques,
    r1Marcadas: linha.r1_marcadas,
    r1DistintasNaSemana: linha.r1_distintas_na_semana,
  }));
}

export interface LinhaDoMix {
  readonly nicho: string;
  readonly tier: string;
  readonly canal: string;
  readonly oportunidades: number;
}

export async function lerMixDeOportunidades(): Promise<LinhaDoMix[]> {
  const { data, error } = await supabaseV2.rpc("get_opportunity_mix");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    nicho: linha.nicho,
    tier: linha.tier,
    canal: linha.canal,
    oportunidades: linha.oportunidades,
  }));
}

export interface LinhaDeCampanha {
  readonly campanha: string;
  readonly origem: string;
  readonly canal: string;
  readonly contratos: number;
  readonly cancelados: number;
}

export async function lerFechamentosPorCampanha(): Promise<LinhaDeCampanha[]> {
  const { data, error } = await supabaseV2.rpc("get_closings_by_campaign");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    campanha: linha.campanha,
    origem: linha.origem,
    canal: linha.canal,
    contratos: linha.contratos,
    cancelados: linha.cancelados,
  }));
}

export interface PrimeiroContatoDaOportunidade {
  readonly oportunidadeId: string;
  readonly venceEm: string | null;
  readonly primeiroToqueEm: string | null;
}

export async function lerPrimeiroContato(
  ids: readonly string[],
): Promise<PrimeiroContatoDaOportunidade[]> {
  const { data, error } = await supabaseV2.rpc("get_primeiro_contato", { p_ids: [...ids] });
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    oportunidadeId: linha.opportunity_id,
    venceEm: linha.vence_em,
    primeiroToqueEm: linha.primeiro_toque_em,
  }));
}

export interface LinhaDoPrimeiroContato {
  readonly canal: string;
  readonly novos: number;
  readonly contatados: number;
  readonly medianaMin: number | null;
  readonly comPrazoMedido: number;
  readonly noPrazo: number;
}

export async function lerTempoAtePrimeiroContato(
  desde: string | null = null,
): Promise<LinhaDoPrimeiroContato[]> {
  const { data, error } = await supabaseV2.rpc("get_tempo_ate_primeiro_contato", {
    p_desde: desde ?? undefined,
  });
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    canal: linha.canal,
    novos: linha.novos,
    contatados: linha.contatados,
    medianaMin: linha.mediana_min,
    comPrazoMedido: linha.com_prazo_medido,
    noPrazo: linha.no_prazo,
  }));
}
