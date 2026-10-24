import { supabaseV2 } from "@/integrations/supabase/client.v2";
import { erroDoBanco } from "@/shared/lib/erro-do-banco";

import type { CamposDoPost, CorrecaoDaPublicacao } from "../domain/formulario";
import {
  POST_MUDOU,
  POST_NAO_APAGADO,
  type CanalDoPost,
  type FormatoDoPost,
  type StatusDoPost,
} from "../domain/post";

const COLUNAS_DO_POST =
  "id, client_id, title, caption, format, channel, media_url, scheduled_at, responsible_id, status, status_desde, published_at, published_url, updated_at, clients(name), responsavel:profiles(full_name)";

const TETO_DE_ABERTOS = 500;
const TETO_DE_PUBLICADOS = 200;
const TETO_DA_SEMANA = 500;
const TETO_DE_EVENTOS = 200;
const TETO_DO_TIME = 50;
const TETO_DE_CLIENTES = 200;

export interface Opcao {
  readonly id: string;
  readonly nome: string;
}

export interface PostDoQuadro {
  readonly id: string;
  readonly clienteId: string;
  readonly clienteNome: string;
  readonly titulo: string;
  readonly legenda: string | null;
  readonly formato: FormatoDoPost;
  readonly canal: CanalDoPost;
  readonly linkDaArte: string | null;
  readonly agendadoPara: string;
  readonly responsavelId: string;
  readonly responsavelNome: string;
  readonly status: StatusDoPost;
  readonly statusDesde: string;
  readonly publicadoEm: string | null;
  readonly linkPublicado: string | null;
  readonly atualizadoEm: string;
}

export interface ListaDePosts {
  readonly posts: readonly PostDoQuadro[];
  readonly temMais: boolean;
}

export interface EventoDoPost {
  readonly id: string;
  readonly de: StatusDoPost | null;
  readonly para: StatusDoPost;
  readonly nota: string | null;
  readonly tarefaId: string | null;
  readonly autorId: string;
  readonly criadoEm: string;
}

interface LinhaDoPost {
  readonly id: string;
  readonly client_id: string;
  readonly title: string;
  readonly caption: string | null;
  readonly format: FormatoDoPost;
  readonly channel: CanalDoPost;
  readonly media_url: string | null;
  readonly scheduled_at: string;
  readonly responsible_id: string;
  readonly status: StatusDoPost;
  readonly status_desde: string;
  readonly published_at: string | null;
  readonly published_url: string | null;
  readonly updated_at: string;
  readonly clients: { readonly name: string } | null;
  readonly responsavel: { readonly full_name: string | null } | null;
}

function paraPost(l: LinhaDoPost): PostDoQuadro {
  return {
    id: l.id,
    clienteId: l.client_id,
    clienteNome: l.clients?.name ?? "-",
    titulo: l.title,
    legenda: l.caption,
    formato: l.format,
    canal: l.channel,
    linkDaArte: l.media_url,
    agendadoPara: l.scheduled_at,
    responsavelId: l.responsible_id,
    responsavelNome: l.responsavel?.full_name ?? "-",
    status: l.status,
    statusDesde: l.status_desde,
    publicadoEm: l.published_at,
    linkPublicado: l.published_url,
    atualizadoEm: l.updated_at,
  };
}

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n >= teto) {
    throw new Error(
      `A lista de ${oQue} veio no teto de ${teto} e pode estar incompleta. Esta leitura precisa de filtro ou paginação antes de crescer.`,
    );
  }
}

export async function listarPostsDoQuadro(
  clienteId: string | null,
  publicadosDesde: string,
): Promise<ListaDePosts> {
  let abertos = supabaseV2.from("content_posts").select(COLUNAS_DO_POST).neq("status", "publicado");
  let publicados = supabaseV2
    .from("content_posts")
    .select(COLUNAS_DO_POST)
    .eq("status", "publicado")
    .gte("published_at", publicadosDesde);
  if (clienteId !== null) {
    abertos = abertos.eq("client_id", clienteId);
    publicados = publicados.eq("client_id", clienteId);
  }
  const [a, p] = await Promise.all([
    abertos.order("scheduled_at").limit(TETO_DE_ABERTOS),
    publicados.order("scheduled_at").limit(TETO_DE_PUBLICADOS),
  ]);
  if (a.error) throw erroDoBanco(a.error);
  if (p.error) throw erroDoBanco(p.error);
  const linhasA = a.data ?? [];
  const linhasP = p.data ?? [];
  return {
    posts: [...linhasA, ...linhasP].map(paraPost),
    temMais: linhasA.length >= TETO_DE_ABERTOS || linhasP.length >= TETO_DE_PUBLICADOS,
  };
}

export async function listarPostsDaSemana(
  de: string,
  ate: string,
  clienteId: string | null,
): Promise<ListaDePosts> {
  let consulta = supabaseV2
    .from("content_posts")
    .select(COLUNAS_DO_POST)
    .gte("scheduled_at", de)
    .lt("scheduled_at", ate);
  if (clienteId !== null) consulta = consulta.eq("client_id", clienteId);
  const { data, error } = await consulta.order("scheduled_at").limit(TETO_DA_SEMANA);
  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  return { posts: linhas.map(paraPost), temMais: linhas.length >= TETO_DA_SEMANA };
}

export async function listarEventos(postId: string): Promise<readonly EventoDoPost[]> {
  const { data, error } = await supabaseV2
    .from("content_post_events")
    .select("id, de, para, nota, internal_task_id, autor_id, criado_em")
    .eq("post_id", postId)
    .order("criado_em")
    .limit(TETO_DE_EVENTOS);
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((e) => ({
    id: e.id,
    de: e.de,
    para: e.para,
    nota: e.nota,
    tarefaId: e.internal_task_id,
    autorId: e.autor_id,
    criadoEm: e.criado_em,
  }));
}

export async function criarPost(c: CamposDoPost): Promise<string> {
  const { data, error } = await supabaseV2
    .from("content_posts")
    .insert({
      client_id: c.clienteId,
      title: c.titulo,
      caption: c.legenda,
      format: c.formato,
      channel: c.canal,
      media_url: c.linkDaArte,
      scheduled_at: c.agendadoPara,
      responsible_id: c.responsavelId,
    })
    .select("id")
    .single();
  if (error) throw erroDoBanco(error);
  return data.id;
}

export async function editarPost(id: string, atualizadoEm: string, c: CamposDoPost): Promise<void> {
  const { data, error } = await supabaseV2
    .from("content_posts")
    .update({
      client_id: c.clienteId,
      title: c.titulo,
      caption: c.legenda,
      format: c.formato,
      channel: c.canal,
      media_url: c.linkDaArte,
      scheduled_at: c.agendadoPara,
      responsible_id: c.responsavelId,
    })
    .eq("id", id)
    .eq("updated_at", atualizadoEm)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(POST_MUDOU);
}

export async function corrigirPublicacao(
  id: string,
  atualizadoEm: string,
  c: CorrecaoDaPublicacao,
): Promise<void> {
  const { data, error } = await supabaseV2
    .from("content_posts")
    .update({ published_url: c.link, published_at: c.publicadoEm })
    .eq("id", id)
    .eq("updated_at", atualizadoEm)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(POST_MUDOU);
}

export async function moverPost(
  id: string,
  de: StatusDoPost,
  para: StatusDoPost,
  nota: string | null,
  link: string | null,
): Promise<void> {
  const { error } = await supabaseV2.rpc("mover_post", {
    p_post_id: id,
    p_de: de,
    p_para: para,
    p_nota: nota ?? undefined,
    p_link: link ?? undefined,
  });
  if (error) throw erroDoBanco(error);
}

export async function apagarPost(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("content_posts").delete().eq("id", id).select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(POST_NAO_APAGADO);
}

export async function listarResponsaveis(): Promise<readonly Opcao[]> {
  const { data, error } = await supabaseV2
    .from("profiles")
    .select("id, full_name")
    .eq("active", true)
    .in("role", ["owner", "manager", "member"])
    .order("full_name")
    .limit(TETO_DO_TIME);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_DO_TIME, "pessoas da equipe");
  return (data ?? []).map((p) => ({ id: p.id, nome: p.full_name }));
}

export async function listarClientes(): Promise<readonly Opcao[]> {
  const { data, error } = await supabaseV2
    .from("clients")
    .select("id, name")
    .neq("status", "churned")
    .order("name")
    .limit(TETO_DE_CLIENTES);
  if (error) throw erroDoBanco(error);
  recusaSeTruncou((data ?? []).length, TETO_DE_CLIENTES, "clientes");
  return (data ?? []).map((c) => ({ id: c.id, nome: c.name }));
}
