import { createIsomorphicFn, createMiddleware } from "@tanstack/react-start";

const lerTokenDaSessao = createIsomorphicFn()
  .server(async () => {
    const { criarClienteSsr } = await import("./client.ssr");
    const { data } = await criarClienteSsr().auth.getSession();
    return data.session?.access_token ?? null;
  })
  .client(async () => {
    const { supabase } = await import("./client.browser");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  });

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = (await lerTokenDaSessao()) ?? null;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
