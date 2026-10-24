import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const definirSituacao = vi.fn();
const definirPapel = vi.fn();
const atualizarPerfil = vi.fn();
function dadosDoTime(p2: { nome?: string; cargo?: string | null } = {}) {
  return {
    pessoas: [
      {
        id: "p1",
        nome: "Augusto Costa",
        email: "a@x.com",
        iniciais: "AC",
        papel: "owner",
        ativo: true,
        cargo: "Sócio",
      },
      {
        id: "p2",
        nome: "Pessoa Nova",
        email: "n@x.com",
        iniciais: "PN",
        papel: "member",
        ativo: false,
        cargo: null,
        ...p2,
      },
    ],
    truncada: false,
  } as unknown;
}
const time = { data: dadosDoTime(), isPending: false, isError: false };
const gravando = { isPending: false };
const perfil = { papel: "owner" as string, meuId: "p1" };

vi.mock("../hooks/use-settings", () => ({
  useTime: () => time,
  useDefinirSituacaoDaPessoa: () => ({ mutate: definirSituacao, isPending: false }),
  useDefinirPapelDaPessoa: () => ({ mutate: definirPapel, isPending: false }),
  useAtualizarPerfil: () => ({ mutate: atualizarPerfil, isPending: gravando.isPending }),
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfil }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { TimeSettings } = await import("./time-settings");
const { toast } = await import("sonner");

beforeEach(() => {
  vi.clearAllMocks();
  atualizarPerfil.mockReset();
  perfil.papel = "owner";
  perfil.meuId = "p1";
  time.data = dadosDoTime();
  time.isError = false;
  gravando.isPending = false;
});

describe("card de Equipe", () => {
  it("owner ativa uma pessoa pendente", async () => {
    const user = userEvent.setup();
    render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: /Ativar Pessoa Nova/i }));

    expect(definirSituacao).toHaveBeenCalledWith({ id: "p2", ativo: true });
  });

  it("owner troca o papel de uma pessoa pelo Select", async () => {
    const user = userEvent.setup();
    render(<TimeSettings />);

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(1);
    await user.click(comboboxes[0]);
    await user.click(await screen.findByRole("option", { name: "manager" }));

    expect(definirPapel).toHaveBeenCalledWith({ id: "p2", papel: "manager" });
  });

  it("🔴 o owner NAO pode rebaixar a si mesmo", () => {
    render(<TimeSettings />);

    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("🔴 o owner NAO pode desativar a si mesmo", () => {
    render(<TimeSettings />);

    expect(screen.queryByRole("button", { name: /Desativar Augusto Costa/i })).toBeNull();
  });

  it("🔴 quem NAO e owner nao ve os controles de owner", () => {
    perfil.papel = "member";

    render(<TimeSettings />);

    expect(screen.getByText("Pessoa Nova")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar/i })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("🔴 em ERRO nao afirma que o time esta vazio", () => {
    time.isError = true;

    render(<TimeSettings />);

    expect(screen.getByText(/nao foi possivel ler|não foi possível ler/i)).toBeInTheDocument();
    expect(screen.queryByText("Pessoa Nova")).toBeNull();
  });
});

describe("nome e cargo (A2.1)", () => {
  it("o cargo gravado aparece na linha", () => {
    render(<TimeSettings />);

    expect(screen.getByText("Sócio")).toBeInTheDocument();
  });

  it("owner edita nome e cargo de OUTRA pessoa, e os dois vão juntos numa gravação", async () => {
    const user = userEvent.setup();
    render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    const nome = screen.getByLabelText("Nome");
    await user.clear(nome);
    await user.type(nome, "  Pessoa Renomeada  ");
    await user.type(screen.getByLabelText("Cargo"), "Designer");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(atualizarPerfil).toHaveBeenCalledTimes(1);
    expect(atualizarPerfil).toHaveBeenCalledWith(
      { id: "p2", dados: { nomeCompleto: "Pessoa Renomeada", cargo: "Designer" } },
      expect.anything(),
    );
  });

  it("🔴 cargo apagado na linha de OUTRA pessoa grava null, nunca texto vazio", async () => {
    time.data = dadosDoTime({ cargo: "Designer" });
    const user = userEvent.setup();
    render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    const cargo = screen.getByLabelText("Cargo");
    expect(cargo).toHaveValue("Designer");
    await user.clear(cargo);
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(atualizarPerfil).toHaveBeenCalledWith(
      { id: "p2", dados: { nomeCompleto: "Pessoa Nova", cargo: null } },
      expect.anything(),
    );
  });

  it("nome e cargo aceitam no máximo 120 caracteres", async () => {
    const user = userEvent.setup();
    render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));

    expect(screen.getByLabelText("Nome")).toHaveAttribute("maxlength", "120");
    expect(screen.getByLabelText("Cargo")).toHaveAttribute("maxlength", "120");
  });

  it("🔴 campo não tocado acompanha o time relido, e o Salvar não regrava o valor velho", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    time.data = dadosDoTime({ cargo: "Gerente" });
    rerender(<TimeSettings />);

    expect(screen.getByLabelText("Cargo")).toHaveValue("Gerente");
    const nome = screen.getByLabelText("Nome");
    await user.clear(nome);
    await user.type(nome, "Pessoa Renomeada");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(atualizarPerfil).toHaveBeenCalledWith(
      { id: "p2", dados: { nomeCompleto: "Pessoa Renomeada", cargo: "Gerente" } },
      expect.anything(),
    );
  });

  it("campo tocado fica como a pessoa digitou quando o time é relido; o outro acompanha", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    await user.type(screen.getByLabelText("Cargo"), "Designer");
    time.data = dadosDoTime({ nome: "Pessoa Atualizada", cargo: "Gerente" });
    rerender(<TimeSettings />);

    expect(screen.getByLabelText("Cargo")).toHaveValue("Designer");
    expect(screen.getByLabelText("Nome")).toHaveValue("Pessoa Atualizada");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(atualizarPerfil).toHaveBeenCalledWith(
      { id: "p2", dados: { nomeCompleto: "Pessoa Atualizada", cargo: "Designer" } },
      expect.anything(),
    );
  });

  it("com uma linha aberta, o Editar das outras fica desabilitado (controle: habilitado antes)", async () => {
    const user = userEvent.setup();
    render(<TimeSettings />);
    expect(screen.getByRole("button", { name: "Editar Augusto Costa" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Editar Pessoa Nova" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));

    expect(screen.getByRole("button", { name: "Editar Augusto Costa" })).toBeDisabled();
  });

  it("🔴 a pessoa da linha aberta sumir do time não deixa os Editar travados", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TimeSettings />);
    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));

    time.data = {
      pessoas: (time.data as { pessoas: unknown[] }).pessoas.slice(0, 1),
      truncada: false,
    };
    rerender(<TimeSettings />);

    expect(screen.getByRole("button", { name: "Editar Augusto Costa" })).toBeEnabled();
  });

  it("gravando, Nome, Cargo, Salvar e Cancelar ficam desabilitados (controle: habilitados antes e depois)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TimeSettings />);
    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    expect(screen.getByLabelText("Nome")).toBeEnabled();
    expect(screen.getByLabelText("Cargo")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();

    gravando.isPending = true;
    rerender(<TimeSettings />);

    expect(screen.getByLabelText("Nome")).toBeDisabled();
    expect(screen.getByLabelText("Cargo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    gravando.isPending = false;
    rerender(<TimeSettings />);

    expect(screen.getByLabelText("Nome")).toBeEnabled();
    expect(screen.getByLabelText("Cargo")).toBeEnabled();
  });

  it("🔴 nome só com espaços não chega ao banco, e a tela diz por quê", async () => {
    const user = userEvent.setup();
    render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    const nome = screen.getByLabelText("Nome");
    await user.clear(nome);
    await user.type(nome, "   ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(atualizarPerfil).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("O nome não pode ficar em branco.");
  });

  it("gravou: a linha sai do modo de edição", async () => {
    atualizarPerfil.mockImplementation((_vars: unknown, opcoes?: { onSuccess?: () => void }) =>
      opcoes?.onSuccess?.(),
    );
    const user = userEvent.setup();
    render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.queryByLabelText("Nome")).toBeNull();
  });

  it("🔴 gravação recusada mantém a edição aberta, com o que foi digitado", async () => {
    atualizarPerfil.mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    await user.type(screen.getByLabelText("Cargo"), "Designer");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByLabelText("Cargo")).toHaveValue("Designer");
  });

  it("Cancelar descarta sem gravar", async () => {
    const user = userEvent.setup();
    render(<TimeSettings />);

    await user.click(screen.getByRole("button", { name: "Editar Pessoa Nova" }));
    await user.type(screen.getByLabelText("Cargo"), "Designer");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(atualizarPerfil).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Cargo")).toBeNull();
  });

  it("owner vê Editar em todas as linhas", () => {
    render(<TimeSettings />);

    expect(screen.getAllByRole("button", { name: /^Editar / })).toHaveLength(2);
  });

  it("🔴 quem não é owner edita só a própria linha: o negativo ao lado", () => {
    perfil.papel = "member";
    perfil.meuId = "p2";

    render(<TimeSettings />);

    const editar = screen.getAllByRole("button", { name: /^Editar / });
    expect(editar).toHaveLength(1);
    expect(editar[0]).toHaveAccessibleName("Editar Pessoa Nova");
  });
});
