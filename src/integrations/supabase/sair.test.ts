import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CHAVE = "sb-teste-auth-token";

type Resposta = () => Promise<Response>;

const h = vi.hoisted(() => {
  const guardado = new Map<string, string>();
  return {
    guardado,
    storage: {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    },
    chamadas: [] as { caminho: string; auth: string | null }[],
    respostaDoLogout: [] as (() => Promise<Response>)[],
    respostaDoToken: (): Promise<Response> => Promise.reject(new Error("/token não esperado")),
    quebrarStorage: false,
  };
});

const fetchFalso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = String(entrada);
  const caminho = url.replace("http://supabase.test", "");
  h.chamadas.push({ caminho, auth: new Headers(init?.headers).get("authorization") });
  if (url.includes("/auth/v1/logout")) {
    const proxima = h.respostaDoLogout.shift();
    if (!proxima) throw new Error(`/logout sem resposta configurada: ${caminho}`);
    return proxima();
  }
  if (url.includes("/auth/v1/token")) return h.respostaDoToken();
  throw new Error(`chamada inesperada: ${url}`);
});

vi.mock("./client.browser", () => ({
  supabase: createClient("http://supabase.test", "sb_publishable_teste", {
    auth: {
      storage: {
        getItem: (k: string) => {
          if (h.quebrarStorage) throw new TypeError("storage quebrado");
          return h.storage.getItem(k);
        },
        setItem: h.storage.setItem,
        removeItem: h.storage.removeItem,
      },
      storageKey: CHAVE,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchFalso },
  }),
}));

const { sairDaConta, sairSoDesteNavegador } = await import("./sair");
const { supabase } = await import("./client.browser");

const agora = () => Math.floor(Date.now() / 1000);

function jwt(marca: string): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return `${b64({ alg: "ES256", typ: "JWT" })}.${b64({ sub: "u1", exp: agora() + 3600, marca })}.assinatura`;
}

const USUARIO = {
  id: "u1",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "",
};
const TOKEN_A = jwt("a");
const TOKEN_B = jwt("b");

function sessao(token: string, refresh: string, expiraEm: number) {
  return {
    access_token: token,
    refresh_token: refresh,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiraEm,
    user: USUARIO,
  };
}

function json(status: number, corpo: object): Resposta {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
}
const vazio =
  (status: number): Resposta =>
  () =>
    Promise.resolve(new Response(null, { status }));
const TOKEN_NOVO = json(200, sessao(TOKEN_B, "refresh-b", agora() + 3600));

const caminhos = () => h.chamadas.map((c) => c.caminho);
const GLOBAL = "/auth/v1/logout?scope=global";
const LOCAL = "/auth/v1/logout?scope=local";
const TOKEN = "/auth/v1/token?grant_type=refresh_token";

let serie = 0;
function guardar(expiraEm = agora() + 3600) {
  serie += 1;
  h.storage.setItem(CHAVE, JSON.stringify(sessao(TOKEN_A, `refresh-a-${serie}`, expiraEm)));
}

beforeEach(() => {
  h.guardado.clear();
  h.chamadas.length = 0;
  h.respostaDoLogout = [];
  h.respostaDoToken = () => Promise.reject(new Error("/token não esperado"));
  h.quebrarStorage = false;
  guardar();
});

describe("sairDaConta: /logout falhou, a sessão local FICA", () => {
  it.each([
    ["500", json(500, { code: 500, msg: "erro" })],
    ["falha de rede", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["400", json(400, { code: 400, error_code: "validation_failed", msg: "x" })],
    ["422", json(422, { code: 422, error_code: "unexpected_failure", msg: "x" })],
    ["429", json(429, { code: 429, error_code: "over_request_rate_limit", msg: "x" })],
    [
      "403 em HTML (gateway)",
      () =>
        Promise.resolve(
          new Response("<html>bloqueado</html>", {
            status: 403,
            headers: { "content-type": "text/html" },
          }),
        ),
    ],
  ])("🔴 %s: devolve o erro, não renova, não apaga", async (_nome, resposta) => {
    h.respostaDoLogout = [resposta];

    const { error } = await sairDaConta();

    expect(error).not.toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(true);
    expect(caminhos()).toEqual([GLOBAL]);
  });
});

describe("sairDaConta: servidor confirmou, a sessão local SAI", () => {
  it("204: revoga com o JWT da sessão, depois apaga a local", async () => {
    h.respostaDoLogout = [vazio(204), vazio(204)];

    const { error } = await sairDaConta();

    expect(error).toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(false);
    expect(caminhos()).toEqual([GLOBAL, LOCAL]);
    expect(h.chamadas[0]?.auth).toBe(`Bearer ${TOKEN_A}`);
  });

  it("404 session_not_found: a sessão já não existe no servidor, sem renovar", async () => {
    h.respostaDoLogout = [json(404, { code: 404, error_code: "session_not_found" }), vazio(204)];

    const { error } = await sairDaConta();

    expect(error).toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(false);
    expect(caminhos()).not.toContain(TOKEN);
  });

  it("sem sessão: não chama o servidor para revogar e não dá erro", async () => {
    h.guardado.clear();

    const { error } = await sairDaConta();

    expect(error).toBeNull();
    expect(caminhos()).not.toContain(GLOBAL);
  });
});

describe("sairDaConta: JWT recusado no /logout", () => {
  it.each([
    ["401 bad_jwt", json(401, { code: 401, error_code: "bad_jwt", msg: "expired" })],
    ["403 sem código", json(403, { code: 403, msg: "x" })],
    ["404 sem código", json(404, { code: 404, msg: "x" })],
  ])("🔴 %s: renova e revoga com o JWT NOVO, depois apaga", async (_nome, recusa) => {
    h.respostaDoLogout = [recusa, vazio(204), vazio(204)];
    h.respostaDoToken = TOKEN_NOVO;

    const { error } = await sairDaConta();

    expect(error).toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(false);
    expect(caminhos()).toEqual([GLOBAL, TOKEN, GLOBAL, LOCAL]);
    expect(h.chamadas[2]?.auth).toBe(`Bearer ${TOKEN_B}`);
  });

  it("🔴 o JWT novo também é recusado: devolve o erro e a sessão FICA", async () => {
    h.respostaDoLogout = [
      json(401, { code: 401, error_code: "bad_jwt", msg: "x" }),
      json(401, { code: 401, error_code: "bad_jwt", msg: "x" }),
    ];
    h.respostaDoToken = TOKEN_NOVO;

    const { error } = await sairDaConta();

    expect(error).not.toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(true);
    expect(caminhos()).toEqual([GLOBAL, TOKEN, GLOBAL]);
  });

  it.each([
    ["refresh_token_not_found", 400],
    ["refresh_token_already_used", 400],
    ["session_expired", 403],
    ["session_not_found", 404],
  ])(
    "a renovação diz %s: sessão encerrada, sem erro e sem segundo /logout global",
    async (codigo, status) => {
      h.respostaDoLogout = [json(401, { code: 401, error_code: "bad_jwt", msg: "x" }), vazio(204)];
      h.respostaDoToken = json(status, { code: status, error_code: codigo, msg: "x" });

      const { error } = await sairDaConta();

      expect(error).toBeNull();
      expect(h.guardado.has(CHAVE)).toBe(false);
      expect(caminhos()).toEqual([GLOBAL, TOKEN, LOCAL]);
    },
  );

  it.each([
    ["429", json(429, { code: 429, error_code: "over_request_rate_limit", msg: "x" })],
    [
      "403 em HTML (gateway)",
      () =>
        Promise.resolve(
          new Response("<html>bloqueado</html>", {
            status: 403,
            headers: { "content-type": "text/html" },
          }),
        ),
    ],
  ])("🔴 a renovação falha com %s: devolve o erro e a sessão FICA", async (_nome, resposta) => {
    h.respostaDoLogout = [json(401, { code: 401, error_code: "bad_jwt", msg: "x" })];
    h.respostaDoToken = resposta;

    const { error } = await sairDaConta();

    expect(error).not.toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(true);
    expect(caminhos()).toEqual([GLOBAL, TOKEN]);
  });

  it("o segundo /logout diz session_not_found: sessão encerrada, sem erro", async () => {
    h.respostaDoLogout = [
      json(401, { code: 401, error_code: "bad_jwt", msg: "x" }),
      json(404, { code: 404, error_code: "session_not_found", msg: "x" }),
      vazio(204),
    ];
    h.respostaDoToken = TOKEN_NOVO;

    const { error } = await sairDaConta();

    expect(error).toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(false);
  });
});

describe("sairDaConta: clique repetido", () => {
  it("duas chamadas juntas dividem a mesma saída: um /logout global, nenhum erro", async () => {
    h.respostaDoLogout = [vazio(204), vazio(204)];

    const [a, b] = await Promise.all([sairDaConta(), sairDaConta()]);

    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(caminhos()).toEqual([GLOBAL, LOCAL]);
  });

  it("depois que a primeira termina, a próxima chamada roda de novo", async () => {
    h.respostaDoLogout = [json(500, { code: 500, msg: "erro" }), vazio(204), vazio(204)];

    expect((await sairDaConta()).error).not.toBeNull();
    expect((await sairDaConta()).error).toBeNull();
    expect(caminhos()).toEqual([GLOBAL, GLOBAL, LOCAL]);
  });
});

describe("sairDaConta: token já expirado no relógio local", () => {
  it("o getSession renova antes; o /logout vai com o JWT novo", async () => {
    guardar(agora() - 10);
    h.respostaDoToken = TOKEN_NOVO;
    h.respostaDoLogout = [vazio(204), vazio(204)];

    const { error } = await sairDaConta();

    expect(error).toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(false);
    expect(caminhos()).toEqual([TOKEN, GLOBAL, LOCAL]);
    expect(h.chamadas[1]?.auth).toBe(`Bearer ${TOKEN_B}`);
  });

  it("🔴 a renovação falha com erro que não é de sessão morta: devolve o erro, sem /logout", async () => {
    guardar(agora() - 10);
    h.respostaDoToken = json(429, { code: 429, error_code: "over_request_rate_limit", msg: "x" });

    const { error } = await sairDaConta();

    expect(error).not.toBeNull();
    expect(caminhos()).toEqual([TOKEN]);
  });

  it("a renovação diz que o refresh token morreu: sessão encerrada, sem erro", async () => {
    guardar(agora() - 10);
    h.respostaDoToken = json(400, { code: 400, error_code: "refresh_token_not_found", msg: "x" });

    const { error } = await sairDaConta();

    expect(error).toBeNull();
    expect(caminhos()).not.toContain(GLOBAL);
  });
});

it("exceção dentro do auth-js vira { error }, nunca rejeição (o botão não fica mudo)", async () => {
  h.quebrarStorage = true;

  const { error } = await sairDaConta();

  expect(error).not.toBeNull();
});

describe("sairSoDesteNavegador", () => {
  it("servidor responde: revoga esta sessão (scope=local) com o JWT dela e apaga a local", async () => {
    h.respostaDoLogout = [vazio(204)];

    await sairSoDesteNavegador();

    expect(caminhos()).toEqual([LOCAL]);
    expect(h.chamadas[0]?.auth).toBe(`Bearer ${TOKEN_A}`);
    expect(h.guardado.has(CHAVE)).toBe(false);
  });

  it("servidor fora: apaga a local mesmo assim", async () => {
    h.respostaDoLogout = [json(500, { code: 500, msg: "erro" })];

    await sairSoDesteNavegador();

    expect(h.guardado.has(CHAVE)).toBe(false);
  });

  const apagarCookie = (nome: string) =>
    (document.cookie = `${nome}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`);

  it("🔴 o auth-js nem carrega a sessão: apaga os cookies sb-* e deixa os outros", async () => {
    document.cookie = "sb-teste-auth-token=x; Path=/";
    document.cookie = "sb-teste-auth-token.1=y; Path=/";
    document.cookie = "outro=1; Path=/";
    h.quebrarStorage = true;
    try {
      await expect(sairSoDesteNavegador()).resolves.toBeUndefined();

      expect(document.cookie).not.toContain("sb-teste-auth-token");
      expect(document.cookie).toContain("outro=1");
    } finally {
      for (const nome of ["sb-teste-auth-token", "sb-teste-auth-token.1", "outro"]) {
        apagarCookie(nome);
      }
    }
  });

  it("🔴 signOut que lança: segue e apaga os cookies sb-*", async () => {
    document.cookie = "sb-teste-auth-token=x; Path=/";
    vi.spyOn(supabase.auth, "signOut").mockRejectedValueOnce(new Error("explodiu"));
    try {
      await expect(sairSoDesteNavegador()).resolves.toBeUndefined();

      expect(document.cookie).not.toContain("sb-teste-auth-token");
    } finally {
      apagarCookie("sb-teste-auth-token");
    }
  });

  it("🔴 servidor que não responde: espera no máximo o limite e apaga os cookies", async () => {
    document.cookie = "sb-teste-auth-token=x; Path=/";
    h.respostaDoLogout = [() => new Promise<Response>(() => {})];
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let terminou = false;
      const saida = sairSoDesteNavegador().then(() => {
        terminou = true;
      });

      await vi.advanceTimersByTimeAsync(3_999);
      expect(terminou).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await saida;

      expect(terminou).toBe(true);
      expect(document.cookie).not.toContain("sb-teste-auth-token");
    } finally {
      vi.useRealTimers();
      apagarCookie("sb-teste-auth-token");
    }
  });
});

describe("auth-js 2.117.2, comportamento que sair.ts contorna ou não consegue contornar", () => {
  it("signOut() puro apaga a sessão local mesmo com /logout 500", async () => {
    h.respostaDoLogout = [json(500, { code: 500, msg: "erro" })];

    const { error } = await supabase.auth.signOut();

    expect(error).not.toBeNull();
    expect(h.guardado.has(CHAVE)).toBe(false);
  });

  it("⚠️ risco residual: renovação com 429 apaga a sessão local sozinha", async () => {
    guardar(agora() - 10);
    h.respostaDoToken = json(429, { code: 429, error_code: "over_request_rate_limit", msg: "x" });

    await sairDaConta();

    expect(h.guardado.has(CHAVE)).toBe(false);
  });
});

it("ninguém em src/ chama auth.signOut fora de sair.ts", () => {
  const saida = execFileSync("git", ["grep", "-l", "auth.signOut(", "--", "src/"], {
    encoding: "utf8",
  });
  const arquivos = saida
    .trim()
    .split("\n")
    .filter((f) => !/\.test\.tsx?$/.test(f));
  expect(arquivos).toEqual(["src/integrations/supabase/sair.ts"]);
});
