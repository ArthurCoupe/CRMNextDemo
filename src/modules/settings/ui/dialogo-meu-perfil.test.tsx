import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Opcoes = { onSuccess?: () => void } | undefined;
const daCerto = (_v: unknown, opcoes: Opcoes) => opcoes?.onSuccess?.();

const mutate = vi.fn();
const retornoDoPerfil: {
  meuId: string | null;
  perfil: { full_name: string; job_title: string | null } | null;
} = { meuId: "u1", perfil: { full_name: "Marina Silva", job_title: "SDR" } };

const mutacao = { isPending: false, emGravacao: false };

vi.mock("../hooks/use-settings", () => ({
  useAtualizarPerfil: () => ({ mutate, isPending: mutacao.isPending }),
  usePerfilEmGravacao: () => mutacao.emGravacao,
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => retornoDoPerfil }));

const { DialogoMeuPerfil } = await import("./dialogo-meu-perfil");

const onFechar = vi.fn();

beforeEach(() => {
  mutate.mockReset();
  onFechar.mockReset();
  mutacao.isPending = false;
  mutacao.emGravacao = false;
  retornoDoPerfil.meuId = "u1";
  retornoDoPerfil.perfil = { full_name: "Marina Silva", job_title: "SDR" };
});

function abrir() {
  return render(<DialogoMeuPerfil onFechar={onFechar} />);
}

const salvar = () => screen.getByRole("button", { name: "Salvar" });

describe("Meu perfil (A1.5)", () => {
  it("abre com o nome e o cargo de quem está logado", () => {
    abrir();

    expect(screen.getByLabelText("Nome")).toHaveValue("Marina Silva");
    expect(screen.getByLabelText("Cargo")).toHaveValue("SDR");
  });

  it("salvar manda nome e cargo pela própria linha e fecha", () => {
    mutate.mockImplementation(daCerto);
    abrir();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Marina Souza" } });
    fireEvent.click(salvar());

    expect(mutate).toHaveBeenCalledWith(
      { id: "u1", dados: { nomeCompleto: "Marina Souza", cargo: "SDR" } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("cargo apagado vai como null, nunca texto vazio", () => {
    abrir();

    fireEvent.change(screen.getByLabelText("Cargo"), { target: { value: "   " } });
    fireEvent.click(salvar());

    expect(mutate).toHaveBeenCalledWith(
      { id: "u1", dados: { nomeCompleto: "Marina Silva", cargo: null } },
      expect.anything(),
    );
  });

  it("nome em branco trava o Salvar e diz por quê", () => {
    abrir();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "   " } });

    expect(screen.getByRole("alert")).toHaveTextContent("O nome não pode ficar em branco.");
    expect(salvar()).toBeDisabled();
    fireEvent.click(salvar());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("recusa do banco (o hook avisa): o diálogo fica aberto", () => {
    mutate.mockImplementation(() => undefined);
    abrir();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Marina Souza" } });
    fireEvent.click(salvar());

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Meu perfil" })).toBeInTheDocument();
  });

  it("sem perfil lido, Salvar fica travado mesmo com nome digitado", () => {
    retornoDoPerfil.perfil = null;
    abrir();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Marina Souza" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(salvar()).toBeDisabled();
    fireEvent.click(salvar());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("durante a gravação Esc e X não fecham (controle: parado, o Esc fecha)", () => {
    mutacao.isPending = true;
    const { unmount } = abrir();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Meu perfil" })).toBeInTheDocument();
    unmount();

    mutacao.isPending = false;
    abrir();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("sem meuId, Salvar fica travado e não grava (controle: com meuId grava)", () => {
    retornoDoPerfil.meuId = null;
    abrir();

    expect(salvar()).toBeDisabled();
    fireEvent.click(salvar());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("o id gravado é o meuId do useProfile", () => {
    retornoDoPerfil.meuId = "u-do-outro-login";
    abrir();

    fireEvent.click(salvar());

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u-do-outro-login" }),
      expect.anything(),
    );
  });

  it("nome e cargo têm limite de 120 caracteres", () => {
    abrir();

    expect(screen.getByLabelText("Nome")).toHaveAttribute("maxlength", "120");
    expect(screen.getByLabelText("Cargo")).toHaveAttribute("maxlength", "120");
  });
});

describe("Meu perfil com gravação de perfil em outro lugar (A1.5)", () => {
  const perfilRelido = { full_name: "Marina Souza", job_title: "Líder" };

  it("gravação de perfil em outro lugar trava o Salvar (controle: sem ela, habilita)", () => {
    mutacao.emGravacao = true;
    const { unmount } = abrir();

    expect(salvar()).toBeDisabled();
    fireEvent.click(salvar());
    expect(mutate).not.toHaveBeenCalled();
    unmount();

    mutacao.emGravacao = false;
    abrir();

    expect(salvar()).toBeEnabled();
  });

  it("campo não tocado acompanha o perfil relido, e o Salvar grava o valor novo", () => {
    const { rerender } = abrir();

    retornoDoPerfil.perfil = perfilRelido;
    rerender(<DialogoMeuPerfil onFechar={onFechar} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Marina Souza");
    expect(screen.getByLabelText("Cargo")).toHaveValue("Líder");
    fireEvent.click(salvar());
    expect(mutate).toHaveBeenCalledWith(
      { id: "u1", dados: { nomeCompleto: "Marina Souza", cargo: "Líder" } },
      expect.anything(),
    );
  });

  it("campo tocado fica como a pessoa digitou; o outro, não tocado, acompanha", () => {
    const { rerender } = abrir();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Marina Digitada" } });
    retornoDoPerfil.perfil = perfilRelido;
    rerender(<DialogoMeuPerfil onFechar={onFechar} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Marina Digitada");
    expect(screen.getByLabelText("Cargo")).toHaveValue("Líder");
    fireEvent.click(salvar());
    expect(mutate).toHaveBeenCalledWith(
      { id: "u1", dados: { nomeCompleto: "Marina Digitada", cargo: "Líder" } },
      expect.anything(),
    );
  });

  it("cargo tocado fica como a pessoa digitou; o nome, não tocado, acompanha", () => {
    const { rerender } = abrir();

    fireEvent.change(screen.getByLabelText("Cargo"), { target: { value: "Closer" } });
    retornoDoPerfil.perfil = perfilRelido;
    rerender(<DialogoMeuPerfil onFechar={onFechar} />);

    expect(screen.getByLabelText("Cargo")).toHaveValue("Closer");
    expect(screen.getByLabelText("Nome")).toHaveValue("Marina Souza");
  });

  it("abre durante a gravação da Equipe: o nome novo chega e o Salvar não o desfaz", () => {
    mutacao.emGravacao = true;
    const { rerender } = abrir();
    fireEvent.change(screen.getByLabelText("Cargo"), { target: { value: "Closer" } });
    expect(salvar()).toBeDisabled();

    mutacao.emGravacao = false;
    retornoDoPerfil.perfil = { full_name: "Marina Souza", job_title: "SDR" };
    rerender(<DialogoMeuPerfil onFechar={onFechar} />);

    expect(screen.getByLabelText("Nome")).toHaveValue("Marina Souza");
    fireEvent.click(salvar());
    expect(mutate).toHaveBeenCalledWith(
      { id: "u1", dados: { nomeCompleto: "Marina Souza", cargo: "Closer" } },
      expect.anything(),
    );
  });
});
