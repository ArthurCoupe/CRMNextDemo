import { createMiddleware } from "@tanstack/react-start";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";

import { autenticarPedido, type PedidoAutenticado } from "./auth-middleware";

export const FUNCOES_PUBLICAS: ReadonlySet<string> = new Set([
  "src/integrations/supabase/sessao.ts#obterSessaoNoServidor",
  "src/integrations/supabase/papel.ts#obterPapelNoServidor",
  "src/shared/ui/sidebar-estado.ts#lerNoServidor",
  "src/shared/ui/tema.ts#lerTemaNoServidor",
]);

export interface MetaDaFuncao {
  readonly name: string;
  readonly filename: string;
}

export function chaveDaFuncao(meta: MetaDaFuncao | undefined): string {
  if (!meta) return "?#?";
  const arquivo = meta.filename.replace(/\\/g, "/").replace(/\?.*$/, "");
  const relativo = arquivo.includes("/src/")
    ? arquivo.slice(arquivo.lastIndexOf("/src/") + 1)
    : arquivo.replace(/^\/+/, "");
  const nome = meta.name.replace(/_createServerFn_handler$/, "");
  return `${relativo}#${nome}`;
}

export function ehFuncaoPublica(meta: MetaDaFuncao | undefined): boolean {
  return FUNCOES_PUBLICAS.has(chaveDaFuncao(meta));
}

export function baldeDaFuncao(meta: MetaDaFuncao | undefined): string {
  return chaveDaFuncao(meta)
    .split("#")[1]!
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .slice(0, 48);
}

const LIMITE_POR_MINUTO = 60;

async function registrarRecusa(chave: string, ip: string | undefined): Promise<void> {
  try {
    const { registrarEventoDeSeguranca } = await import("@/lib/trilha.server");
    await registrarEventoDeSeguranca("sessao_recusada", chave, ip);
  } catch {
    // Trilha e melhor esforco: a recusa em si ja e a resposta.
  }
}

export const exigirSessaoPorPadrao = createMiddleware({ type: "function" }).server(
  async ({ next, serverFnMeta }) => {
    const meta = serverFnMeta as MetaDaFuncao | undefined;
    if (ehFuncaoPublica(meta))
      return next({ context: { sessao: null as PedidoAutenticado | null } });

    const request = getRequest();
    const pedido = await autenticarPedido(request);
    if (pedido === null) {
      const ip = getRequestIP({ xForwardedFor: true });
      await registrarRecusa(chaveDaFuncao(meta), ip);
      throw new Response("Unauthorized", { status: 401 });
    }

    const { dentroDoLimite } = await import("@/lib/limite-do-usuario.server");
    const permitido = await dentroDoLimite(
      pedido.userId,
      baldeDaFuncao(meta),
      LIMITE_POR_MINUTO,
      60,
    );
    if (permitido === false) {
      throw new Response("Too Many Requests", { status: 429 });
    }

    return next({ context: { sessao: pedido as PedidoAutenticado | null } });
  },
);
