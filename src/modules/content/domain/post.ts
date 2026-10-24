import type { Database } from "@/shared/types/database.types";

export type StatusDoPost = Database["public"]["Enums"]["post_status"];
export type FormatoDoPost = Database["public"]["Enums"]["post_format"];
export type CanalDoPost = Database["public"]["Enums"]["post_channel"];

export const ORDEM_DOS_STATUS: readonly StatusDoPost[] = [
  "rascunho",
  "em_aprovacao",
  "ajuste_pedido",
  "aprovado",
  "agendado",
  "publicado",
];

export const ROTULO_DO_STATUS: Readonly<Record<StatusDoPost, string>> = {
  rascunho: "Rascunho",
  em_aprovacao: "Em aprovação",
  ajuste_pedido: "Ajuste pedido",
  aprovado: "Aprovado",
  agendado: "Agendado",
  publicado: "Publicado",
};

export const COR_DO_STATUS: Readonly<Record<StatusDoPost, string>> = {
  rascunho: "bg-muted text-muted-foreground",
  em_aprovacao: "bg-warning-soft text-warning",
  ajuste_pedido: "bg-destructive-soft text-destructive",
  aprovado: "bg-primary-soft text-primary-texto",
  agendado: "bg-primary-soft text-primary-texto",
  publicado: "bg-success-soft text-success",
};

export const FORMATOS: readonly FormatoDoPost[] = ["reel", "carrossel", "estatico", "story"];

export const ROTULO_DO_FORMATO: Readonly<Record<FormatoDoPost, string>> = {
  reel: "Reel",
  carrossel: "Carrossel",
  estatico: "Estático",
  story: "Story",
};

export const CANAIS: readonly CanalDoPost[] = ["instagram", "facebook"];

export const ROTULO_DO_CANAL: Readonly<Record<CanalDoPost, string>> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

export const ETAPAS: readonly {
  readonly sigla: string;
  readonly nome: string;
  readonly status: readonly StatusDoPost[];
}[] = [
  { sigla: "P", nome: "Produção", status: ["rascunho"] },
  { sigla: "E", nome: "Envio", status: ["em_aprovacao"] },
  { sigla: "CO", nome: "Correção", status: ["ajuste_pedido"] },
  { sigla: "L", nome: "Lançamento", status: ["aprovado", "agendado", "publicado"] },
];

export const TRAVA_DE_CONTEUDO =
  "Enviado ao cliente: mova para ajuste pedido ou rascunho para alterar o conteúdo.";
export const TRAVA_DE_PUBLICADO =
  "Publicado: o conteúdo não muda; o link e a data da publicação podem ser corrigidos.";

export const POST_MUDOU =
  "Este post mudou em outra tela ou você não tem permissão para editá-lo. Recarregue a página.";
export const POST_NAO_APAGADO =
  "O post não foi apagado: ele já saiu em outra tela, ou só owner e manager podem apagar. Recarregue a página.";

export function conteudoEditavel(status: StatusDoPost): boolean {
  return status === "rascunho" || status === "ajuste_pedido";
}

export function agendaEditavel(status: StatusDoPost): boolean {
  return status !== "publicado";
}
