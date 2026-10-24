import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { Database } from "@/shared/types/database.types";

import { supabaseV2 } from "@/integrations/supabase/client.v2";
import {
  LIMITE_DA_BUSCA_DE_OPORTUNIDADES,
  MENSAGEM_DO_TETO_DE_REUNIOES,
  ReuniaoCriadaSemParticipantes,
  termoDaBuscaDeOportunidade,
  TETO_DE_REUNIOES,
  type TipoDeReuniao,
} from "../domain/meeting";

const COLUNAS_DE_REUNIAO =
  "id, titulo, tipo, starts_at, duration_minutes, client_id, opportunity_id, organizer_id, " +
  "local, notas, cancelada_em, motivo_do_cancelamento, " +
  "clients(name), opportunities(name), meeting_attendees(profiles(id, full_name)), " +
  "cancelamentos_desfeitos(id, cancelada_em, motivo, desfeito_em, " +
  "cancelou:profiles!cancelamentos_desfeitos_cancelada_por_fkey(full_name), " +
  "desfez:profiles!cancelamentos_desfeitos_desfeito_por_fkey(full_name))";

const TETO_DE_CANCELAMENTOS_DESFEITOS = 20;

const MENSAGEM_DE_RECUSA = "Editar reunião é de quem organizou, do owner ou do manager.";

const MENSAGEM_DE_CANCELAMENTO_RECUSADO =
  "Esta reunião já estava cancelada, ou cancelar é só de quem organizou, do owner ou do manager. Recarregue a página.";

const MENSAGEM_DE_DESFAZER_RECUSADO =
  "O cancelamento não foi desfeito: a reunião mudou em outra tela, ou desfazer não é seu.";

const MENSAGEM_DE_EXCLUSAO_RECUSADA =
  "Só quem organizou, o owner e o manager apagam a reunião. Se ela já foi apagada em outra tela, recarregue a página.";

const MENSAGEM_DE_RECUSA_DE_PARTICIPANTES =
  "A reunião foi salva, mas a lista de participantes não. Reabra a reunião e confira quem está nela.";

const TETO_DE_PARTICIPANTES = 200;

const TETO_DE_CLIENTES_PARA_SELECAO = 200;

const TETO_DE_STAFF_PARA_SELECAO = 200;

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n >= teto) {
    throw new Error(
      `A lista de ${oQue} veio no teto de ${teto} e pode estar incompleta. ` +
        `Escolher a partir de uma lista truncada esconde opção válida. ` +
        `Esta leitura precisa de filtro ou paginação antes de crescer.`,
    );
  }
}

export interface Reuniao {
  readonly id: string;
  readonly titulo: string;
  readonly tipo: TipoDeReuniao;
  readonly startsAt: string;
  readonly duracaoMinutos: number;
  readonly clienteId: string | null;
  readonly clienteNome: string | null;
  readonly oportunidadeId: string | null;
  readonly oportunidadeNome: string | null;
  readonly organizadorId: string;
  readonly local: string | null;
  readonly notas: string | null;
  readonly canceladaEm: string | null;
  readonly motivoDoCancelamento: string | null;
  readonly participantes: ReadonlyArray<{ readonly id: string; readonly nome: string }>;
  readonly cancelamentosDesfeitos: readonly CancelamentoDesfeito[];
}

export interface CancelamentoDesfeito {
  readonly id: string;
  readonly canceladaEm: string;
  readonly motivo: string | null;
  readonly desfeitoEm: string;
  readonly canceladaPorNome: string | null;
  readonly desfeitoPorNome: string | null;
}

export interface DadosDeReuniao {
  readonly titulo: string;
  readonly tipo: TipoDeReuniao;
  readonly startsAt: string;
  readonly duracaoMinutos: number;
  readonly clienteId: string | null;
  readonly oportunidadeId: string | null;
  readonly local: string | null;
  readonly notas: string | null;
  readonly participantes: readonly string[];
}

type LinhaDeReuniao = Pick<
  Database["public"]["Tables"]["meetings"]["Row"],
  | "id"
  | "titulo"
  | "tipo"
  | "starts_at"
  | "duration_minutes"
  | "client_id"
  | "opportunity_id"
  | "organizer_id"
  | "local"
  | "notas"
  | "cancelada_em"
  | "motivo_do_cancelamento"
> & {
  clients: { name: string } | null;
  opportunities: { name: string } | null;
  meeting_attendees: ReadonlyArray<{ profiles: { id: string; full_name: string } | null }>;
  cancelamentos_desfeitos: ReadonlyArray<{
    id: string;
    cancelada_em: string;
    motivo: string | null;
    desfeito_em: string;
    cancelou: { full_name: string } | null;
    desfez: { full_name: string } | null;
  }> | null;
};

function paraReuniao(linha: LinhaDeReuniao): Reuniao {
  return {
    id: linha.id,
    titulo: linha.titulo,
    tipo: linha.tipo,
    startsAt: linha.starts_at,
    duracaoMinutos: linha.duration_minutes,
    clienteId: linha.client_id,
    clienteNome: linha.clients?.name ?? null,
    oportunidadeId: linha.opportunity_id,
    oportunidadeNome: linha.opportunities?.name ?? null,
    organizadorId: linha.organizer_id,
    local: linha.local,
    notas: linha.notas,
    canceladaEm: linha.cancelada_em,
    motivoDoCancelamento: linha.motivo_do_cancelamento,
    participantes: linha.meeting_attendees
      .map((a) => a.profiles)
      .filter((p): p is { id: string; full_name: string } => p !== null)
      .map((p) => ({ id: p.id, nome: p.full_name })),
    cancelamentosDesfeitos: (linha.cancelamentos_desfeitos ?? []).map((c) => ({
      id: c.id,
      canceladaEm: c.cancelada_em,
      motivo: c.motivo,
      desfeitoEm: c.desfeito_em,
      canceladaPorNome: c.cancelou?.full_name ?? null,
      desfeitoPorNome: c.desfez?.full_name ?? null,
    })),
  };
}

async function idDaSessaoAtual(): Promise<string | undefined> {
  const { data } = await supabaseV2.auth.getSession();
  return data.session?.user.id;
}

export async function listarReunioes(
  filtros: {
    readonly desde?: string;
    readonly ate?: string;
    readonly soMinhas?: boolean;
  } = {},
): Promise<readonly Reuniao[]> {
  let consulta = supabaseV2.from("meetings").select(COLUNAS_DE_REUNIAO);

  if (filtros.desde !== undefined) consulta = consulta.gte("starts_at", filtros.desde);
  if (filtros.ate !== undefined) consulta = consulta.lte("starts_at", filtros.ate);
  if (filtros.soMinhas === true) {
    const meuId = await idDaSessaoAtual();
    if (meuId !== undefined) consulta = consulta.eq("organizer_id", meuId);
  }

  const { data, error } = await consulta
    .order("starts_at", { ascending: true })
    .limit(TETO_DE_REUNIOES)
    .order("desfeito_em", { referencedTable: "cancelamentos_desfeitos", ascending: false })
    .limit(TETO_DE_CANCELAMENTOS_DESFEITOS, { referencedTable: "cancelamentos_desfeitos" });

  if (error !== null) throw erroDoBanco(error);
  const linhas = (data ?? []) as unknown as LinhaDeReuniao[];
  if (linhas.length >= TETO_DE_REUNIOES) throw new Error(MENSAGEM_DO_TETO_DE_REUNIOES);
  return linhas.map(paraReuniao);
}

export interface ClienteParaSelecao {
  readonly id: string;
  readonly nome: string;
}

export async function listarClientesParaSelecao(): Promise<readonly ClienteParaSelecao[]> {
  const { data, error } = await supabaseV2
    .from("clients")
    .select("id, name")
    .order("name")
    .limit(TETO_DE_CLIENTES_PARA_SELECAO);

  if (error !== null) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_DE_CLIENTES_PARA_SELECAO, "clientes");
  return linhas.map((c) => ({ id: c.id, nome: c.name }));
}

export interface OportunidadeParaSelecao {
  readonly id: string;
  readonly nome: string;
}

export interface BuscaDeOportunidades {
  readonly itens: readonly OportunidadeParaSelecao[];
  readonly haMais: boolean;
}

export async function buscarOportunidadesParaSelecao(
  digitado: string,
): Promise<BuscaDeOportunidades> {
  const termo = termoDaBuscaDeOportunidade(digitado);
  if (termo === null) return { itens: [], haMais: false };

  const { data, error } = await supabaseV2.rpc("buscar_oportunidades_para_reuniao", {
    p_termo: termo,
  });

  if (error !== null) throw erroDoBanco(error);
  const linhas = data ?? [];
  return {
    itens: linhas
      .slice(0, LIMITE_DA_BUSCA_DE_OPORTUNIDADES)
      .map((o) => ({ id: o.id, nome: o.name })),
    haMais: linhas.length > LIMITE_DA_BUSCA_DE_OPORTUNIDADES,
  };
}

export interface StaffParaSelecao {
  readonly id: string;
  readonly nome: string;
}

const PAPEIS_DE_STAFF = ["owner", "manager", "member"] as const;

export async function listarStaffParaSelecao(): Promise<readonly StaffParaSelecao[]> {
  const { data, error } = await supabaseV2
    .from("profiles")
    .select("id, full_name")
    .eq("active", true)
    .in("role", [...PAPEIS_DE_STAFF])
    .order("full_name")
    .limit(TETO_DE_STAFF_PARA_SELECAO);

  if (error !== null) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_DE_STAFF_PARA_SELECAO, "pessoas do time");
  return linhas.map((p) => ({ id: p.id, nome: p.full_name }));
}

export async function criarReuniao(dados: DadosDeReuniao): Promise<string> {
  const { data, error } = await supabaseV2
    .from("meetings")
    .insert({
      titulo: dados.titulo,
      tipo: dados.tipo,
      starts_at: dados.startsAt,
      duration_minutes: dados.duracaoMinutos,
      client_id: dados.clienteId,
      opportunity_id: dados.oportunidadeId,
      local: dados.local,
      notas: dados.notas,
    })
    .select("id")
    .single();

  if (error !== null) throw erroDoBanco(error);

  if (dados.participantes.length > 0) {
    const { data: inseridos, error: erroParticipantes } = await supabaseV2
      .from("meeting_attendees")
      .insert(
        dados.participantes.map((profileId) => ({ meeting_id: data.id, profile_id: profileId })),
      )
      .select("profile_id");
    if (erroParticipantes !== null) {
      throw new ReuniaoCriadaSemParticipantes(data.id, { cause: erroDoBanco(erroParticipantes) });
    }
    if ((inseridos ?? []).length === 0) throw new ReuniaoCriadaSemParticipantes(data.id);
  }

  return data.id;
}

export interface AlteracaoDeReuniao extends Partial<DadosDeReuniao> {
  readonly organizadorId?: string;
}

export async function atualizarReuniao(id: string, dados: AlteracaoDeReuniao): Promise<void> {
  const alteracao: Database["public"]["Tables"]["meetings"]["Update"] = {};
  if (dados.titulo !== undefined) alteracao.titulo = dados.titulo;
  if (dados.tipo !== undefined) alteracao.tipo = dados.tipo;
  if (dados.startsAt !== undefined) alteracao.starts_at = dados.startsAt;
  if (dados.duracaoMinutos !== undefined) alteracao.duration_minutes = dados.duracaoMinutos;
  if (dados.clienteId !== undefined) alteracao.client_id = dados.clienteId;
  if (dados.oportunidadeId !== undefined) alteracao.opportunity_id = dados.oportunidadeId;
  if (dados.local !== undefined) alteracao.local = dados.local;
  if (dados.notas !== undefined) alteracao.notas = dados.notas;
  if (dados.organizadorId !== undefined) alteracao.organizer_id = dados.organizadorId;

  const { data, error } = await supabaseV2
    .from("meetings")
    .update(alteracao)
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(MENSAGEM_DE_RECUSA);

  if (dados.participantes !== undefined) {
    await sincronizarParticipantes(id, dados.participantes);
  }
}

async function sincronizarParticipantes(id: string, desejados: readonly string[]): Promise<void> {
  const { data: gravados, error: erroLer } = await supabaseV2
    .from("meeting_attendees")
    .select("profile_id")
    .eq("meeting_id", id)
    .limit(TETO_DE_PARTICIPANTES);
  if (erroLer !== null) throw erroDoBanco(erroLer);
  const atuais = (gravados ?? []).map((linha) => linha.profile_id);
  recusaSeTruncou(atuais.length, TETO_DE_PARTICIPANTES, "participantes da reunião");

  const aInserir = desejados.filter((p) => !atuais.includes(p));
  const aRemover = atuais.filter((p) => !desejados.includes(p));

  if (aInserir.length > 0) {
    const { data, error } = await supabaseV2
      .from("meeting_attendees")
      .insert(aInserir.map((profileId) => ({ meeting_id: id, profile_id: profileId })))
      .select("profile_id");
    if (error !== null) throw erroDoBanco(error);
    if ((data ?? []).length === 0) throw new Error(MENSAGEM_DE_RECUSA_DE_PARTICIPANTES);
  }

  if (aRemover.length > 0) {
    const { data, error } = await supabaseV2
      .from("meeting_attendees")
      .delete()
      .eq("meeting_id", id)
      .in("profile_id", aRemover)
      .select("profile_id");
    if (error !== null) throw erroDoBanco(error);
    if ((data ?? []).length === 0) throw new Error(MENSAGEM_DE_RECUSA_DE_PARTICIPANTES);
  }
}

export async function cancelarReuniao(id: string, motivo: string): Promise<void> {
  const canceladoPor = await idDaSessaoAtual();
  if (canceladoPor === undefined) {
    throw new Error("Sessão expirada. Atualize a página antes de cancelar.");
  }

  const { data, error } = await supabaseV2
    .from("meetings")
    .update({
      cancelada_em: new Date().toISOString(),
      cancelada_por: canceladoPor,
      motivo_do_cancelamento: motivo,
    })
    .eq("id", id)
    .is("cancelada_em", null)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(MENSAGEM_DE_CANCELAMENTO_RECUSADO);
}

export async function desfazerCancelamento(id: string, canceladaEmLida: string): Promise<void> {
  const { data, error } = await supabaseV2
    .from("meetings")
    .update({ cancelada_em: null, cancelada_por: null, motivo_do_cancelamento: null })
    .eq("id", id)
    .not("cancelada_em", "is", null)
    .eq("cancelada_em", canceladaEmLida)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(MENSAGEM_DE_DESFAZER_RECUSADO);
}

export async function apagarReuniao(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("meetings").delete().eq("id", id).select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(MENSAGEM_DE_EXCLUSAO_RECUSADA);
}

export async function consultarConflitos(
  participantes: readonly string[],
  inicio: string,
  duracaoMinutos: number,
  excluirReuniaoId: string | null = null,
): Promise<readonly string[]> {
  const fim = new Date(new Date(inicio).getTime() + duracaoMinutos * 60_000).toISOString();

  const { data, error } = await supabaseV2.rpc("horarios_ocupados", {
    p_profiles: [...participantes],
    p_inicio: inicio,
    p_fim: fim,
    ...(excluirReuniaoId === null ? {} : { p_excluir_reuniao: excluirReuniaoId }),
  });

  if (error !== null) throw erroDoBanco(error);
  return (data ?? []).map((linha) => linha.profile_id);
}
