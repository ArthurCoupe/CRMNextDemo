import { createServerFn } from "@tanstack/react-start";

export type Tema = "dark" | "light";

export const COOKIE_TEMA = "tema";

const MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 365;

function normalizar(valor: string | undefined | null): Tema {
  return valor === "light" ? "light" : "dark";
}

const lerTemaNoServidor = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  return { tema: normalizar(getCookie(COOKIE_TEMA)) };
});

export async function obterTema(): Promise<Tema> {
  if (typeof window === "undefined") {
    const { tema } = await lerTemaNoServidor();
    return tema;
  }
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  raiz.classList.remove("dark", "light");
  raiz.classList.add(tema);
  document.cookie = `${COOKIE_TEMA}=${tema}; path=/; max-age=${MAX_AGE_SEGUNDOS}; samesite=lax`;
}
