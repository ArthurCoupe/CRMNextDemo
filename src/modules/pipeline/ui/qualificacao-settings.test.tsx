import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PerguntaDoCatalogo } from "../domain/qualification";

const LIDO = {
  catalogo: {
    version: 1,
    questions: [
      {
        key: "investimento",
        label: "Q1 · Orçamento",
        prompt: "Você já investiu?",
        options: [
          { label: "Não investe", points: 0, ko: true },
          { label: "Até R$ 2.000/mês", points: 1, ko: false },
        ],
      },
      {
        key: "decisor",
        label: "Q2 · Decisão",
        prompt: "Você decide sozinho?",
        options: [{ label: "Aprova sozinho", points: 2, ko: false }],
      },
    ],
  },
  bruto: { version: 1, tiers: { A: 6, B: 4 }, questions: [] },
  atualizadoEm: "2026-10-07T12:00:00.000Z",
};

const mutate = vi.fn();
let consulta: { data: unknown; isError: boolean; isPending: boolean } = {
  data: LIDO,
  isError: false,
  isPending: false,
};

let salvando = false;

vi.mock("../hooks/use-qualificacao", () => ({
  useCatalogoParaEdicao: () => consulta,
  useSalvarCatalogoDeQualificacao: () => ({ mutate, isPending: salvando }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { QualificacaoSettings } = await import("./qualificacao-settings");
const { toast } = await import("sonner");

beforeEach(() => {
  vi.clearAllMocks();
  consulta = { data: LIDO, isError: false, isPending: false };
  salvando = false;
});

function enviadas(): readonly PerguntaDoCatalogo[] {
  return (mutate.mock.calls[0][0] as { perguntas: readonly PerguntaDoCatalogo[] }).perguntas;
}

describe("perguntas de qualificação", () => {
  it("mostra as perguntas e não deixa salvar sem mudança", () => {
    render(<QualificacaoSettings />);

    expect(screen.getByLabelText("Título da pergunta 1")).toHaveValue("Q1 · Orçamento");
    expect(screen.getByLabelText("Texto da pergunta 2")).toHaveValue("Você decide sozinho?");
    expect(screen.getByRole("button", { name: "Salvar perguntas" })).toBeDisabled();
  });

  it("renomear manda a mesma chave e as mesmas opções", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    const titulo = screen.getByLabelText("Título da pergunta 1");
    await user.clear(titulo);
    await user.type(titulo, "Q1 · Quanto investe");
    await user.click(screen.getByRole("button", { name: "Salvar perguntas" }));

    expect(mutate).toHaveBeenCalledWith({ lido: LIDO, perguntas: expect.any(Array) });
    expect(enviadas()[0]).toEqual({
      key: "investimento",
      label: "Q1 · Quanto investe",
      prompt: "Você já investiu?",
      options: [
        { label: "Não investe", points: 0, ko: true },
        { label: "Até R$ 2.000/mês", points: 1, ko: false },
      ],
    });
  });

  it("subir a segunda pergunta troca a ordem", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    await user.click(screen.getByRole("button", { name: "Subir pergunta 2" }));
    await user.click(screen.getByRole("button", { name: "Salvar perguntas" }));

    expect(enviadas().map((p) => p.key)).toEqual(["decisor", "investimento"]);
  });

  it("remover avisa o que acontece com as respostas, e a pergunta não vai", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    expect(screen.queryByText(/continuam contando no tier/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remover pergunta 1" }));

    const aviso = screen.getByText(/continuam contando no tier/);
    expect(aviso).toHaveTextContent("Q1 · Orçamento");
    expect(aviso).toHaveTextContent("somem da ficha da oportunidade");
    expect(aviso).toHaveTextContent("Pergunta removida");
    expect(aviso).toHaveTextContent("preparação da reunião");
    await user.click(screen.getByRole("button", { name: "Salvar perguntas" }));
    expect(enviadas().map((p) => p.key)).toEqual(["decisor"]);
  });

  it("Descartar alterações volta ao que está gravado", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    await user.click(screen.getByRole("button", { name: "Remover pergunta 1" }));
    await user.click(screen.getByRole("button", { name: "Descartar alterações" }));

    expect(screen.getByLabelText("Título da pergunta 1")).toHaveValue("Q1 · Orçamento");
    expect(screen.queryByText(/continuam contando no tier/)).toBeNull();
  });

  it("🔴 pergunta já salva não oferece editar opção: a resposta guarda a posição", () => {
    render(<QualificacaoSettings />);

    expect(screen.queryByLabelText("Opção 1 da pergunta 1")).toBeNull();
    expect(screen.getByText(/Até R\$ 2\.000\/mês/)).toBeInTheDocument();
  });

  it("pergunta nova define as opções, e a chave é nova", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    await user.type(screen.getByLabelText("Título da pergunta 3"), "Q5 · Urgência");
    await user.type(screen.getByLabelText("Texto da pergunta 3"), "Para quando precisa?");
    await user.type(screen.getByLabelText("Opção 1 da pergunta 3"), "Este mês");
    await user.type(screen.getByLabelText("Pontos da opção 1 da pergunta 3"), "2");
    await user.type(screen.getByLabelText("Opção 2 da pergunta 3"), "Nunca");
    await user.type(screen.getByLabelText("Pontos da opção 2 da pergunta 3"), "0");
    await user.click(screen.getByRole("checkbox", { name: "KO da opção 2 da pergunta 3" }));
    await user.click(screen.getByRole("button", { name: "Salvar perguntas" }));

    expect(enviadas().slice(0, 2)).toEqual(LIDO.catalogo.questions);
    const nova = enviadas()[2];
    expect(nova).toMatchObject({
      label: "Q5 · Urgência",
      prompt: "Para quando precisa?",
      options: [
        { label: "Este mês", points: 2, ko: false },
        { label: "Nunca", points: 0, ko: true },
      ],
    });
    expect(typeof nova.key).toBe("string");
    expect(["investimento", "decisor", ""]).not.toContain(nova.key);
  });

  it("🔴 pergunta nova sem pontos não chama o banco e diz por quê", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    await user.type(screen.getByLabelText("Título da pergunta 3"), "Q5 · Urgência");
    await user.type(screen.getByLabelText("Texto da pergunta 3"), "Para quando precisa?");
    await user.type(screen.getByLabelText("Opção 1 da pergunta 3"), "Este mês");
    await user.type(screen.getByLabelText("Opção 2 da pergunta 3"), "Nunca");
    await user.click(screen.getByRole("button", { name: "Salvar perguntas" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Pergunta 3, opção 1: os pontos vão de 0 a 2, sem fração.",
    );
  });

  it("🔴 leitura em erro, sem dado nenhum, não oferece editor", () => {
    consulta = { data: undefined, isError: true, isPending: false };

    render(<QualificacaoSettings />);

    expect(screen.getByText(/não foi possível ler/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar perguntas" })).toBeNull();
  });

  it("🔴 refetch que falha avisa, mas o editor e o rascunho ficam (o TanStack mantém o dado)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QualificacaoSettings />);
    await user.type(screen.getByLabelText("Título da pergunta 1"), " (rascunho)");

    consulta = { data: LIDO, isError: true, isPending: false };
    rerender(<QualificacaoSettings />);

    expect(screen.getByText(/não foi possível ler/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Título da pergunta 1")).toHaveValue("Q1 · Orçamento (rascunho)");
    expect(screen.getByRole("button", { name: "Salvar perguntas" })).toBeEnabled();
  });

  it("carregando mostra o estado e nenhum editor", () => {
    consulta = { data: undefined, isError: false, isPending: true };

    render(<QualificacaoSettings />);

    expect(screen.getByRole("status", { name: "Carregando" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar perguntas" })).toBeNull();
  });

  it("🔴 enquanto grava, os campos, Salvar e Descartar ficam travados; liberada a gravação, voltam", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QualificacaoSettings />);
    await user.type(screen.getByLabelText("Título da pergunta 1"), "x");
    expect(screen.getByLabelText("Título da pergunta 1")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Salvar perguntas" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Descartar alterações" })).toBeEnabled();

    salvando = true;
    rerender(<QualificacaoSettings />);

    expect(screen.getByLabelText("Título da pergunta 1")).toBeDisabled();
    expect(screen.getByLabelText("Texto da pergunta 2")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remover pergunta 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adicionar pergunta" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar perguntas" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar alterações" })).toBeDisabled();

    salvando = false;
    rerender(<QualificacaoSettings />);

    expect(screen.getByLabelText("Título da pergunta 1")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Salvar perguntas" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Descartar alterações" })).toBeEnabled();
  });

  it("🔴 os campos da pergunta nova também travam durante a gravação", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QualificacaoSettings />);
    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    expect(screen.getByLabelText("Opção 1 da pergunta 3")).toBeEnabled();

    salvando = true;
    rerender(<QualificacaoSettings />);

    expect(screen.getByLabelText("Opção 1 da pergunta 3")).toBeDisabled();
    expect(screen.getByLabelText("Pontos da opção 1 da pergunta 3")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "KO da opção 1 da pergunta 3" })).toBeDisabled();
  });

  it("pergunta nova: Adicionar opção e Remover opção mexem só nas opções dela", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    await user.type(screen.getByLabelText("Opção 1 da pergunta 3"), "Primeira");
    await user.type(screen.getByLabelText("Opção 2 da pergunta 3"), "Segunda");

    await user.click(screen.getByRole("button", { name: "Adicionar opção" }));
    expect(screen.getByLabelText("Opção 3 da pergunta 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover opção 1 da pergunta 3" }));
    expect(screen.getByLabelText("Opção 1 da pergunta 3")).toHaveValue("Segunda");
    expect(screen.queryByLabelText("Opção 3 da pergunta 3")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Remover opção 2 da pergunta 3" }));
    expect(screen.getByRole("button", { name: "Remover opção 1 da pergunta 3" })).toBeDisabled();
  });

  it("pergunta nova movida por Subir continua com as opções editáveis, e a antiga não ganha", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    await user.click(screen.getByRole("button", { name: "Subir pergunta 3" }));

    expect(screen.getByLabelText("Opção 1 da pergunta 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Título da pergunta 3")).toHaveValue("Q2 · Decisão");
    expect(screen.queryByLabelText("Opção 1 da pergunta 3")).toBeNull();
  });

  it("clicar no texto KO alterna a opção, como clicar na caixa", async () => {
    const user = userEvent.setup();
    render(<QualificacaoSettings />);

    await user.click(screen.getByRole("button", { name: "Adicionar pergunta" }));
    const caixa = screen.getByRole("checkbox", { name: "KO da opção 2 da pergunta 3" });
    expect(caixa).not.toBeChecked();

    await user.click(screen.getAllByText("KO")[1]);
    expect(caixa).toBeChecked();

    await user.click(caixa);
    expect(caixa).not.toBeChecked();
  });
});
