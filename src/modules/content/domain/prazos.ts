import { diasCivisDesde } from "@/shared/lib/date";

import type { StatusDoPost } from "./post";

export function estaAtrasado(
  post: { readonly status: StatusDoPost; readonly agendadoPara: string },
  agora: Date,
): boolean {
  if (post.status === "publicado") return false;
  const quando = Date.parse(post.agendadoPara);
  return !Number.isNaN(quando) && quando < agora.getTime();
}

export function diasNoStatus(statusDesde: string, agora: Date): number {
  return Math.max(0, diasCivisDesde(statusDesde, agora) ?? 0);
}

export interface ResumoDosAvisos {
  readonly atrasados: number;
  readonly aguardando: number;
  readonly aguardandoHaMaisDias: number;
}

export function resumoDosAvisos(
  posts: readonly {
    readonly status: StatusDoPost;
    readonly agendadoPara: string;
    readonly statusDesde: string;
  }[],
  agora: Date,
): ResumoDosAvisos {
  let atrasados = 0;
  let aguardando = 0;
  let aguardandoHaMaisDias = 0;
  for (const post of posts) {
    if (estaAtrasado(post, agora)) atrasados += 1;
    if (post.status === "em_aprovacao") {
      aguardando += 1;
      aguardandoHaMaisDias = Math.max(aguardandoHaMaisDias, diasNoStatus(post.statusDesde, agora));
    }
  }
  return { atrasados, aguardando, aguardandoHaMaisDias };
}

export function textoDosAtrasados(n: number): string {
  return n === 1 ? "1 post atrasado" : `${n} posts atrasados`;
}

export function textoDoAguardando(n: number, dias: number): string {
  const quantos = n === 1 ? "1 post aguardando o cliente" : `${n} posts aguardando o cliente`;
  const desde = dias === 0 ? "desde hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`;
  return `${quantos} · ${desde}`;
}
