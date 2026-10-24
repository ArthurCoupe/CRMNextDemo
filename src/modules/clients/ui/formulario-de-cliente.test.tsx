import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GanhaSemContrato } from "../domain/vinculo";

const mutate = vi.fn();
const responsaveis = {
  data: [{ id: "p1", nome: "Augusto Costa" }],
  isPending: false,
  isError: false,
};

const ACME: GanhaSemContrato = {
  id: "opp-1",
  nome: "Acme",
  contatoNome: "Ana",
  contatoEmail: "ana@acme.com",
  contatoTelefone: "61999990000",
  segmento: "Saúde",
  nicho: "Clínica",
  ganhaEm: "2026-10-06T15:00:00Z",
};
const ganhas = { data: [ACME] as GanhaSemContrato[] | undefined, isError: false };

vi.mock("../hooks/use-clients", () => ({
  useCriarCliente: () => ({ mutate, isPending: false }),
  useResponsaveisPossiveis: () => responsaveis,
  useGanhasSemContrato: () => ganhas,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { FormularioDeCliente } = await import("./formulario-de-cliente");

beforeEach(() => {
  mutate.mockReset();
  vi.mocked(toast.error).mockReset();
  responsaveis.isError = false;
  ganhas.data = [ACME];
  ganhas.isError = false;
});

describe("FormularioDeCliente", () => {
  it("🔴 nome vazio NAO salva — nome e a unica coluna obrigatoria do banco", async () => {
    const user = userEvent.setup();
    render(<FormularioDeCliente aberto aoFechar={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mutate).not.toHaveBeenCalled());
  });

  it("salva com o nome, e manda null no que ficou em branco", async () => {
    const user = userEvent.setup();
    render(<FormularioDeCliente aberto aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Nome/), "Estruturas NORTE");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mutate.mock.calls[0][0]).toMatchObject({
      nome: "Estruturas NORTE",
      segmento: null,
      contatoEmail: null,
    });
  });

  it("🔴 reabrir nao herda o que foi digitado antes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FormularioDeCliente aberto aoFechar={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Nome/), "RASCUNHO ABANDONADO");
    rerender(<FormularioDeCliente aberto={false} aoFechar={vi.fn()} />);
    rerender(<FormularioDeCliente aberto aoFechar={vi.fn()} />);

    expect(screen.getByLabelText(/^Nome/)).toHaveValue("");
  });

  it("🔴 lista de responsaveis em erro: o campo diz que falhou e o salvar NAO trava", async () => {
    responsaveis.isError = true;
    const user = userEvent.setup();
    render(<FormularioDeCliente aberto aoFechar={vi.fn()} />);

    expect(screen.getByText(/nao foi possivel ler|não foi possível ler/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Nome/), "Estruturas NORTE");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mutate).toHaveBeenCalled();
  });
});

describe("FormularioDeCliente, preencher com os dados de uma ganha (D-071)", () => {
  it("sem escolher, não manda vínculo e entrega null como ganha a quem abriu", async () => {
    const user = userEvent.setup();
    const aoCriar = vi.fn();
    render(<FormularioDeCliente aberto aoFechar={vi.fn()} aoCriar={aoCriar} />);

    await user.type(screen.getByLabelText(/^Nome/), "Estruturas NORTE");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mutate.mock.calls[0][0]).not.toHaveProperty("oportunidadeId");
    const opcoes = mutate.mock.calls[0][1] as { onSuccess: (id: string) => void };
    opcoes.onSuccess("novo");
    expect(aoCriar).toHaveBeenCalledWith("novo", null);
  });

  it("escolher a ganha só preenche; salvo, entrega o cliente e a ganha e fecha", async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    const aoCriar = vi.fn();
    render(<FormularioDeCliente aberto aoFechar={aoFechar} aoCriar={aoCriar} />);

    await user.click(screen.getByLabelText(/Preencher com os dados de uma ganha/));
    await user.click(await screen.findByRole("option", { name: "Acme, ganha em 06/10/2026" }));

    expect(screen.getByLabelText(/^Nome/)).toHaveValue("Acme");
    expect(screen.getByLabelText(/Segmento/)).toHaveValue("Saúde");
    expect(screen.getByLabelText(/Contato · e-mail/)).toHaveValue("ana@acme.com");

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mutate.mock.calls[0][0]).toMatchObject({
      nome: "Acme",
      nicho: "Clínica",
      contatoNome: "Ana",
      contatoTelefone: "61999990000",
    });
    expect(mutate.mock.calls[0][0]).not.toHaveProperty("oportunidadeId");

    const opcoes = mutate.mock.calls[0][1] as { onSuccess: (id: string) => void };
    opcoes.onSuccess("novo");
    expect(aoCriar).toHaveBeenCalledWith("novo", "opp-1");
    expect(aoFechar).toHaveBeenCalled();
  });

  it("ganhaInicial já vem escolhida e preenchida, mesmo fora da lista lida", async () => {
    ganhas.data = [];
    const user = userEvent.setup();
    const aoCriar = vi.fn();
    render(<FormularioDeCliente aberto aoFechar={vi.fn()} ganhaInicial={ACME} aoCriar={aoCriar} />);

    expect(screen.getByLabelText(/^Nome/)).toHaveValue("Acme");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    const opcoes = mutate.mock.calls[0][1] as { onSuccess: (id: string) => void };
    opcoes.onSuccess("novo");
    expect(aoCriar).toHaveBeenCalledWith("novo", "opp-1");
  });

  it("erro comum avisa e NÃO fecha: o rascunho fica para tentar de novo", async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    render(<FormularioDeCliente aberto aoFechar={aoFechar} />);
    await user.type(screen.getByLabelText(/^Nome/), "Acme");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const opcoes = mutate.mock.calls[0][1] as { onError: (e: unknown) => void };
    opcoes.onError(new Error("falhou"));

    expect(toast.error).toHaveBeenCalledWith("falhou");
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("lista de ganhas em erro: o campo diz que falhou e o salvar NÃO trava", async () => {
    ganhas.data = undefined;
    ganhas.isError = true;
    const user = userEvent.setup();
    render(<FormularioDeCliente aberto aoFechar={vi.fn()} />);

    expect(screen.getByText(/as ganhas esperando contrato/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Nome/), "Acme");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mutate).toHaveBeenCalled();
  });
});
