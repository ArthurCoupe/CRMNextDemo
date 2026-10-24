import type { StatusDoPost } from "./post";

export const TRANSICOES: Readonly<Record<StatusDoPost, readonly StatusDoPost[]>> = {
  rascunho: ["em_aprovacao"],
  em_aprovacao: ["aprovado", "ajuste_pedido", "rascunho"],
  ajuste_pedido: ["em_aprovacao", "rascunho"],
  aprovado: ["agendado", "publicado", "ajuste_pedido"],
  agendado: ["publicado", "aprovado"],
  publicado: [],
};

export function podeMover(de: StatusDoPost, para: StatusDoPost): boolean {
  return TRANSICOES[de].includes(para);
}

export function destinosDe(status: StatusDoPost): readonly StatusDoPost[] {
  return TRANSICOES[status];
}

export type PassoDoMovimento = "nada" | "pedir_nota" | "pedir_link" | "mover";

export function passoDoMovimento(de: StatusDoPost, para: StatusDoPost): PassoDoMovimento {
  if (!podeMover(de, para)) return "nada";
  if (para === "ajuste_pedido") return "pedir_nota";
  if (para === "publicado") return "pedir_link";
  return "mover";
}

const ACAO: Partial<Record<`${StatusDoPost}>${StatusDoPost}`, string>> = {
  "rascunho>em_aprovacao": "Enviar ao cliente",
  "em_aprovacao>aprovado": "Cliente aprovou",
  "em_aprovacao>ajuste_pedido": "Cliente pediu ajuste",
  "em_aprovacao>rascunho": "Voltar para rascunho",
  "ajuste_pedido>em_aprovacao": "Reenviar ao cliente",
  "ajuste_pedido>rascunho": "Voltar para rascunho",
  "aprovado>agendado": "Agendar",
  "aprovado>publicado": "Publicado",
  "aprovado>ajuste_pedido": "Cliente pediu ajuste",
  "agendado>publicado": "Publicado",
  "agendado>aprovado": "Desagendar",
};

export function rotuloDaAcao(de: StatusDoPost, para: StatusDoPost): string | undefined {
  return ACAO[`${de}>${para}`];
}
