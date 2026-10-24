import type { DragEndEvent } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tarefa } from "../domain/task";

const captura = vi.hoisted(() => ({
  onDragEnd: undefined as ((evento: DragEndEvent) => void) | undefined,
}));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const real = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...real,
    DndContext: (props: ComponentProps<typeof real.DndContext>) => {
      captura.onDragEnd = props.onDragEnd;
      return <real.DndContext {...props} />;
    },
  };
});

beforeEach(() => {
  captura.onDragEnd = undefined;
});

vi.mock("./cartao-de-tarefa", () => ({
  CartaoDeTarefa: ({
    tarefa,
    onAbrir,
  }: {
    readonly tarefa: { readonly titulo: string };
    readonly onAbrir: () => void;
  }) => (
    <button type="button" onClick={onAbrir}>
      {tarefa.titulo}
    </button>
  ),
}));

const { QuadroDeTarefas } = await import("./quadro-de-tarefas");

function renderizar(props: {
  concluidasNaLista: boolean;
  somenteVencidas: boolean;
  incluirConcluidas: boolean;
}) {
  render(
    <QuadroDeTarefas
      tarefas={[]}
      estado="pronto"
      onMover={vi.fn()}
      onAbrir={vi.fn()}
      movendo={undefined}
      {...props}
    />,
  );
}

describe("coluna Concluída — a instrução aponta o botão certo (TASK-5)", () => {
  it("🔴 'Só vencidas' E 'Mostrar concluídas' ligados: manda DESLIGAR 'Só vencidas'", () => {
    renderizar({ concluidasNaLista: false, somenteVencidas: true, incluirConcluidas: true });

    expect(
      screen.getByText("concluída nunca está vencida: desligue “Só vencidas” para vê-las"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ligue “Mostrar concluídas”/)).not.toBeInTheDocument();
  });

  it("🔴 'Só vencidas' ligado e 'Mostrar concluídas' desligado: os DOIS passos", () => {
    renderizar({ concluidasNaLista: false, somenteVencidas: true, incluirConcluidas: false });

    expect(
      screen.getByText(
        "concluída nunca está vencida: desligue “Só vencidas” e ligue “Mostrar concluídas” para vê-las",
      ),
    ).toBeInTheDocument();
  });

  it("sem 'Só vencidas', a instrução continua sendo 'Mostrar concluídas' — o positivo ao lado", () => {
    renderizar({ concluidasNaLista: false, somenteVencidas: false, incluirConcluidas: false });

    expect(screen.getByText(/use “Mostrar concluídas”/)).toBeInTheDocument();
    expect(screen.queryByText(/desligue “Só vencidas”/)).not.toBeInTheDocument();
  });

  it("com as concluídas na consulta, a coluna vazia diz só 'nada aqui'", () => {
    renderizar({ concluidasNaLista: true, somenteVencidas: false, incluirConcluidas: true });

    expect(screen.getAllByText("nada aqui")).toHaveLength(4);
    expect(screen.queryByText(/Mostrar concluídas|Só vencidas/)).not.toBeInTheDocument();
  });
});

const TAREFA: Tarefa = {
  id: "tarefa-1",
  titulo: "Revisar contrato",
  descricao: null,
  categoria: "Comercial",
  tipo: "Follow-up",
  responsavelId: "user-1",
  responsavel: "Fulano",
  clienteId: null,
  cliente: null,
  coluna: "todo",
  prioridade: "media",
  prazo: "2026-09-10",
  recorrencia: "nenhuma",
  raizRecorrente: null,
  criadoPor: "user-9",
  participantes: [],
  links: [],
  pastaDoDriveDoCliente: null,
};

describe("quadro com arrasto (D-066)", () => {
  it("as quatro colunas são regiões com o nome da coluna (o alvo do arrasto)", () => {
    renderizar({ concluidasNaLista: true, somenteVencidas: false, incluirConcluidas: true });

    for (const nome of ["A fazer", "Em andamento", "Em revisão", "Concluída"]) {
      expect(screen.getByRole("region", { name: nome })).toBeInTheDocument();
    }
  });

  it("clicar no cartão abre a tarefa pelo id", async () => {
    const user = userEvent.setup();
    const onAbrir = vi.fn();
    render(
      <QuadroDeTarefas
        tarefas={[TAREFA]}
        estado="pronto"
        onMover={vi.fn()}
        onAbrir={onAbrir}
        movendo={undefined}
        concluidasNaLista={false}
        somenteVencidas={false}
        incluirConcluidas={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Revisar contrato" }));

    expect(onAbrir).toHaveBeenCalledWith("tarefa-1");
  });
});

describe("quadro — soltar o cartão (D-066)", () => {
  function renderizarComTarefa(onMover: (id: string, coluna: string) => void) {
    render(
      <QuadroDeTarefas
        tarefas={[TAREFA]}
        estado="pronto"
        onMover={onMover}
        onAbrir={vi.fn()}
        movendo={undefined}
        concluidasNaLista={false}
        somenteVencidas={false}
        incluirConcluidas={false}
      />,
    );
  }

  function soltar(ativoId: string, sobreId: string | null) {
    if (captura.onDragEnd === undefined) throw new Error("o quadro não ligou o onDragEnd");
    captura.onDragEnd({
      active: { id: ativoId },
      over: sobreId === null ? null : { id: sobreId },
    } as DragEndEvent);
  }

  it("🔴 soltar sobre outra coluna move a tarefa para ela", () => {
    const onMover = vi.fn();
    renderizarComTarefa(onMover);

    soltar("tarefa-1", "doing");

    expect(onMover).toHaveBeenCalledTimes(1);
    expect(onMover).toHaveBeenCalledWith("tarefa-1", "doing");
  });

  it("soltar na própria coluna não move", () => {
    const onMover = vi.fn();
    renderizarComTarefa(onMover);

    soltar("tarefa-1", "todo");

    expect(onMover).not.toHaveBeenCalled();
  });

  it("soltar fora das colunas não move", () => {
    const onMover = vi.fn();
    renderizarComTarefa(onMover);

    soltar("tarefa-1", null);

    expect(onMover).not.toHaveBeenCalled();
  });
});
