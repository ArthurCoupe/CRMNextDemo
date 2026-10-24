import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

type Resolver = (resposta: Response) => void;

const pendente: { token: Resolver | null; logout: Resolver | null } = { token: null, logout: null };

vi.stubEnv("VITE_SUPABASE_URL", "http://supabase.test");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste");
vi.stubGlobal("fetch", (entrada: RequestInfo | URL) => {
  const url = String(entrada);
  if (url.includes("/auth/v1/token")) {
    return new Promise<Response>((resolver) => (pendente.token = resolver));
  }
  if (url.includes("/auth/v1/logout")) {
    return new Promise<Response>((resolver) => (pendente.logout = resolver));
  }
  return Promise.reject(new Error(`chamada inesperada: ${url}`));
});

const { supabase } = await import("./client.browser");
const { sairSoDesteNavegador } = await import("./sair");

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

const agora = () => Math.floor(Date.now() / 1000);

function sessao(refresh: string, expiraEm: number, accessToken = `at-${refresh}`) {
  return {
    access_token: accessToken,
    refresh_token: refresh,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiraEm,
    user: { id: "u1", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "" },
  };
}

const respostaDeToken = (refresh: string) =>
  new Response(JSON.stringify(sessao(refresh, agora() + 3600)), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const nomesSb = () =>
  document.cookie
    .split(";")
    .map((par) => par.trim().split("=")[0] ?? "")
    .filter((nome) => nome.startsWith("sb-"));

async function esperarPendente(qual: "token" | "logout") {
  for (let i = 0; i < 50 && pendente[qual] === null; i++) await vi.advanceTimersByTimeAsync(10);
  expect(pendente[qual], `${qual} não foi chamado`).not.toBeNull();
}

afterEach(() => {
  vi.useRealTimers();
  for (const nome of nomesSb()) {
    document.cookie = `${nome}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`;
  }
  pendente.token = null;
  pendente.logout = null;
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sairSoDesteNavegador com o cookie real do @supabase/ssr", () => {
  it("🔴 sessão gravada pelo pacote, em pedaços: a limpeza tira todos e o storage fica vazio", async () => {
    await storage.setItem(
      CHAVE,
      JSON.stringify(sessao("r-pedacos", agora() + 3600, "x".repeat(7000))),
    );
    expect(nomesSb().length).toBeGreaterThan(1);

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const saida = sairSoDesteNavegador();
    await esperarPendente("logout");
    await vi.advanceTimersByTimeAsync(4_000);
    await saida;

    expect(nomesSb()).toEqual([]);
    expect(await storage.getItem(CHAVE)).toBeNull();
  });

  it("controle: sem o corte, um /token que responde tarde regrava a sessão no cookie", async () => {
    await storage.setItem(CHAVE, JSON.stringify(sessao("r-controle", agora() - 100)));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const leitura = supabase.auth.getSession();
    await esperarPendente("token");
    pendente.token!(respostaDeToken("r-controle-novo"));
    await vi.advanceTimersByTimeAsync(50);
    await leitura;

    expect(await storage.getItem(CHAVE)).toContain("r-controle-novo");
  });

  it("🔴 /token responde depois do corte: a sessão NÃO volta", async () => {
    await storage.setItem(CHAVE, JSON.stringify(sessao("r-tardio", agora() - 100)));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const saida = sairSoDesteNavegador();
    await esperarPendente("token");
    await vi.advanceTimersByTimeAsync(4_000);
    await saida;
    expect(nomesSb()).toEqual([]);

    pendente.token!(respostaDeToken("r-tardio-novo"));
    await vi.advanceTimersByTimeAsync(50);

    expect(nomesSb()).toEqual([]);
    expect(await storage.getItem(CHAVE)).toBeNull();
  });
});
