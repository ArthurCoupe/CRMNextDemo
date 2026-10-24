import { podeLerContratosDoCliente, type ContextoDeAcesso } from "@/modules/clients/domain/access";
import type {
  EtapaDaJornada,
  ItemDaJornada,
  Jornada,
} from "@/modules/onboarding/domain/onboarding";
import {
  interpretarCatalogo,
  type CatalogoDeQualificacao,
  type RespostaCongelada,
} from "@/modules/pipeline/domain/qualification";
import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { Database } from "@/shared/types/database.types";

import { supabaseV2 } from "@/integrations/supabase/client.v2";
import {
  LIMITE_DE_EVENTOS,
  LIMITE_DE_REUNIOES_ANTERIORES,
  LIMITE_DE_TAREFAS,
  type ClienteDaFicha,
  type ContratoDaFicha,
  type DadosDaPreparacao,
  type EventoDaFicha,
  type OportunidadeDaFicha,
  type ReuniaoAnterior,
  type TarefaDaFicha,
} from "../domain/preparacao";
import type { Reuniao } from "./meetings.repository";

type Linha<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

const LIMITE_DE_RESPOSTAS = 50;
const LIMITE_DE_CONTRATOS = 50;

const COLUNAS_DA_OPORTUNIDADE =
  "id, name, segment, nicho, owner_id, contact_name, contact_email, contact_phone, " +
  "lead_source, channel, estimated_value, next_followup_at, " +
  "r1_agendada_em, r1_realizada_em, r2_agendada_em, r2_realizada_em, " +
  "pipeline_stages(nome), profiles(full_name)";

const COLUNAS_DO_EVENTO =
  "id, event_type, content, created_at, profiles!opportunity_events_actor_id_fkey(full_name)";

const COLUNAS_DA_RESPOSTA = "question_key, option_index, points, is_ko, catalog_version";

const COLUNAS_DO_CLIENTE =
  "id, name, status, segment, nicho, contact_name, contact_email, contact_phone, " +
  "owner_id, signed_at, confidencial, profiles(full_name)";

const COLUNAS_DO_CONTRATO =
  "id, name, contract_type, business_unit, monthly_value, total_value, billing_months, " +
  "start_date, status";

const COLUNAS_DA_JORNADA = `
  id, client_id, template_versao, iniciada_em, concluida_em,
  cliente:clients ( name ),
  onboarding_phases (
    id, ordem, nome, descricao, periodo, responsavel, liberada_em,
    onboarding_tasks ( id, ordem, titulo, papel, deadline_days, internal_task_id, concluida_em )
  )
`;

const COLUNAS_DA_TAREFA =
  "id, title, due_date, col, responsavel:profiles!internal_tasks_assignee_id_fkey ( full_name )";

const COLUNAS_DA_REUNIAO_ANTERIOR = "id, titulo, tipo, starts_at, notas";

type OportunidadeCrua = Pick<
  Linha<"opportunities">,
  | "id"
  | "name"
  | "segment"
  | "nicho"
  | "contact_name"
  | "contact_email"
  | "contact_phone"
  | "lead_source"
  | "channel"
  | "estimated_value"
  | "next_followup_at"
  | "r1_agendada_em"
  | "r1_realizada_em"
  | "r2_agendada_em"
  | "r2_realizada_em"
> & {
  pipeline_stages: { nome: string } | null;
  profiles: { full_name: string } | null;
};

type EventoCru = Pick<Linha<"opportunity_events">, "id" | "content" | "created_at"> & {
  event_type: EventoDaFicha["tipo"];
  profiles: { full_name: string } | null;
};

type RespostaCrua = Pick<
  Linha<"qualification_answers">,
  "question_key" | "option_index" | "points" | "is_ko"
>;

type ClienteCru = Pick<
  Linha<"clients">,
  | "id"
  | "name"
  | "status"
  | "segment"
  | "nicho"
  | "contact_name"
  | "contact_email"
  | "contact_phone"
  | "owner_id"
  | "signed_at"
  | "confidencial"
> & { profiles: { full_name: string } | null };

type ContratoCru = Pick<
  Linha<"contracts">,
  | "id"
  | "name"
  | "contract_type"
  | "business_unit"
  | "monthly_value"
  | "total_value"
  | "billing_months"
  | "start_date"
>;

interface JornadaCrua {
  id: string;
  client_id: string;
  template_versao: number;
  iniciada_em: string;
  concluida_em: string | null;
  cliente: { name: string } | null;
  onboarding_phases: {
    id: string;
    ordem: number;
    nome: string;
    descricao: string;
    periodo: string;
    responsavel: string;
    liberada_em: string | null;
    onboarding_tasks: {
      id: string;
      ordem: number;
      titulo: string;
      papel: string;
      deadline_days: number;
      internal_task_id: string | null;
      concluida_em: string | null;
    }[];
  }[];
}

type TarefaCrua = Pick<Linha<"internal_tasks">, "id" | "title" | "due_date"> & {
  responsavel: { full_name: string } | null;
};

type ReuniaoAnteriorCrua = Pick<
  Linha<"meetings">,
  "id" | "titulo" | "tipo" | "starts_at" | "notas"
>;

export async function lerPreparacao(
  reuniao: Pick<Reuniao, "id" | "startsAt" | "oportunidadeId" | "clienteId">,
  contexto: ContextoDeAcesso,
): Promise<DadosDaPreparacao> {
  const { oportunidadeId, clienteId } = reuniao;

  const [
    oportunidade,
    eventos,
    respostas,
    catalogo,
    cliente,
    jornada,
    tarefas,
    reunioesAnteriores,
  ] = await Promise.all([
    oportunidadeId === null ? null : lerOportunidade(oportunidadeId),
    oportunidadeId === null ? [] : lerEventos(oportunidadeId),
    oportunidadeId === null ? [] : lerRespostas(oportunidadeId),
    oportunidadeId === null ? null : lerCatalogo(),
    clienteId === null ? null : lerCliente(clienteId),
    clienteId === null ? null : lerJornadaDoCliente(clienteId),
    clienteId === null ? [] : lerTarefasAbertas(clienteId),
    lerReunioesAnteriores(reuniao),
  ]);

  const contratos =
    cliente !== null && podeLerContratosDoCliente(contexto, cliente.responsavelId)
      ? await lerContratosAtivos(cliente.id)
      : null;

  return {
    oportunidadeId,
    oportunidade,
    eventos,
    respostas,
    catalogo,
    clienteId,
    cliente,
    contratos,
    jornada,
    tarefas,
    reunioesAnteriores,
  };
}

async function lerOportunidade(id: string): Promise<OportunidadeDaFicha | null> {
  const { data, error } = await supabaseV2
    .from("opportunities")
    .select(COLUNAS_DA_OPORTUNIDADE)
    .eq("id", id)
    .maybeSingle();
  if (error !== null) throw erroDoBanco(error);
  if (data === null) return null;
  const o = data as unknown as OportunidadeCrua;
  return {
    id: o.id,
    nome: o.name,
    segmento: o.segment,
    nicho: o.nicho,
    estagioNome: o.pipeline_stages?.nome ?? null,
    responsavelNome: o.profiles?.full_name ?? null,
    contatoNome: o.contact_name,
    contatoEmail: o.contact_email,
    contatoTelefone: o.contact_phone,
    origem: o.lead_source,
    canal: o.channel,
    valorEstimado: o.estimated_value,
    proximoFollowUp: o.next_followup_at,
    r1AgendadaEm: o.r1_agendada_em,
    r1RealizadaEm: o.r1_realizada_em,
    r2AgendadaEm: o.r2_agendada_em,
    r2RealizadaEm: o.r2_realizada_em,
  };
}

async function lerEventos(oportunidadeId: string): Promise<readonly EventoDaFicha[]> {
  const { data, error } = await supabaseV2
    .from("opportunity_events")
    .select(COLUNAS_DO_EVENTO)
    .eq("opportunity_id", oportunidadeId)
    .neq("event_type", "stage_change")
    .order("created_at", { ascending: false })
    .order("id")
    .limit(LIMITE_DE_EVENTOS + 1);
  if (error !== null) throw erroDoBanco(error);
  return ((data ?? []) as unknown as EventoCru[]).map((e) => ({
    id: e.id,
    tipo: e.event_type,
    conteudo: e.content,
    autorNome: e.profiles?.full_name ?? null,
    criadoEm: e.created_at,
  }));
}

async function lerRespostas(oportunidadeId: string): Promise<readonly RespostaCongelada[]> {
  const { data, error } = await supabaseV2
    .from("qualification_answers")
    .select(COLUNAS_DA_RESPOSTA)
    .eq("opportunity_id", oportunidadeId)
    .limit(LIMITE_DE_RESPOSTAS);
  if (error !== null) throw erroDoBanco(error);
  return ((data ?? []) as unknown as RespostaCrua[]).map((r) => ({
    questionKey: r.question_key,
    optionIndex: r.option_index,
    points: r.points,
    isKo: r.is_ko,
  }));
}

async function lerCatalogo(): Promise<CatalogoDeQualificacao> {
  const { data, error } = await supabaseV2
    .from("app_settings")
    .select("value")
    .eq("key", "qualification_questions")
    .single();
  if (error !== null) throw erroDoBanco(error);
  return interpretarCatalogo(data.value);
}

async function lerCliente(id: string): Promise<ClienteDaFicha | null> {
  const { data, error } = await supabaseV2
    .from("clients")
    .select(COLUNAS_DO_CLIENTE)
    .eq("id", id)
    .maybeSingle();
  if (error !== null) throw erroDoBanco(error);
  if (data === null) return null;
  const c = data as unknown as ClienteCru;
  return {
    id: c.id,
    nome: c.name,
    status: c.status,
    segmento: c.segment,
    nicho: c.nicho,
    contatoNome: c.contact_name,
    contatoEmail: c.contact_email,
    contatoTelefone: c.contact_phone,
    responsavelId: c.owner_id,
    responsavelNome: c.profiles?.full_name ?? null,
    assinadoEm: c.signed_at,
    confidencial: c.confidencial,
  };
}

async function lerContratosAtivos(clienteId: string): Promise<readonly ContratoDaFicha[]> {
  const { data, error } = await supabaseV2
    .from("contracts")
    .select(COLUNAS_DO_CONTRATO)
    .eq("client_id", clienteId)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(LIMITE_DE_CONTRATOS);
  if (error !== null) throw erroDoBanco(error);
  return ((data ?? []) as unknown as ContratoCru[]).map((k) => ({
    id: k.id,
    nome: k.name,
    tipo: k.contract_type,
    linhaDeNegocio: k.business_unit,
    valorMensal: k.monthly_value,
    valorTotal: k.total_value,
    mesesDeCobranca: k.billing_months,
    inicio: k.start_date,
  }));
}

async function lerJornadaDoCliente(clienteId: string): Promise<Jornada | null> {
  const { data, error } = await supabaseV2
    .from("onboarding_journeys")
    .select(COLUNAS_DA_JORNADA)
    .eq("client_id", clienteId)
    .order("concluida_em", { ascending: false, nullsFirst: true })
    .order("iniciada_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error !== null) throw erroDoBanco(error);
  if (data === null) return null;
  const j = data as unknown as JornadaCrua;
  const etapas: EtapaDaJornada[] = [...(j.onboarding_phases ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .map((f) => ({
      id: f.id,
      ordem: f.ordem,
      nome: f.nome,
      descricao: f.descricao,
      periodo: f.periodo,
      responsavel: f.responsavel,
      liberadaEm: f.liberada_em,
      itens: [...(f.onboarding_tasks ?? [])]
        .sort((a, b) => a.ordem - b.ordem)
        .map((t): ItemDaJornada => ({
          id: t.id,
          ordem: t.ordem,
          titulo: t.titulo,
          papel: t.papel,
          prazoEmDias: t.deadline_days,
          tarefaId: t.internal_task_id,
          concluidoEm: t.concluida_em,
        })),
    }));
  return {
    id: j.id,
    clienteId: j.client_id,
    cliente: j.cliente?.name ?? "-",
    versaoDoMetodo: j.template_versao,
    iniciadaEm: j.iniciada_em,
    concluidaEm: j.concluida_em,
    etapas,
  };
}

async function lerTarefasAbertas(clienteId: string): Promise<readonly TarefaDaFicha[]> {
  const { data, error } = await supabaseV2
    .from("internal_tasks")
    .select(COLUNAS_DA_TAREFA)
    .eq("client_id", clienteId)
    .neq("col", "done")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("id")
    .limit(LIMITE_DE_TAREFAS + 1);
  if (error !== null) throw erroDoBanco(error);
  return ((data ?? []) as unknown as TarefaCrua[]).map((t) => ({
    id: t.id,
    titulo: t.title,
    prazo: t.due_date,
    responsavelNome: t.responsavel?.full_name ?? null,
  }));
}

async function lerReunioesAnteriores(
  reuniao: Pick<Reuniao, "startsAt" | "oportunidadeId" | "clienteId">,
): Promise<readonly ReuniaoAnterior[]> {
  const filtros = [
    reuniao.oportunidadeId === null ? null : `opportunity_id.eq.${reuniao.oportunidadeId}`,
    reuniao.clienteId === null ? null : `client_id.eq.${reuniao.clienteId}`,
  ].filter((f): f is string => f !== null);
  if (filtros.length === 0) return [];

  const { data, error } = await supabaseV2
    .from("meetings")
    .select(COLUNAS_DA_REUNIAO_ANTERIOR)
    .or(filtros.join(","))
    .lt("starts_at", reuniao.startsAt)
    .is("cancelada_em", null)
    .order("starts_at", { ascending: false })
    .order("id")
    .limit(LIMITE_DE_REUNIOES_ANTERIORES + 1);
  if (error !== null) throw erroDoBanco(error);
  return ((data ?? []) as unknown as ReuniaoAnteriorCrua[]).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    tipo: r.tipo,
    startsAt: r.starts_at,
    notas: r.notas,
  }));
}
