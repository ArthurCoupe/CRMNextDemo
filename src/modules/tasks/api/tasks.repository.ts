import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { Database } from "@/shared/types/database.types";

import { supabaseV2 } from "@/integrations/supabase/client.v2";

import type { AlteracaoDaTarefa } from "../domain/edicao";
import { LIMITE_DE_LINKS, validarLink } from "../domain/link";
import type {
  ColunaDaTarefa,
  PrioridadeDaTarefa,
  RecorrenciaDaTarefa,
  Tarefa,
} from "../domain/task";

export const TAREFAS_POR_PAGINA = 100;

const COLUNAS = `
  id, title, description, category, task_type, assignee_id, client_id,
  col, priority, due_date, recurrence, raiz_recorrente, created_by,
  responsavel:profiles!internal_tasks_assignee_id_fkey ( full_name ),
  cliente:clients ( name, drive_folder_id ),
  participantes:internal_task_participants ( profile_id, pessoa:profiles ( full_name, active ) ),
  links:internal_task_links ( id, label, url, created_at )
` as const;

interface LinhaCrua {
  id: string;
  title: string;
  description: string | null;
  category: string;
  task_type: string;
  assignee_id: string | null;
  client_id: string | null;
  col: ColunaDaTarefa;
  priority: PrioridadeDaTarefa;
  due_date: string | null;
  recurrence: RecorrenciaDaTarefa;
  raiz_recorrente: string | null;
  created_by: string | null;
  responsavel: { full_name: string } | null;
  cliente: { name: string; drive_folder_id: string | null } | null;
  participantes: { profile_id: string; pessoa: { full_name: string; active: boolean } }[];
  links: { id: string; label: string; url: string; created_at: string }[];
}

function urlDaPasta(id: string | null): string | null {
  if (id === null || id.trim() === "") return null;
  return `https://drive.google.com/drive/folders/${encodeURIComponent(id.trim())}`;
}

function paraDominio(l: LinhaCrua): Tarefa {
  return {
    id: l.id,
    titulo: l.title,
    descricao: l.description,
    categoria: l.category,
    tipo: l.task_type,
    responsavelId: l.assignee_id,
    responsavel: l.responsavel?.full_name ?? null,
    clienteId: l.client_id,
    cliente: l.cliente?.name ?? null,
    coluna: l.col,
    prioridade: l.priority,
    prazo: l.due_date,
    recorrencia: l.recurrence,
    raizRecorrente: l.raiz_recorrente,
    criadoPor: l.created_by,
    participantes: l.participantes
      .filter((p) => p.profile_id !== l.assignee_id)
      .map((p) => ({ id: p.profile_id, nome: p.pessoa.full_name, ativo: p.pessoa.active }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    links: [...l.links]
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
      .map((k) => ({ id: k.id, rotulo: k.label, url: k.url })),
    pastaDoDriveDoCliente: urlDaPasta(l.cliente?.drive_folder_id ?? null),
  };
}

export interface FiltrosDeTarefa {
  readonly responsavelId?: string | null;
  readonly prioridade?: PrioridadeDaTarefa | null;
  readonly clienteId?: string | null;
  readonly categoria?: string | null;
  readonly somenteVencidas?: boolean;
  readonly incluirConcluidas?: boolean;
  readonly pagina?: number;
}

export interface PaginaDeTarefas {
  readonly tarefas: readonly Tarefa[];
  readonly temMais: boolean;
}

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILTRO_DE_PESSOA_INVALIDO = "O filtro de pessoa não é um id válido.";

const TETO_PARTICIPACOES = 200;

async function tarefasEmQueParticipa(
  pessoa: string,
  cortaConcluidas: boolean,
): Promise<readonly string[]> {
  let q = supabaseV2
    .from("internal_task_participants")
    .select("task_id, tarefa:internal_tasks!inner ( col )")
    .eq("profile_id", pessoa)
    .limit(TETO_PARTICIPACOES);
  if (cortaConcluidas) q = q.neq("tarefa.col", "done");
  const { data, error } = await q;
  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_PARTICIPACOES, "tarefas em que a pessoa participa");
  const ids = linhas.map((l) => l.task_id);
  if (!ids.every((id) => FORMATO_UUID.test(id))) throw new Error(FILTRO_DE_PESSOA_INVALIDO);
  return ids;
}

export async function lerTarefas(
  filtros: FiltrosDeTarefa,
  hojeEmSP: string,
): Promise<PaginaDeTarefas> {
  const pessoa = filtros.responsavelId ?? null;
  if (pessoa !== null && !FORMATO_UUID.test(pessoa)) throw new Error(FILTRO_DE_PESSOA_INVALIDO);
  const cortaConcluidas = filtros.incluirConcluidas !== true || filtros.somenteVencidas === true;
  const ids = pessoa === null ? [] : await tarefasEmQueParticipa(pessoa, cortaConcluidas);

  const pagina = filtros.pagina ?? 0;
  let q = supabaseV2
    .from("internal_tasks")
    .select(COLUNAS)
    .order("due_date", { ascending: true, nullsFirst: false })
    .range(pagina * TAREFAS_POR_PAGINA, (pagina + 1) * TAREFAS_POR_PAGINA - 1)
    .limit(LIMITE_DE_LINKS, { referencedTable: "links" });

  if (filtros.incluirConcluidas !== true) q = q.neq("col", "done");
  if (pessoa !== null) {
    q =
      ids.length === 0
        ? q.eq("assignee_id", pessoa)
        : q.or(`assignee_id.eq.${pessoa},id.in.(${ids.join(",")})`);
  }
  if (filtros.prioridade != null) q = q.eq("priority", filtros.prioridade);
  if (filtros.clienteId != null) q = q.eq("client_id", filtros.clienteId);
  if (filtros.categoria != null) q = q.eq("category", filtros.categoria);
  if (filtros.somenteVencidas === true) {
    q = q.lt("due_date", hojeEmSP).neq("col", "done");
  }

  const { data, error } = await q;
  if (error) throw erroDoBanco(error);
  const linhas = (data as unknown as LinhaCrua[] | null) ?? [];
  return { tarefas: linhas.map(paraDominio), temMais: linhas.length === TAREFAS_POR_PAGINA };
}

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n >= teto) {
    throw new Error(
      `A lista de ${oQue} veio no teto de ${teto} e pode estar incompleta. ` +
        `Escolher a partir de uma lista truncada esconde opção válida. ` +
        `Esta leitura precisa de filtro ou paginação antes de crescer.`,
    );
  }
}

const TETO_CATALOGO = 200;
const TETO_TIME = 50;
const TETO_CLIENTES = 200;

export interface ItemDoCatalogo {
  readonly categoria: string;
  readonly tipo: string;
}

export async function lerCatalogo(): Promise<readonly ItemDoCatalogo[]> {
  const { data, error } = await supabaseV2
    .from("task_catalog")
    .select("category, task_type, ordem")
    .eq("ativo", true)
    .order("category")
    .order("ordem")
    .limit(TETO_CATALOGO);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_CATALOGO, "tipos de tarefa");
  return (data ?? []).map((l) => ({ categoria: l.category, tipo: l.task_type }));
}

export interface PessoaDoTime {
  readonly id: string;
  readonly nome: string;
}

export async function lerPessoasDoTime(): Promise<readonly PessoaDoTime[]> {
  const { data, error } = await supabaseV2
    .from("profiles")
    .select("id, full_name")
    .eq("active", true)
    .in("role", ["owner", "manager", "member"])
    .order("full_name")
    .limit(TETO_TIME);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_TIME, "pessoas do time");
  return (data ?? []).map((p) => ({ id: p.id, nome: p.full_name }));
}

export async function lerClientesParaSelecao(): Promise<readonly PessoaDoTime[]> {
  const { data, error } = await supabaseV2
    .from("clients")
    .select("id, name")
    .order("name")
    .limit(TETO_CLIENTES);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_CLIENTES, "clientes");
  return (data ?? []).map((c) => ({ id: c.id, nome: c.name }));
}

export interface NovaTarefa {
  readonly titulo: string;
  readonly descricao: string | null;
  readonly categoria: string;
  readonly tipo: string;
  readonly responsavelId: string | null;
  readonly clienteId: string | null;
  readonly prazo: string | null;
  readonly prioridade: PrioridadeDaTarefa;
  readonly recorrencia: RecorrenciaDaTarefa;
  readonly participantes: readonly string[];
}

export async function criarTarefa(nova: NovaTarefa): Promise<string> {
  const { data, error } = await supabaseV2
    .from("internal_tasks")
    .insert({
      title: nova.titulo,
      description: nova.descricao,
      category: nova.categoria,
      task_type: nova.tipo,
      assignee_id: nova.responsavelId,
      client_id: nova.clienteId,
      due_date: nova.prazo,
      priority: nova.prioridade,
      recurrence: nova.recorrencia,
    })
    .select("id");
  if (error) throw erroDoBanco(error);
  const id = data?.[0]?.id;
  if (id === undefined) {
    throw new Error(
      "A tarefa foi enviada, mas o banco não a devolveu. Recarregue a página para conferir se ela foi criada.",
    );
  }
  return id;
}

export async function moverTarefa(id: string, coluna: ColunaDaTarefa): Promise<void> {
  const { data, error } = await supabaseV2
    .from("internal_tasks")
    .update({ col: coluna })
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Você não tem permissão para mover esta tarefa.");
  }
}

export async function atualizarTarefa(id: string, campos: AlteracaoDaTarefa): Promise<void> {
  const vazioVirandoNulo = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim();

  if (campos.titulo !== undefined && campos.titulo.trim() === "") {
    throw new Error("O título da tarefa não pode ficar em branco.");
  }

  const alteracao: Pick<
    Database["public"]["Tables"]["internal_tasks"]["Update"],
    | "title"
    | "description"
    | "category"
    | "task_type"
    | "assignee_id"
    | "due_date"
    | "priority"
    | "client_id"
    | "recurrence"
  > = {};
  if (campos.titulo !== undefined) alteracao.title = campos.titulo.trim();
  if (campos.descricao !== undefined)
    alteracao.description = vazioVirandoNulo(campos.descricao) ?? null;
  if (campos.categoria !== undefined) alteracao.category = campos.categoria;
  if (campos.tipo !== undefined) alteracao.task_type = campos.tipo;
  if (campos.responsavelId !== undefined)
    alteracao.assignee_id = vazioVirandoNulo(campos.responsavelId) ?? null;
  if (campos.prazo !== undefined) alteracao.due_date = vazioVirandoNulo(campos.prazo) ?? null;
  if (campos.prioridade !== undefined) alteracao.priority = campos.prioridade;
  if (campos.clienteId !== undefined)
    alteracao.client_id = vazioVirandoNulo(campos.clienteId) ?? null;
  if (campos.recorrencia !== undefined) alteracao.recurrence = campos.recorrencia;

  if (Object.keys(alteracao).length === 0) return;

  const { data, error } = await supabaseV2
    .from("internal_tasks")
    .update(alteracao)
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Você não tem permissão para editar esta tarefa.");
  }
}

export async function apagarTarefa(id: string): Promise<void> {
  const { data, error } = await supabaseV2
    .from("internal_tasks")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "23503") {
      throw new Error("Esta tarefa já gerou uma ocorrência seguinte e não pode ser apagada.");
    }
    throw erroDoBanco(error);
  }
  if ((data ?? []).length === 0) {
    throw new Error(
      "Só owner, manager e quem criou a tarefa podem apagá-la, e card de onboarding não se apaga por aqui.",
    );
  }
}

const RECUSA_PARTICIPANTES =
  "Você não pode mexer nos participantes desta tarefa: só owner, manager, o responsável, os participantes e quem criou a tarefa mexem.";
const RECUSA_LINKS =
  "Você não pode mexer nos links desta tarefa: só owner, manager, o responsável e os participantes mexem.";

export async function adicionarParticipantes(
  taskId: string,
  profileIds: readonly string[],
): Promise<void> {
  for (const profileId of profileIds) {
    const { data, error } = await supabaseV2
      .from("internal_task_participants")
      .insert({ task_id: taskId, profile_id: profileId })
      .select("task_id");
    if (error) {
      if (error.code === "42501") throw new Error(RECUSA_PARTICIPANTES);
      if (error.code === "23505") throw new Error("Esta pessoa já participa da tarefa.");
      throw erroDoBanco(error);
    }
    if ((data ?? []).length === 0) throw new Error(RECUSA_PARTICIPANTES);
  }
}

export async function removerParticipante(taskId: string, profileId: string): Promise<void> {
  const { data, error } = await supabaseV2
    .from("internal_task_participants")
    .delete()
    .eq("task_id", taskId)
    .eq("profile_id", profileId)
    .select("task_id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(RECUSA_PARTICIPANTES);
}

export async function adicionarLink(taskId: string, rotulo: string, url: string): Promise<void> {
  const validado = validarLink(rotulo, url);
  if (!validado.ok) throw new Error(validado.erro);
  const { data, error } = await supabaseV2
    .from("internal_task_links")
    .insert({ task_id: taskId, label: validado.link.rotulo, url: validado.link.url })
    .select("id");
  if (error) {
    if (error.code === "42501") throw new Error(RECUSA_LINKS);
    throw erroDoBanco(error);
  }
  if ((data ?? []).length === 0) throw new Error(RECUSA_LINKS);
}

export async function removerLink(id: string): Promise<void> {
  const { data, error } = await supabaseV2
    .from("internal_task_links")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(RECUSA_LINKS);
}

export async function atualizarLink(id: string, rotulo: string, url: string): Promise<void> {
  const validado = validarLink(rotulo, url);
  if (!validado.ok) throw new Error(validado.erro);
  const { data, error } = await supabaseV2
    .from("internal_task_links")
    .update({ label: validado.link.rotulo, url: validado.link.url })
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(RECUSA_LINKS);
}
