import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstagioDoPipeline, MotivoDeSaida } from "../domain/pipeline";

const mutate = vi.fn();
const estadoDaMutacao = { isPending: false };

const PIPELINE = "10000000-0000-4000-8000-000000000001";

const MOTIVOS: MotivoDeSaida[] = [
  { id: "m-preco", pipelineId: PIPELINE, tipo: "perda", rotulo: "Preço", ordem: 1, ativo: true },
  {
    id: "m-conc",
    pipelineId: PIPELINE,
    tipo: "perda",
    rotulo: "Escolheu concorrente",
    ordem: 2,
    ativo: true,
  },
  {
    id: "m-verba",
    pipelineId: PIPELINE,
    tipo: "descarte",
    rotulo: "Sem verba",
    ordem: 1,
    ativo: true,
  },
  {
    id: "m-nunca",
    pipelineId: PIPELINE,
    tipo: "descarte",
    rotulo: "Nunca respondeu",
    ordem: 2,
    ativo: true,
  },
  {
    id: "m-antigo",
    pipelineId: PIPELINE,
    tipo: "perda",
    rotulo: "Motivo antigo",
    ordem: 3,
    ativo: false,
  },
];

const motivos: { lista: MotivoDeSaida[]; falhou: boolean } = { lista: MOTIVOS, falhou: false };

vi.mock("../hooks/use-pipeline", () => ({
  useMoverEstagio: () => ({ mutate, isPending: estadoDaMutacao.isPending }),
  useMotivos: () => ({
    data: motivos.falhou ? undefined : motivos.lista,
    isPending: false,
    isError: motivos.falhou,
  }),
}));

const { DialogoDeMotivo } = await import("./dialogo-de-motivo");

type Saindo = Parameters<typeof DialogoDeMotivo>[0]["saindo"];

function estagio(tipo: EstagioDoPipeline["tipo"], ordem: number): EstagioDoPipeline {
  return { id: `estagio-${tipo}`, pipelineId: PIPELINE, nome: tipo, ordem, tipo };
}
const DESTINOS = { perdido: estagio("perdido", 7), descartado: estagio("descartado", 8) };

function saindoPara(
  tipo: "perdido" | "descartado",
  id = "opp-1",
  nome = "julio",
  estagioAtual = "r2",
): Saindo {
  return {
    oportunidade: {
      id,
      nome,
      estagio: estagioAtual,
      estagioId: `estagio-${estagioAtual}`,
      pipelineId: PIPELINE,
    } as unknown as NonNullable<NonNullable<Saindo>["oportunidade"]>,
    destino: DESTINOS[tipo],
  };
}

beforeEach(() => {
  mutate.mockReset();
  estadoDaMutacao.isPending = false;
  motivos.lista = MOTIVOS;
  motivos.falhou = false;
});

describe("os ramos de erro e de vazio do motivo", () => {
  it("🔴 lista FALHOU: sem label órfão, texto em role=status, Confirmar travado", () => {
    motivos.falhou = true;
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);

    expect(screen.queryByText("Motivo", { selector: "label" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/Não foi possível ler os motivos/);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });

  it("🔴 lista VAZIA do tipo: sem label órfão, aviso em role=status", () => {
    motivos.lista = MOTIVOS.filter((m) => m.tipo !== "perda" || !m.ativo);
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);

    expect(screen.queryByText("Motivo", { selector: "label" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/não tem motivo de perda ativo/);
  });

  it("lista em mãos: o Select tem o label 'Motivo' — o positivo dos dois acima", () => {
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);

    expect(screen.getByLabelText("Motivo")).toBe(screen.getByRole("combobox"));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("DialogoDeMotivo", () => {
  it("fechado (`saindo` nulo) não mostra nada", () => {
    render(<DialogoDeMotivo saindo={null} aoFechar={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o título e a lista de motivos seguem o estágio de destino", async () => {
    const { unmount } = render(
      <DialogoDeMotivo saindo={saindoPara("descartado")} aoFechar={vi.fn()} />,
    );

    expect(screen.getByText("Descartar oportunidade")).toBeInTheDocument();
    unmount();

    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);
    expect(screen.getByText("Marcar como perdida")).toBeInTheDocument();
  });

  it("🔴 lista só os motivos ATIVOS do tipo exigido — nem inativo, nem do outro tipo", async () => {
    const user = userEvent.setup();
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    const opcoes = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(opcoes).toEqual(["Preço", "Escolheu concorrente"]);
  });

  it("🔴 pipeline sem motivo ativo do tipo: avisa, aponta Configurações e trava Confirmar", () => {
    motivos.lista = MOTIVOS.filter((m) => m.tipo !== "perda" || !m.ativo);
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);

    expect(
      screen.getByText(/Este pipeline não tem motivo de perda ativo\. Cadastre em Configurações/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });

  it("🔴 Confirmar nasce DESABILITADO — o motivo é obrigatório", () => {
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });

  it("🔴 escolhido o motivo, Confirmar manda o tipo PERDA para `perdido`", async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={aoFechar} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({
      oportunidadeId: "opp-1",
      destino: DESTINOS.perdido,
      estagioAtualId: "estagio-r2",
      motivo: { tipo: "perda", motivoId: "m-preco", obs: null },
      pipelineId: PIPELINE,
    });
  });

  it("🔴 e o tipo DESCARTE para `descartado` — os dois não podem se trocar", async () => {
    const user = userEvent.setup();
    render(
      <DialogoDeMotivo
        saindo={saindoPara("descartado", "opp-1", "julio", "qualificacao")}
        aoFechar={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Sem verba" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(mutate.mock.calls[0][0]).toMatchObject({
      destino: DESTINOS.descartado,
      estagioAtualId: "estagio-qualificacao",
      motivo: { tipo: "descarte", motivoId: "m-verba" },
    });
  });

  it("a observação viaja quando preenchida, e vira `null` quando é só espaço", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    await user.type(screen.getByLabelText(/Observação/), "  achou caro  ");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(mutate.mock.calls[0][0].motivo.obs).toBe("achou caro");
    unmount();
    mutate.mockReset();

    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    await user.type(screen.getByLabelText(/Observação/), "   ");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(mutate.mock.calls[0][0].motivo.obs).toBeNull();
  });

  it("🔴 Cancelar NÃO move o card — só fecha", async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={aoFechar} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mutate).not.toHaveBeenCalled());
  });

  it("🔴 reabrir noutra oportunidade não herda o motivo escolhido na anterior", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DialogoDeMotivo saindo={saindoPara("perdido", "opp-1")} aoFechar={vi.fn()} />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();

    rerender(<DialogoDeMotivo saindo={saindoPara("perdido", "opp-2")} aoFechar={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  });

  it("enquanto a mutação corre, os dois botões travam", () => {
    estadoDaMutacao.isPending = true;
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Movendo…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("só fecha DEPOIS que a mutação deu certo", async () => {
    const user = userEvent.setup();
    const aoFechar = vi.fn();
    render(<DialogoDeMotivo saindo={saindoPara("perdido")} aoFechar={aoFechar} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(aoFechar).not.toHaveBeenCalled();

    const opcoes = mutate.mock.calls[0][1] as { onSuccess: () => void };
    opcoes.onSuccess();

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
