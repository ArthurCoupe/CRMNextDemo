import { ehDataCivilPlausivel, paraInstante } from "@/shared/lib/date";

import type { CanalDoPost, FormatoDoPost } from "./post";

export const LIMITE_DO_TITULO = 200;
export const LIMITE_DA_LEGENDA = 2200;
export const LIMITE_DO_LINK = 2000;
export const LIMITE_DA_NOTA = 2000;

export function tamanho(texto: string): number {
  return [...texto].length;
}

export function ehLinkHttps(texto: string): boolean {
  return /^https:\/\/\S+$/.test(texto) && tamanho(texto) <= LIMITE_DO_LINK;
}

export interface RascunhoDoPost {
  readonly clienteId: string;
  readonly titulo: string;
  readonly legenda: string;
  readonly formato: FormatoDoPost;
  readonly canal: CanalDoPost;
  readonly linkDaArte: string;
  readonly data: string;
  readonly hora: string;
  readonly responsavelId: string;
}

export interface CamposDoPost {
  readonly clienteId: string;
  readonly titulo: string;
  readonly legenda: string | null;
  readonly formato: FormatoDoPost;
  readonly canal: CanalDoPost;
  readonly linkDaArte: string | null;
  readonly agendadoPara: string;
  readonly responsavelId: string;
}

export type ResultadoDaValidacao =
  | { readonly ok: true; readonly campos: CamposDoPost }
  | { readonly ok: false; readonly erros: Partial<Record<keyof RascunhoDoPost, string>> };

function instante(data: string, hora: string): string | null {
  if (!ehDataCivilPlausivel(data)) return null;
  try {
    return paraInstante(data, hora);
  } catch {
    return null;
  }
}

export function validarPost(r: RascunhoDoPost): ResultadoDaValidacao {
  const erros: Partial<Record<keyof RascunhoDoPost, string>> = {};
  const titulo = r.titulo.trim();
  const legenda = r.legenda.trim();
  const link = r.linkDaArte.trim();
  const agendadoPara = instante(r.data, r.hora);

  if (r.clienteId === "") erros.clienteId = "Escolha o cliente.";
  if (titulo === "") erros.titulo = "Escreva o título do post.";
  else if (tamanho(titulo) > LIMITE_DO_TITULO)
    erros.titulo = "O título pode ter até 200 caracteres.";
  if (tamanho(legenda) > LIMITE_DA_LEGENDA)
    erros.legenda = "A legenda pode ter até 2.200 caracteres.";
  if (link !== "" && !ehLinkHttps(link)) {
    erros.linkDaArte = "O link da arte precisa começar com https:// e ter até 2.000 caracteres.";
  }
  if (agendadoPara === null) erros.data = "Informe data e hora válidas.";
  if (r.responsavelId === "") erros.responsavelId = "Escolha o responsável.";

  if (agendadoPara === null || Object.keys(erros).length > 0) return { ok: false, erros };
  return {
    ok: true,
    campos: {
      clienteId: r.clienteId,
      titulo,
      legenda: legenda === "" ? null : legenda,
      formato: r.formato,
      canal: r.canal,
      linkDaArte: link === "" ? null : link,
      agendadoPara,
      responsavelId: r.responsavelId,
    },
  };
}

export interface RascunhoDaPublicacao {
  readonly link: string;
  readonly data: string;
  readonly hora: string;
}

export interface CorrecaoDaPublicacao {
  readonly link: string | null;
  readonly publicadoEm: string;
}

export type ResultadoDaCorrecao =
  | { readonly ok: true; readonly correcao: CorrecaoDaPublicacao }
  | { readonly ok: false; readonly erro: string };

export function validarCorrecaoDaPublicacao(
  r: RascunhoDaPublicacao,
  agora: Date,
): ResultadoDaCorrecao {
  const link = r.link.trim();
  if (link !== "" && !ehLinkHttps(link)) {
    return {
      ok: false,
      erro: "O link do post precisa começar com https:// e ter até 2.000 caracteres.",
    };
  }
  const publicadoEm = instante(r.data, r.hora);
  if (publicadoEm === null) return { ok: false, erro: "Data ou hora inválida." };
  if (new Date(publicadoEm).getTime() > agora.getTime()) {
    return { ok: false, erro: "A data da publicação não pode ficar no futuro." };
  }
  return { ok: true, correcao: { link: link === "" ? null : link, publicadoEm } };
}
