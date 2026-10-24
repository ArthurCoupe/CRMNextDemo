import { describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "http://supabase.test");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
let userValido = false;
vi.stubGlobal("fetch", (entrada: RequestInfo | URL) => {
  if (String(entrada).includes("/auth/v1/user")) {
    const [status, corpo] = userValido
      ? [200, { id: "u2", aud: "authenticated", email: "pessoa@empresa.test" }]
      : [403, { code: "session_not_found", message: "sessao encerrada" }];
    return Promise.resolve(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "content-type": "application/json", "x-supabase-api-version": "2024-01-01" },
      }),
    );
  }
  return Promise.reject(new Error(`chamada inesperada: ${String(entrada)}`));
});

const { supabase, conferirToken } = await import("./client.browser");
await supabase.auth.stopAutoRefresh();

const CHAVE = "sb-supabase-auth-token";
const storage = (
  supabase.auth as unknown as {
    storage: {
      setItem(chave: string, valor: string): Promise<void>;
      getItem(chave: string): Promise<string | null>;
    };
  }
).storage;

async function gravarSessao() {
  const agora = Math.floor(Date.now() / 1000);
  await storage.setItem(
    CHAVE,
    JSON.stringify({
      access_token: "a.b.c",
      refresh_token: "r",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: agora + 3600,
      user: { id: "u1", email: "dona@empresa.test" },
    }),
  );
}

describe("conferirToken", () => {
  it("🔴 com o link na URL: devolve o e-mail sem ler nem apagar o fragmento, e a sessão fica", async () => {
    const fragmento =
      "#access_token=eyJ.a.b&expires_at=1759370000&expires_in=3600&refresh_token=rt123&sb=&token_type=bearer&type=recovery";
    window.history.replaceState(null, "", `/nova-senha${fragmento}`);
    await gravarSessao();
    userValido = true;

    const { data, error } = await conferirToken("eyJ.a.b");
    await new Promise((resolver) => setTimeout(resolver, 200));
    userValido = false;

    expect(error).toBeNull();
    expect(data.user?.email).toBe("pessoa@empresa.test");
    expect(window.location.hash).toBe(fragmento);
    expect(JSON.parse((await storage.getItem(CHAVE)) ?? "{}")).toMatchObject({
      access_token: "a.b.c",
    });
    window.history.replaceState(null, "", "/");
  });

  it("🔴 token de sessão encerrada: devolve erro e a sessão deste navegador fica", async () => {
    await gravarSessao();

    const { data, error } = await conferirToken("token.de.outra.sessao");

    expect(data.user).toBeNull();
    expect(error).not.toBeNull();
    expect(await storage.getItem(CHAVE)).not.toBeNull();
  });

  it("controle: getUser(token) no cliente compartilhado apaga a sessão (o defeito evitado)", async () => {
    await gravarSessao();

    await supabase.auth.getUser("token.de.outra.sessao");

    expect(await storage.getItem(CHAVE)).toBeNull();
  });
});
