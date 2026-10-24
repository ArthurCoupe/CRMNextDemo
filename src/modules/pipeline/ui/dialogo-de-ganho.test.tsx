import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OportunidadeListada } from "../api/pipeline.repository";
import type { EstagioDoPipeline } from "../domain/pipeline";

const mutate = vi.fn();
const estadoDaMutacao = { isPending: false };

vi.mock("../hooks/use-pipeline", () => ({
  useMoverEstagio: () => ({ mutate, isPending: estadoDaMutacao.isPending }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { DialogoDeGanho } = await import("./dialogo-de-ganho");

const PIPELINE = "10000000-0000-4000-8000-000000000001";
const FECHADO: EstagioDoPipeline = {
  id: "estagio-fechado",
  pipelineId: PIPELINE,
  nome: "Fechado",
  ordem: 8,
  tipo: "fechado",
};
const OPORTUNIDADE = {
  id: "o1",
  nome: "Padaria do Zé",
  pipelineId: PIPELINE,
  estagioId: "estagio-r2",
} as unknown as OportunidadeListada;

beforeEach(() => {
  mutate.mockReset();
  estadoDaMutacao.isPending = false;
  vi.mocked(toast.error).mockReset();
});

describe("DialogoDeGanho", () => {
  it("fechado (ganhando null): nada aparece", () => {
    render(<DialogoDeGanho ganhando={null} aoFechar={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pergunta pelo ganho e diz que cliente e contrato vêm depois", () => {
    render(
      <DialogoDeGanho
        ganhando={{ oportunidade: OPORTUNIDADE, destino: FECHADO }}
        aoFechar={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: 'Marcar "Padaria do Zé" como ganha?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cliente e contrato você cadastra depois, nas abas Clientes e Contratos."),
    ).toBeInTheDocument();
  });

  it("🔴 confirmar move com o estágio que a tela viu (PIPE-1), e o sucesso fecha", async () => {
    const aoFechar = vi.fn();
    render(
      <DialogoDeGanho
        ganhando={{ oportunidade: OPORTUNIDADE, destino: FECHADO }}
        aoFechar={aoFechar}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Marcar como ganha" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [variaveis, opcoes] = mutate.mock.calls[0] as [
      Record<string, unknown>,
      { onSuccess: () => void; onError: (e: unknown) => void },
    ];
    expect(variaveis).toEqual({
      oportunidadeId: "o1",
      destino: FECHADO,
      estagioAtualId: "estagio-r2",
      pipelineId: PIPELINE,
    });
    opcoes.onSuccess();
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("erro do banco vira aviso com a frase dele, e o diálogo fica aberto", async () => {
    const aoFechar = vi.fn();
    render(
      <DialogoDeGanho
        ganhando={{ oportunidade: OPORTUNIDADE, destino: FECHADO }}
        aoFechar={aoFechar}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Marcar como ganha" }));
    const [, opcoes] = mutate.mock.calls[0] as [unknown, { onError: (e: unknown) => void }];

    opcoes.onError(
      new Error("Esta oportunidade já foi movida por outra pessoa. Recarregue o board."),
    );

    expect(toast.error).toHaveBeenCalledWith(
      "Esta oportunidade já foi movida por outra pessoa. Recarregue o board.",
    );
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("cancelar fecha sem mover", async () => {
    const aoFechar = vi.fn();
    render(
      <DialogoDeGanho
        ganhando={{ oportunidade: OPORTUNIDADE, destino: FECHADO }}
        aoFechar={aoFechar}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(aoFechar).toHaveBeenCalled();
  });

  it("em voo, os botões travam e o texto diz que está marcando", () => {
    estadoDaMutacao.isPending = true;
    render(
      <DialogoDeGanho
        ganhando={{ oportunidade: OPORTUNIDADE, destino: FECHADO }}
        aoFechar={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Marcando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
