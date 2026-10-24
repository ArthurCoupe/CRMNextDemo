export const LIMITE_DO_ROTULO = 80;
export const LIMITE_DA_URL = 2000;
export const LIMITE_DE_LINKS = 20;

const tamanho = (texto: string): number => [...texto].length;

export type ResultadoDoLink =
  | { readonly ok: true; readonly link: { readonly rotulo: string; readonly url: string } }
  | { readonly ok: false; readonly erro: string };

export function validarLink(rotulo: string, url: string): ResultadoDoLink {
  const r = rotulo.trim();
  const u = url.trim();
  if (r === "") return { ok: false, erro: "Dê um nome ao link." };
  if (tamanho(r) > LIMITE_DO_ROTULO) {
    return { ok: false, erro: "O nome do link pode ter até 80 caracteres." };
  }
  if (!/^https:\/\/\S+$/.test(u) || tamanho(u) > LIMITE_DA_URL) {
    return { ok: false, erro: "O link precisa começar com https:// e ter até 2.000 caracteres." };
  }
  return { ok: true, link: { rotulo: r, url: u } };
}

export function hostDoLink(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
