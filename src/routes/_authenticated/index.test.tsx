import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIMITE_DO_BOARD } from "@/modules/pipeline/domain/limites";

const tarefas = {
  data: { tarefas: [] as unknown[], temMais: false },
  isPending: false,
  isError: false,
};

const pipeline = {
  data: [] as { estagio: string }[] | undefined,
  isPending: false,
  isError: false,
};

const mrr = {
  data: undefined as { celulas: { total: number }[] } | undefined,
  isPending: false,
  isError: false,
};

const perfil = { papel: "member" as "owner" | "manager" | "member", meuId: "u1" };

vi.mock("@/modules/tasks/hooks/use-tasks", () => ({
  useTarefas: () => tarefas,
}));
vi.mock("@/modules/pipeline/hooks/use-pipeline", () => ({
  useOportunidadesDeTodosOsPipelines: () => pipeline,
}));
vi.mock("@/modules/financial/hooks/use-financial", () => ({
  useMrrPorUnidade: () => mrr,
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfil }));
vi.mock("@/modules/financial/ui/placar-de-metas", () => ({
  PlacarDeMetas: () => <div data-testid="placar-de-metas" />,
}));

const { Dashboard } = await import("./index");

beforeEach(() => {
  tarefas.data = { tarefas: [{ id: "t1" }, { id: "t2" }, { id: "t3" }], temMais: false };
  tarefas.isPending = false;
  tarefas.isError = false;
  pipeline.data = [];
  pipeline.isPending = false;
  pipeline.isError = false;
  mrr.data = { celulas: [{ total: 1000 }] };
  mrr.isPending = false;
  mrr.isError = false;
  perfil.papel = "member";
});

describe("card de Tarefas no Dashboard", () => {
  it("mostra a contagem de tarefas abertas, nao a fase", () => {
    render(<Dashboard />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText(/chega na F16/)).not.toBeInTheDocument();
    expect(screen.queryByText(/atingiu o teto/)).not.toBeInTheDocument();

    const cardTarefas = screen.getByText("Tarefas").closest("div");
    expect(cardTarefas).not.toHaveTextContent(/ainda nao existe|ainda não existe/);
  });

  it("🔴 nenhum card promete fase futura — /meetings está em produção", () => {
    render(<Dashboard />);

    expect(screen.queryByText(/chega na F/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ainda não existe/)).not.toBeInTheDocument();
    expect(screen.queryByText("Reuniões")).not.toBeInTheDocument();
  });

  it("🔴 pagina cheia (temMais) imprime '100+', nao '100'", () => {
    tarefas.data = {
      tarefas: Array.from({ length: 100 }, (_, i) => ({ id: `t${i}` })),
      temMais: true,
    };

    render(<Dashboard />);

    const cardTarefas = screen.getByText("Tarefas").closest("div");
    expect(cardTarefas).toHaveTextContent("100+");
  });

  it("pagina exata de 100 sem temMais imprime '100' — o positivo ao lado", () => {
    tarefas.data = {
      tarefas: Array.from({ length: 100 }, (_, i) => ({ id: `t${i}` })),
      temMais: false,
    };

    render(<Dashboard />);

    expect(screen.getByText("Tarefas").closest("div")).not.toHaveTextContent("100+");
    expect(screen.getByText("Tarefas").closest("div")).toHaveTextContent("100");
  });

  it("erro NAO vira zero", () => {
    tarefas.data = { tarefas: [], temMais: false };
    tarefas.isError = true;

    render(<Dashboard />);

    const cardTarefas = screen.getByText("Tarefas").closest("div");
    expect(cardTarefas).toBeInTheDocument();
    expect(cardTarefas).toHaveTextContent("não foi possível ler");
  });
});

describe("pipeline no Dashboard: erro nao vira oito zeros", () => {
  it("card de Oportunidades e placar de estagios dizem que nao sabem", () => {
    pipeline.data = undefined;
    pipeline.isError = true;

    render(<Dashboard />);

    const cardOportunidades = screen.getByText("Oportunidades").closest("div");
    expect(cardOportunidades).toHaveTextContent("não foi possível ler");
    expect(cardOportunidades).toHaveTextContent("o número é desconhecido, não zero");

    expect(
      screen.getByText(/Não foi possível ler as oportunidades por estágio/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Prospecção")).not.toBeInTheDocument();
    expect(screen.queryAllByText("0")).toHaveLength(0);
  });
});

describe("teto do board no Dashboard", () => {
  it("avisa que os numeros estao truncados quando bate no LIMITE_DO_BOARD", () => {
    pipeline.data = Array.from({ length: LIMITE_DO_BOARD }, () => ({ estagio: "prospeccao" }));

    render(<Dashboard />);

    expect(
      screen.getByText(new RegExp(`teto de ${LIMITE_DO_BOARD} oportunidades`)),
    ).toBeInTheDocument();
    expect(screen.getByText("Oportunidades").closest("div")).toHaveTextContent(
      String(LIMITE_DO_BOARD),
    );
  });

  it("🔴 a faixa do teto não promete arquivamento nem fase", () => {
    pipeline.data = Array.from({ length: LIMITE_DO_BOARD }, () => ({ estagio: "prospeccao" }));

    render(<Dashboard />);

    const faixa = screen.getByText(/atingiu o teto/);
    expect(faixa).not.toHaveTextContent(/arquiv/i);
    expect(faixa).not.toHaveTextContent(/F18/);
    expect(faixa).not.toHaveTextContent(/resolve/);
  });

  it("nao avisa um card abaixo do teto", () => {
    pipeline.data = Array.from({ length: LIMITE_DO_BOARD - 1 }, () => ({ estagio: "prospeccao" }));

    render(<Dashboard />);

    expect(screen.queryByText(/atingiu o teto/)).not.toBeInTheDocument();
  });
});

describe("portao de papel no Dashboard", () => {
  it("owner ve o placar de metas e o card de MRR", () => {
    perfil.papel = "owner";

    render(<Dashboard />);

    expect(screen.getByTestId("placar-de-metas")).toBeInTheDocument();
    expect(screen.getByText("MRR ativo")).toBeInTheDocument();
    expect(screen.getByText("MRR ativo").closest("div")).toHaveTextContent("R$ 1.000,00");
  });

  it("member nao ve nenhum dos dois, e a tela continua util", () => {
    perfil.papel = "member";

    render(<Dashboard />);

    expect(screen.queryByTestId("placar-de-metas")).not.toBeInTheDocument();
    expect(screen.queryByText("MRR ativo")).not.toBeInTheDocument();
    expect(screen.getByText("Oportunidades")).toBeInTheDocument();
    expect(screen.getByText("Tarefas").closest("div")).toHaveTextContent("3");
    expect(screen.getByText("Pipeline por estágio")).toBeInTheDocument();
  });
});

describe("os dois cards de MRR dizem o que cada um conta", () => {
  it("o card de MRR ativo declara que nao filtra `is_firm`", () => {
    perfil.papel = "owner";

    render(<Dashboard />);

    const cardMrr = screen.getByText("MRR ativo").closest("div");
    expect(cardMrr).toHaveTextContent("R$ 1.000,00");
    expect(cardMrr).toHaveTextContent(/firme ou n[ãa]o/);
  });

  it("🔴 a legenda NAO chama `is_firm` de fidelidade — sao colunas diferentes", () => {
    perfil.papel = "owner";

    render(<Dashboard />);

    expect(screen.getByText("MRR ativo").closest("div")).not.toHaveTextContent(/fidelidade/i);
  });

  it("a explicacao sai de cena no erro, onde nao ha numero para explicar", () => {
    perfil.papel = "owner";
    mrr.data = undefined;
    mrr.isError = true;

    render(<Dashboard />);

    const cardMrr = screen.getByText("MRR ativo").closest("div");
    expect(cardMrr).toHaveTextContent("o valor é desconhecido, não zero");
    expect(cardMrr).not.toHaveTextContent(/com ou sem fidelidade/);
  });
});
