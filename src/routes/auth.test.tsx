import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { AuthClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
const fetchSimulado = vi.fn();
function respostaDaRota(status: number, corpo: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function corpoDoPedido(n: number): Record<string, unknown> {
  const [url, init] = fetchSimulado.mock.calls[n] as [string, RequestInit];
  expect(url).toBe("/api/recuperar");
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess, message: vi.fn(), info: vi.fn() },
}));
const getAuthenticatorAssuranceLevel = vi
  .fn()
  .mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
const listFactors = vi.fn().mockResolvedValue({ data: { totp: [] }, error: null });
vi.mock("@/integrations/supabase/client.browser", () => ({
  supabase: {
    auth: {
      signInWithPassword,
      mfa: { getAuthenticatorAssuranceLevel, listFactors },
    },
  },
}));
vi.mock("@/integrations/supabase/sessao", () => ({ obterSessao: async () => null }));

const tokenDoCaptcha = vi.fn().mockResolvedValue(undefined);
vi.mock("@/shared/ui/captcha-invisivel", async (original) => ({
  ...(await original<typeof import("@/shared/ui/captcha-invisivel")>()),
  useCaptchaInvisivel: () => ({ widget: null, token: tokenDoCaptcha }),
}));

const modo = vi.hoisted(() => ({ demo: false }));
vi.mock("@/shared/lib/demo", async (original) => ({
  ...(await original<typeof import("@/shared/lib/demo")>()),
  get MODO_DEMO() {
    return modo.demo;
  },
}));

const { AuthPage, Route: AuthRoute } = await import("./auth");
const { MENSAGEM_DO_CAPTCHA } = await import("@/shared/ui/captcha-invisivel");
const { AVISO_DA_DEMO, CONTA_DA_DEMO } = await import("@/shared/lib/demo");

async function renderizarAuthPage(entradaInicial: string = "/auth") {
  const rootRoute = createRootRoute();
  AuthRoute.update({
    id: "/auth",
    path: "/auth",
    getParentRoute: () => rootRoute,
  } as unknown as Parameters<typeof AuthRoute.update>[0]);
  const router = createRouter({
    routeTree: rootRoute.addChildren([AuthRoute]),
    history: createMemoryHistory({ initialEntries: [entradaInicial] }),
  });
  await router.load();
  return render(
    <RouterContextProvider router={router}>
      <AuthPage />
    </RouterContextProvider>,
  );
}

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  fetchSimulado.mockReset().mockImplementation(async () => respostaDaRota(200));
  vi.stubGlobal("fetch", fetchSimulado);
  tokenDoCaptcha.mockReset().mockResolvedValue(undefined);
  toastError.mockClear();
  toastSuccess.mockClear();
  modo.demo = false;
});

function textoDaTela(): string {
  return document.body.textContent ?? "";
}

describe("recuperacao de senha", () => {
  it("🔴 pedir recuperacao NAO tenta entrar", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    expect(corpoDoPedido(0).email).toBe("pessoa@exemplo.test");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("🔴 sem e-mail preenchido nao dispara nada", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    await waitFor(() => expect(fetchSimulado).not.toHaveBeenCalled());
  });

  it("🔴 a confirmacao NAO revela se o e-mail existe", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "naoexiste@x.com");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    expect(await screen.findByText(/Se esse e-mail tiver conta/i)).toBeInTheDocument();
  });

  it("🔴 nem a tela nem o toast revelam nada quando o Supabase devolve erro", async () => {
    fetchSimulado.mockResolvedValueOnce(respostaDaRota(400, { error: "User not found" }));

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "naoexiste@x.com");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    expect(await screen.findByText(/Se esse e-mail tiver conta/i)).toBeInTheDocument();
    expect(textoDaTela()).not.toMatch(
      /não tem conta|nao tem conta|não existe|nao existe|not found|nenhuma conta|desconhecid/i,
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it("🔴 a TELA INTEIRA é idêntica nos dois casos, caractere a caractere", async () => {
    const comConta = await rodadaDeRecuperacao(respostaDaRota(200));
    const semConta = await rodadaDeRecuperacao(respostaDaRota(400, { error: "User not found" }));

    expect(comConta.texto).toMatch(/Se esse e-mail tiver conta/);
    expect(semConta.texto).toBe(comConta.texto);
    expect(semConta.chamadasDeToast).toBe(comConta.chamadasDeToast);
  });

  it("entrar continua funcionando", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123");
    await user.click(screen.getByRole("button", { name: /^Entrar$/ }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
  });
});

async function erroRealDoGoTrue(
  chamar: (cliente: InstanceType<typeof AuthClient>) => Promise<{ error: unknown }>,
  status: number,
  corpo: Record<string, string>,
): Promise<unknown> {
  const cliente = new AuthClient({
    url: "http://gotrue.invalido",
    storageKey: `duplo-${status}-${contadorDeDuplos++}`,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    fetch: async () =>
      new Response(JSON.stringify(corpo), {
        status,
        headers: {
          "Content-Type": "application/json",
          "X-Supabase-Api-Version": "2024-01-01",
        },
      }),
  });
  const { error } = await chamar(cliente);
  return error;
}

let contadorDeDuplos = 0;

const erroDeCredencial = () =>
  erroRealDoGoTrue((c) => c.signInWithPassword({ email: "a@b.com", password: "x" }), 400, {
    code: "invalid_credentials",
    error_code: "invalid_credentials",
    msg: "Invalid login credentials",
  });

describe("B1 — Enter envia o formulario", () => {
  it("🔴 Enter no campo de senha dispara o login", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(signInWithPassword.mock.calls[0][0]).toEqual({
      email: "pessoa@exemplo.test",
      password: "segredo123",
    });
  });

  it("Enter acerta o botao certo: nao pede recuperacao de senha", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('🔴 "Esqueci minha senha" continua type="button" — a regressao do B1', async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    const botao = screen.getByRole("button", { name: /Esqueci minha senha/i });
    expect(botao).toHaveAttribute("type", "button");

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123");
    await user.click(botao);

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("B2 — a falha de login chega em portugues", () => {
  it("🔴 'Invalid login credentials' vira portugues e NAO diz se o e-mail existe", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: await erroDeCredencial() });

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "errada{Enter}");

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("E-mail ou senha incorretos.");
    expect(String(toastError.mock.calls[0][0])).not.toMatch(
      /credential|not found|não existe|nao existe|não cadastrad|nao cadastrad|nenhuma conta|desconhecid/i,
    );
    expect(textoDaTela()).not.toMatch(/Invalid login credentials/);
  });

  it("🔴 codigo desconhecido cai no generico em portugues, nunca no texto cru", async () => {
    const erro = await erroRealDoGoTrue(
      (c) => c.signInWithPassword({ email: "a@b.com", password: "x" }),
      400,
      { code: "codigo_que_o_sdk_nao_conhece", msg: "Something went terribly wrong" },
    );
    signInWithPassword.mockResolvedValueOnce({ error: erro });

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "errada{Enter}");

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "Não foi possível entrar agora. Tente de novo em alguns instantes.",
    );
    expect(String(toastError.mock.calls[0][0])).not.toMatch(/terribly wrong/);
  });

  it("login que da certo nao mostra erro nenhum", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("B3 — campo vazio na recuperacao diz o que fazer", () => {
  it("🔴 clicar com o campo vazio mostra a instrucao", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    expect(await screen.findByText(/Digite seu e-mail para receber o link/i)).toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it("com e-mail preenchido a instrucao NAO aparece", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    expect(await screen.findByText(/Se esse e-mail tiver conta/i)).toBeInTheDocument();
    expect(screen.queryByText(/Digite seu e-mail para receber o link/i)).not.toBeInTheDocument();
  });

  it("digitar so espaco no campo de e-mail nao dispara envio — o input descarta antes do estado", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    const campo = screen.getByLabelText(/E-mail|Email/) as HTMLInputElement;
    await user.type(campo, "   ");
    expect(campo.value).toBe("");

    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    expect(await screen.findByText(/Digite seu e-mail para receber o link/i)).toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

async function rodadaDeRecuperacao(resposta: Response) {
  fetchSimulado.mockResolvedValueOnce(resposta);
  const user = userEvent.setup();
  const { unmount } = await renderizarAuthPage();
  await user.type(screen.getByLabelText(/E-mail|Email/), "alguem@x.com");
  await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));
  await screen.findByText(/Se esse e-mail tiver conta/i);
  const texto = textoDaTela();
  const chamadasDeToast = toastError.mock.calls.map((c) => String(c[0])).join(" | ");
  unmount();
  return { texto, chamadasDeToast };
}

describe("B4 — a recuperacao nao distingue NENHUM caso vindo do servidor", () => {
  it("🔴 429 e sucesso deixam a TELA INTEIRA identica, caractere a caractere", async () => {
    const comConta = await rodadaDeRecuperacao(respostaDaRota(200));
    const limitado = await rodadaDeRecuperacao(respostaDaRota(429, { error: "Too many requests" }));

    expect(comConta.texto).toMatch(/Se esse e-mail tiver conta/);
    expect(limitado.texto).toBe(comConta.texto);
    expect(limitado.chamadasDeToast).toBe(comConta.chamadasDeToast);
  });

  it("🔴 o 429 NAO vaza o texto do servidor, nem traduzido", async () => {
    fetchSimulado.mockResolvedValueOnce(
      respostaDaRota(429, {
        error: "For security purposes, you can only request this after 44 seconds.",
      }),
    );

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    await screen.findByText(/Se esse e-mail tiver conta/i);
    expect(textoDaTela()).not.toMatch(/second|security|44|Muitas tentativas/i);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("🔴 a frase unica NAO promete que o e-mail chegou", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    await screen.findByText(/Se esse e-mail tiver conta/i);
    expect(textoDaTela()).toMatch(/procure o administrador/i);
    expect(textoDaTela()).not.toMatch(/chegou nele/i);
  });

  it("🔴 400 continua caindo na mesma frase — nenhum status do servidor se distingue", async () => {
    fetchSimulado.mockResolvedValueOnce(respostaDaRota(400, { error: "User not found" }));

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "naoexiste@x.com");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    expect(await screen.findByText(/Se esse e-mail tiver conta/i)).toBeInTheDocument();
    expect(textoDaTela()).not.toMatch(/Muitas tentativas|not found|não existe|nao existe/i);
  });

  it("🔴 rede caida avisa da rede, e NAO passa por sucesso — status 0", async () => {
    fetchSimulado.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    expect(await screen.findByText(/Não foi possível falar com o servidor/i)).toBeInTheDocument();
    expect(screen.queryByText(/Se esse e-mail tiver conta/i)).not.toBeInTheDocument();
    expect(textoDaTela()).not.toMatch(/Failed to fetch/i);
  });
});

describe("B2 — os outros dois ramos da traducao, para nenhum ficar sem teste", () => {
  it("429 no login vira aviso de limite, nao 'senha incorreta'", async () => {
    const erro = await erroRealDoGoTrue(
      (c) => c.signInWithPassword({ email: "a@b.com", password: "x" }),
      429,
      { code: "over_request_rate_limit", msg: "Request rate limit reached" },
    );
    signInWithPassword.mockResolvedValueOnce({ error: erro });

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    );
  });

  it("🔴 falha de rede nao vira 'senha incorreta' — status 0, medido", async () => {
    const cliente = new AuthClient({
      url: "http://gotrue.invalido",
      storageKey: `duplo-rede-${contadorDeDuplos++}`,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      fetch: () => Promise.reject(new TypeError("Failed to fetch")),
    });
    const { error } = await cliente.signInWithPassword({ email: "a@b.com", password: "x" });
    expect(error?.status).toBe(0);
    signInWithPassword.mockResolvedValueOnce({ error });

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.",
    );
    expect(String(toastError.mock.calls[0][0])).not.toMatch(/senha incorret|Failed to fetch/i);
  });
});

describe("A2 — nenhum codigo de conta reconhecida ganha resposta propria", () => {
  const CODIGOS_QUE_NAO_PODEM_SE_DISTINGUIR = [
    "user_not_found",
    "email_not_confirmed",
    "phone_not_confirmed",
    "user_banned",
    "user_sso_managed",
    "email_address_not_authorized",
  ];

  it.each(CODIGOS_QUE_NAO_PODEM_SE_DISTINGUIR)(
    "🔴 '%s' devolve a MESMA string de invalid_credentials",
    async (codigo) => {
      const erro = await erroRealDoGoTrue(
        (c) => c.signInWithPassword({ email: "a@b.com", password: "x" }),
        400,
        { code: codigo, msg: `mensagem crua de ${codigo}` },
      );
      expect((erro as { code?: string }).code).toBe(codigo);
      signInWithPassword.mockResolvedValueOnce({ error: erro });

      const user = userEvent.setup();
      await renderizarAuthPage();

      await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
      await user.type(screen.getByLabelText(/Senha/), "errada{Enter}");

      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(toastError).toHaveBeenCalledWith("E-mail ou senha incorretos.");
      expect(textoDaTela()).not.toMatch(new RegExp(codigo, "i"));
    },
  );
});

describe("A5 — o 429 do login chega SEM code quando o GoTrue e velho", () => {
  it("🔴 429 sem code continua virando aviso de limite", async () => {
    const erro = await erroRealDoGoTrue(
      (c) => c.signInWithPassword({ email: "a@b.com", password: "x" }),
      429,
      { msg: "Request rate limit reached" },
    );
    expect((erro as { code?: string }).code).toBeUndefined();
    expect((erro as { status?: number }).status).toBe(429);
    signInWithPassword.mockResolvedValueOnce({ error: erro });

    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    );
  });
});

describe("A3 — a validacao de e-mail e nossa, e em portugues", () => {
  it("🔴 e-mail malformado avisa em portugues em vez de a tela travar", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "abc");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("Digite um e-mail válido.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("o campo continua type=email — teclado do celular e autofill dependem disso", async () => {
    await renderizarAuthPage();
    expect(screen.getByLabelText(/E-mail|Email/)).toHaveAttribute("type", "email");
  });

  it("e-mail bem formado passa direto — a guarda nao recusa sempre", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("A4 — o aviso e anunciado e nao fica preso na tela", () => {
  it("🔴 o aviso tem role=status, senao o leitor de tela nao o anuncia", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    const anuncio = await screen.findByRole("status");
    expect(anuncio).toHaveTextContent(/Digite seu e-mail para receber o link/i);
  });

  it("🔴 o aviso e limpo quando a pessoa volta a tentar entrar", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));
    await screen.findByText(/Se esse e-mail tiver conta/i);

    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText(/Se esse e-mail tiver conta/i)).not.toBeInTheDocument(),
    );
  });

  it("🔴 o aviso de campo vazio some quando o e-mail e preenchido e a pessoa tenta de novo", async () => {
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));
    await screen.findByText(/Digite seu e-mail para receber o link/i);

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    expect(await screen.findByText(/Se esse e-mail tiver conta/i)).toBeInTheDocument();
    expect(screen.queryByText(/Digite seu e-mail para receber o link/i)).not.toBeInTheDocument();
  });
});

describe("AUTH-1 — o destino pos-login nao aceita path fora da origem", () => {
  it("🔴 ?redirect=/\\evil.com NAO leva o location.assign para fora do app", async () => {
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderizarAuthPage("/auth?redirect=/\\evil.com");

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(assign).not.toHaveBeenCalledWith(expect.stringContaining("evil.com"));
  });

  it("caminho interno em ?redirect= continua funcionando — a guarda nao recusa sempre", async () => {
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderizarAuthPage("/auth?redirect=/pipeline");

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/pipeline"));
  });
});

describe("C25 — captcha no login e na recuperacao", () => {
  it("🔴 o token do captcha vai no login e na recuperacao", async () => {
    tokenDoCaptcha.mockResolvedValue("tok-1");
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    expect(corpoDoPedido(0)).toEqual({ email: "pessoa@exemplo.test", captchaToken: "tok-1" });

    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(signInWithPassword.mock.calls[0][0]).toEqual({
      email: "pessoa@exemplo.test",
      password: "segredo123",
      options: { captchaToken: "tok-1" },
    });
  });

  it("🔴 captcha que falha: toast em portugues, nada vai ao Auth, e o botao destrava", async () => {
    tokenDoCaptcha.mockRejectedValue(new Error("challenge-closed"));
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.type(screen.getByLabelText(/Senha/), "segredo123{Enter}");

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(MENSAGEM_DO_CAPTCHA));
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Entrar$/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(2));
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

describe("C32 — a recuperacao pela rota /api/recuperar", () => {
  it("🔴 a rota recusa o captcha: toast em portugues e NENHUMA frase de envio", async () => {
    fetchSimulado.mockResolvedValueOnce(respostaDaRota(400, { error: "captcha" }));
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.type(screen.getByLabelText(/E-mail|Email/), "pessoa@exemplo.test");
    await user.click(screen.getByRole("button", { name: /Esqueci minha senha/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(MENSAGEM_DO_CAPTCHA));
    expect(screen.queryByText(/Se esse e-mail tiver conta/i)).not.toBeInTheDocument();
  });
});

describe("modo demo (docs/DEMO.md)", () => {
  it("'Entrar na demo' entra com a conta da demo, sem nada digitado", async () => {
    modo.demo = true;
    const user = userEvent.setup();
    await renderizarAuthPage();

    await user.click(screen.getByRole("button", { name: "Entrar na demo" }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledTimes(1));
    expect(signInWithPassword.mock.calls[0][0]).toMatchObject({
      email: CONTA_DA_DEMO.email,
      password: CONTA_DA_DEMO.senha,
    });
  });

  it("🔴 sem 'Esqueci minha senha' (a rota de recuperação não existe na demo) e com o aviso", async () => {
    modo.demo = true;
    await renderizarAuthPage();
    expect(screen.queryByRole("button", { name: /Esqueci minha senha/i })).toBeNull();
    expect(screen.getByText(AVISO_DA_DEMO)).toBeInTheDocument();
  });

  it("🔴 controle: desligado (produção), sem botão nem conta da demo, e com a recuperação", async () => {
    await renderizarAuthPage();
    expect(screen.queryByRole("button", { name: "Entrar na demo" })).toBeNull();
    expect(document.body.textContent).not.toContain(CONTA_DA_DEMO.email);
    expect(screen.getByRole("button", { name: /Esqueci minha senha/i })).toBeInTheDocument();
    expect(screen.queryByText(AVISO_DA_DEMO)).toBeNull();
  });
});
