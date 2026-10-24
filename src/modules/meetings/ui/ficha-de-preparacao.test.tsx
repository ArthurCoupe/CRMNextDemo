import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatDateTime } from "@/shared/lib/date";

import type { Reuniao } from "../api/meetings.repository";
import { FRASES, type Secao } from "../domain/preparacao";

vi.mock("../hooks/use-meetings", () => ({ usePreparacao: vi.fn() }));

const { FichaDePreparacao } = await import("./ficha-de-preparacao");
const { usePreparacao } = await import("../hooks/use-meetings");

const refetch = vi.fn();

function consulta(over: Record<string, unknown>) {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch,
    ...over,
  } as never;
}

const REUNIAO: Reuniao = {
  id: "r1",
  titulo: "Kickoff Acme",
  tipo: "kickoff_cliente",
  startsAt: "2026-10-05T17:00:00.000Z",
  duracaoMinutos: 60,
  clienteId: "c1",
  clienteNome: "Acme",
  oportunidadeId: null,
  oportunidadeNome: null,
  organizadorId: "u1",
  local: null,
  notas: null,
  canceladaEm: null,
  motivoDoCancelamento: null,
  participantes: [],
  cancelamentosDesfeitos: [],
};

const CONTRATO_ID = "contrato:0f000000-0000-4000-8000-000000000001";
const TAREFA_ID = "tarefa:1b000000-0000-4000-8000-000000000001";

const SECOES: readonly Secao[] = [
  {
    chave: "contratos",
    titulo: "Contratos",
    linhas: [
      {
        id: CONTRATO_ID,
        texto: "Tráfego mensal · MRR R$ 3.500,00/mês",
        detalhe: "Início 01/08/2026 · Demanda",
        estado: "normal",
      },
    ],
    aviso: null,
    vazio: FRASES.semContratos,
  },
  {
    chave: "tarefas",
    titulo: "Tarefas abertas",
    linhas: [
      { id: TAREFA_ID, texto: "Relatório", detalhe: "Prazo 29/09/2026 · Ana", estado: "atencao" },
    ],
    aviso: FRASES.tarefasCortadas,
    vazio: FRASES.semTarefas,
  },
  {
    chave: "reunioes",
    titulo: "Reuniões anteriores",
    linhas: [],
    aviso: null,
    vazio: FRASES.semReunioes,
  },
];

beforeEach(() => {
  refetch.mockClear();
  vi.mocked(usePreparacao).mockReturnValue(consulta({ data: SECOES }));
});

describe("FichaDePreparacao", () => {
  it("fechada (reunião nula): não há diálogo, e o hook recebe null", () => {
    render(<FichaDePreparacao reuniao={null} aoFechar={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(usePreparacao).toHaveBeenLastCalledWith(null);
  });

  it("título, data em São Paulo e tipo da reunião", () => {
    render(<FichaDePreparacao reuniao={REUNIAO} aoFechar={() => {}} />);
    const dialogo = screen.getByRole("dialog");
    expect(
      within(dialogo).getByRole("heading", { name: "Preparação: Kickoff Acme" }),
    ).toBeInTheDocument();
    expect(dialogo).toHaveTextContent(`${formatDateTime(REUNIAO.startsAt)} · Kickoff com cliente`);
  });

  it("cada linha é um li com o id da linha (critério 4)", () => {
    render(<FichaDePreparacao reuniao={REUNIAO} aoFechar={() => {}} />);
    const contrato = document.getElementById(CONTRATO_ID);
    expect(contrato?.tagName).toBe("LI");
    expect(contrato).toHaveTextContent("Tráfego mensal · MRR R$ 3.500,00/mês");
    expect(contrato).toHaveTextContent("Início 01/08/2026 · Demanda");
  });

  it("uma seção por bloco, com título, aviso e frase de vazio", () => {
    render(<FichaDePreparacao reuniao={REUNIAO} aoFechar={() => {}} />);
    for (const titulo of ["Contratos", "Tarefas abertas", "Reuniões anteriores"]) {
      expect(screen.getByRole("heading", { level: 3, name: titulo })).toBeInTheDocument();
    }
    expect(screen.getByText(FRASES.tarefasCortadas)).toBeInTheDocument();
    expect(screen.getByText(FRASES.semReunioes)).toBeInTheDocument();
    expect(screen.queryByText(FRASES.semContratos)).toBeNull();
  });

  it("linha em atenção leva a cor de alerta e o texto 'Atenção:' para leitor de tela", () => {
    render(<FichaDePreparacao reuniao={REUNIAO} aoFechar={() => {}} />);
    const tarefa = document.getElementById(TAREFA_ID);
    expect(tarefa?.className).toContain("text-warning");
    expect(tarefa).toHaveTextContent("Atenção:");
    const contrato = document.getElementById(CONTRATO_ID);
    expect(contrato?.className).not.toContain("text-warning");
    expect(contrato).not.toHaveTextContent("Atenção:");
  });

  it("carregando: esqueleto, sem seções", () => {
    vi.mocked(usePreparacao).mockReturnValue(consulta({ isPending: true }));
    render(<FichaDePreparacao reuniao={REUNIAO} aoFechar={() => {}} />);
    expect(screen.getByLabelText("Carregando a ficha")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("erro: FalhaAoLer e 'Tentar de novo' lê de novo (critério 14)", () => {
    vi.mocked(usePreparacao).mockReturnValue(consulta({ isError: true }));
    render(<FichaDePreparacao reuniao={REUNIAO} aoFechar={() => {}} />);
    expect(screen.getByText("Não foi possível ler a ficha de preparação.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
