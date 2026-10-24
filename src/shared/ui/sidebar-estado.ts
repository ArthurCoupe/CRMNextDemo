import { createServerFn } from "@tanstack/react-start";

export const COOKIE_SIDEBAR = "sidebar_compacta";

const MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 365;

const lerNoServidor = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  return { compacta: getCookie(COOKIE_SIDEBAR) === "1" };
});

export async function obterSidebarCompacta(): Promise<boolean> {
  if (typeof window === "undefined") {
    const { compacta } = await lerNoServidor();
    return compacta;
  }
  return document.cookie.split(";").some((c) => c.trim() === `${COOKIE_SIDEBAR}=1`);
}

export function gravarSidebarCompacta(compacta: boolean): void {
  document.cookie = `${COOKIE_SIDEBAR}=${compacta ? "1" : "0"}; path=/; max-age=${MAX_AGE_SEGUNDOS}; samesite=lax`;
}
