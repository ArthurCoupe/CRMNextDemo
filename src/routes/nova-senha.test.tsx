import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const conferirToken = vi.fn();
const setSession = vi.fn();
const updateUser = vi.fn();

vi.mock("@/integrations/supabase/client.browser", () => ({
  supabase: { auth: { getSession, setSession, updateUser } },
  conferirToken,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { NovaSenhaPage, tokensDaRecuperacao } = await import("./nova-senha");
const { toast } = await import("sonner");

const CONTA = "pessoa@empresa.test";
const SESSAO = { data: { session: { access_token: "t", user: { email: CONTA } } } };
const AVISO_LINK_INVALIDO =
  "Este link de recuperação expirou ou já foi usado. Peça um novo em /auth.";
const SENHA_DE_TESTE = "abc123456789";

beforeEach(() => {
  getSession.mockReset();
  conferirToken.mockReset();
  setSession.mockReset();
  updateUser.mockReset();
  vi.mocked(toast.error).mockClear();
  window.history.replaceState(null, "", "/nova-senha");
});

async function preencher(
  user: UserEvent,
  {
    email = CONTA,
    senha = SENHA_DE_TESTE,
    confirmacao = senha,
  }: { email?: string; senha?: string; confirmacao?: string } = {},
) {
  await user.type(await screen.findByLabelText(/E-mail da sua conta/i), email);
  await user.type(screen.getByLabelText(/Nova senha/i), senha);
  await user.type(screen.getByLabelText(/Confirmar senha/i), confirmacao);
  await user.click(screen.getByRole("button", { name: /Salvar nova senha/i }));
}

const FRAGMENTO =
  "#access_token=eyJ.a.b&expires_at=1759370000&expires_in=3600&refresh_token=rt123&sb=&token_type=bearer&type=recovery";
const TOKENS = { access_token: "eyJ.a.b", refresh_token: "rt123" };

describe("tokensDaRecuperacao", () => {
  it("lê os dois tokens do fragmento de recuperação", () => {
    expect(tokensDaRecuperacao(FRAGMENTO)).toEqual(TOKENS);
  });

  it.each([
    ["vazio", ""],
    ["outro tipo", FRAGMENTO.replace("type=recovery", "type=signup")],
    ["sem refresh", FRAGMENTO.replace("refresh_token=rt123&", "")],
    ["erro do GoTrue", "#error=access_denied&error_code=otp_expired&error_description=x"],
  ])("%s: null", (_, hash) => {
    expect(tokensDaRecuperacao(hash)).toBeNull();
  });
});

describe("🔴 link de recuperação: tokens no fragmento", () => {
  function abrirLink(caminho = "/nova-senha") {
    window.history.replaceState(null, "", `${caminho}${FRAGMENTO}`);
    conferirToken.mockResolvedValue({ data: { user: { email: CONTA } }, error: null });
  }

  it("confere o token sem gravar sessão, mostra o formulário e o link fica na URL até o envio", async () => {
    abrirLink();

    render(<NovaSenhaPage />);

    expect(await screen.findByLabelText(/E-mail da sua conta/i)).toBeInTheDocument();
    expect(conferirToken).toHaveBeenCalledWith("eyJ.a.b");
    expect(setSession).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(FRAGMENTO);
    expect(screen.queryByText(CONTA)).not.toBeInTheDocument();
  });

  it("F5 com o formulário aberto: o link é conferido de novo e o formulário volta", async () => {
    abrirLink();
    const primeira = render(<NovaSenhaPage />);
    await screen.findByLabelText(/E-mail da sua conta/i);
    primeira.unmount();

    render(<NovaSenhaPage />);

    expect(await screen.findByLabelText(/E-mail da sua conta/i)).toBeInTheDocument();
    expect(conferirToken).toHaveBeenCalledTimes(2);
  });

  it("e-mail da conta conferido: grava a sessão do link, apaga o fragmento e só depois troca a senha", async () => {
    abrirLink();
    setSession.mockResolvedValue({ data: { session: {} }, error: null });
    updateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<NovaSenhaPage />);
    await preencher(user, { email: "  Pessoa@Empresa.TEST " });

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: SENHA_DE_TESTE }));
    expect(setSession).toHaveBeenCalledWith(TOKENS);
    expect(setSession.mock.invocationCallOrder[0]).toBeLessThan(
      updateUser.mock.invocationCallOrder[0]!,
    );
    expect(window.location.hash).toBe("");
  });

  it("🔴 e-mail de outra conta (link montado): a sessão deste navegador não é tocada", async () => {
    abrirLink();
    const user = userEvent.setup();

    render(<NovaSenhaPage />);
    await preencher(user, { email: "outra@empresa.test" });

    expect(toast.error).toHaveBeenCalledWith(
      "Esse não é o e-mail da conta deste link. Confira o e-mail ou peça um novo link em /auth.",
    );
    expect(setSession).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(FRAGMENTO);
  });

  it("falha passageira ao gravar a sessão no envio: pede nova tentativa e o link fica", async () => {
    abrirLink();
    setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { __isAuthError: true, name: "AuthRetryableFetchError", status: 0 },
    });
    const user = userEvent.setup();

    render(<NovaSenhaPage />);
    await preencher(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível confirmar o link agora. Tente de novo.",
      ),
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(FRAGMENTO);
  });

  it("a sessão do link recusada no envio: aviso de link inválido, senha não é tocada", async () => {
    abrirLink();
    setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { __isAuthError: true, name: "AuthApiError", status: 403 },
    });
    const user = userEvent.setup();

    render(<NovaSenhaPage />);
    await preencher(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(AVISO_LINK_INVALIDO));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("token recusado pelo GoTrue: link inválido, sem formulário, fragmento apagado", async () => {
    window.history.replaceState(null, "", `/nova-senha${FRAGMENTO}`);
    conferirToken.mockResolvedValue({
      data: { user: null },
      error: { __isAuthError: true, name: "AuthApiError", status: 403, code: "bad_jwt" },
    });

    render(<NovaSenhaPage />);

    expect(await screen.findByText(/expirou ou já foi usado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nova senha/i)).not.toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it.each([
    ["rede", { __isAuthError: true, name: "AuthRetryableFetchError", status: 0 }],
    ["429", { __isAuthError: true, name: "AuthApiError", status: 429 }],
    ["503", { __isAuthError: true, name: "AuthApiError", status: 503 }],
  ])("falha passageira (%s): pede para recarregar e o link fica na URL", async (_, error) => {
    window.history.replaceState(null, "", `/nova-senha${FRAGMENTO}`);
    conferirToken.mockResolvedValue({ data: { user: null }, error });

    render(<NovaSenhaPage />);

    expect(await screen.findByText(/Recarregue a página/i)).toBeInTheDocument();
    expect(screen.queryByText(/expirou ou já foi usado/i)).not.toBeInTheDocument();
    expect(window.location.hash).toBe(FRAGMENTO);
  });

  it("conferência rejeitada (exceção): link inválido, fragmento apagado", async () => {
    window.history.replaceState(null, "", `/nova-senha${FRAGMENTO}`);
    conferirToken.mockRejectedValue(new Error("lock"));

    render(<NovaSenhaPage />);

    expect(await screen.findByText(/expirou ou já foi usado/i)).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("a query da URL fica; só o fragmento sai, no envio", async () => {
    abrirLink("/nova-senha?origem=email");
    setSession.mockResolvedValue({ data: { session: {} }, error: null });
    updateUser.mockResolvedValue({ error: { code: "same_password" } });
    const user = userEvent.setup();

    render(<NovaSenhaPage />);
    await preencher(user);

    await waitFor(() => expect(updateUser).toHaveBeenCalled());
    expect(window.location.search).toBe("?origem=email");
    expect(window.location.hash).toBe("");
  });

  it("fragmento de outro tipo não é link de recuperação: segue pela sessão existente", async () => {
    window.history.replaceState(
      null,
      "",
      `/nova-senha${FRAGMENTO.replace("type=recovery", "type=signup")}`,
    );
    getSession.mockResolvedValue({ data: { session: null } });

    render(<NovaSenhaPage />);

    expect(await screen.findByText(/expirou ou já foi usado/i)).toBeInTheDocument();
    expect(conferirToken).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("StrictMode (dev): o efeito duplo não derruba um link válido", async () => {
    abrirLink();

    render(
      <StrictMode>
        <NovaSenhaPage />
      </StrictMode>,
    );

    expect(await screen.findByLabelText(/E-mail da sua conta/i)).toBeInTheDocument();
    expect(window.location.hash).toBe(FRAGMENTO);
    expect(setSession).not.toHaveBeenCalled();
  });
});

describe("guarda de sessao em /nova-senha (sem link)", () => {
  it("sem sessao: NAO mostra o formulario, diz o que fazer", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    render(<NovaSenhaPage />);

    expect(await screen.findByText(/expirou ou já foi usado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nova senha/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salvar nova senha/i })).not.toBeInTheDocument();
  });

  it("com sessao: mostra o formulario, nao o aviso de link invalido", async () => {
    getSession.mockResolvedValue(SESSAO);

    render(<NovaSenhaPage />);

    expect(await screen.findByLabelText(/Nova senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar nova senha/i })).toBeInTheDocument();
    expect(screen.queryByText(/expirou ou já foi usado/i)).not.toBeInTheDocument();
    expect(setSession).not.toHaveBeenCalled();
  });

  it("sem link, e-mail que não é o da sessão: recusa, senha não é tocada", async () => {
    getSession.mockResolvedValue(SESSAO);
    const user = userEvent.setup();

    render(<NovaSenhaPage />);
    await preencher(user, { email: "outra@empresa.test" });

    expect(toast.error).toHaveBeenCalledWith(
      "Esse não é o e-mail da conta deste link. Confira o e-mail ou peça um novo link em /auth.",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("getSession rejeitado (storage bloqueado): link invalido, nao 'Carregando...' para sempre", async () => {
    getSession.mockRejectedValue(new Error("storage"));

    render(<NovaSenhaPage />);

    expect(await screen.findByText(/expirou ou já foi usado/i)).toBeInTheDocument();
  });
});

describe("defesa em profundidade: sessao expira entre o mount e o clique", () => {
  it("AuthSessionMissingError vira mensagem em portugues, nao a crua do Supabase", async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(SESSAO);
    updateUser.mockResolvedValue({
      error: {
        __isAuthError: true,
        name: "AuthSessionMissingError",
        message: "Auth session missing!",
      },
    });

    render(<NovaSenhaPage />);
    await preencher(user);

    expect(toast.error).toHaveBeenCalledWith(AVISO_LINK_INVALIDO);
    expect(toast.error).not.toHaveBeenCalledWith("Auth session missing!");
  });
});

describe("AUTH-4: falta de <form> impedia Enter de salvar", () => {
  it("🔴 Enter no campo de confirmacao dispara updateUser", async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(SESSAO);
    updateUser.mockResolvedValue({ error: null });

    render(<NovaSenhaPage />);

    await user.type(await screen.findByLabelText(/E-mail da sua conta/i), CONTA);
    await user.type(screen.getByLabelText(/Nova senha/i), "senhanova123");
    await user.type(screen.getByLabelText(/Confirmar senha/i), "senhanova123{Enter}");

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "senhanova123" }));
  });
});

describe("AUTH-5: recusa do GoTrue traduzida, nunca error.message cru", () => {
  it("422 weak_password vira a frase em portugues", async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(SESSAO);
    updateUser.mockResolvedValue({
      error: {
        __isAuthError: true,
        name: "AuthApiError",
        status: 422,
        code: "weak_password",
        message: "Password is known to be weak and easy to guess, please choose a different one.",
      },
    });

    render(<NovaSenhaPage />);
    await preencher(user, { senha: "Senha1234567" });

    expect(toast.error).toHaveBeenCalledWith(
      "Essa senha é fácil de adivinhar. Escolha outra, com mais caracteres.",
    );
  });

  it("same_password vira a frase em portugues", async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(SESSAO);
    updateUser.mockResolvedValue({
      error: {
        __isAuthError: true,
        name: "AuthApiError",
        status: 422,
        code: "same_password",
        message: "New password should be different from the old password.",
      },
    });

    render(<NovaSenhaPage />);
    await preencher(user, { senha: "senhaAntiga1" });

    expect(toast.error).toHaveBeenCalledWith("A senha nova precisa ser diferente da atual.");
  });

  it("codigo desconhecido cai no generico em portugues, nao no texto cru do GoTrue", async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue(SESSAO);
    updateUser.mockResolvedValue({
      error: {
        __isAuthError: true,
        name: "AuthApiError",
        status: 500,
        code: "unexpected_failure",
        message: "Something exploded in english",
      },
    });

    render(<NovaSenhaPage />);
    await preencher(user);

    expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar a senha. Tente de novo.");
    expect(toast.error).not.toHaveBeenCalledWith("Something exploded in english");
  });
});
