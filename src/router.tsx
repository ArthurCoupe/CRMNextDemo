import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";

import { routeTree } from "./routeTree.gen";
import { publicarNonceDaPagina } from "./shared/lib/csp";

const obterNonce = createIsomorphicFn()
  .server(async () => {
    const { lerNonce } = await import("./lib/nonce.server");
    return lerNonce();
  })
  .client(() => publicarNonceDaPagina(document));

export const getRouter = async () => {
  const queryClient = new QueryClient();
  const nonce = await obterNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};
