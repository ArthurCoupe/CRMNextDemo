import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDateTime } from "@/shared/lib/date";

import type { EventoDaOportunidade } from "../api/pipeline.repository";
import { ListaDeEventos } from "./timeline-events";

afterEach(cleanup);

function evento(extra: Partial<EventoDaOportunidade> = {}): EventoDaOportunidade {
  return {
    id: "e1",
    tipo: "note",
    deEstagio: null,
    paraEstagio: null,
    conteudo: "Ligar amanhã",
    autorId: "u1",
    autorNome: "Ana",
    editadoEm: null,
    editadoPorNome: null,
    conteudoOriginal: null,
    correcoes: [],
    criadoEm: "2026-10-01T12:00:00Z",
    ...extra,
  };
}

const PODE = () => true;

describe("ListaDeEventos: correção com rastro (D-069, C3)", () => {
  it("sem aoCorrigir a lista é só de leitura", () => {
    render(<ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} />);
    expect(screen.queryByRole("button", { name: "Corrigir" })).not.toBeInTheDocument();
  });

  it("quem pode corrigir edita e salva o texto aparado, com o editadoEm lido (nulo: nunca corrigida)", async () => {
    const user = userEvent.setup();
    const aoCorrigir = vi.fn();
    render(<ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={aoCorrigir} />);

    await user.click(screen.getByRole("button", { name: "Corrigir" }));
    const campo = screen.getByLabelText("Texto corrigido");
    expect(campo).toHaveValue("Ligar amanhã");
    await user.clear(campo);
    await user.type(campo, "  Ligar sexta  ");
    await user.click(screen.getByRole("button", { name: "Salvar correção" }));

    expect(aoCorrigir).toHaveBeenCalledWith("e1", "Ligar sexta", expect.any(Function), null);
  });

  it("nota já corrigida: a trava entregue é o editadoEm que o evento tinha ao abrir", async () => {
    const user = userEvent.setup();
    const aoCorrigir = vi.fn();
    const corrigida = evento({ editadoEm: "2026-10-02T15:30:00Z", conteudoOriginal: "Ligar hoje" });
    render(<ListaDeEventos eventos={[corrigida]} podeCorrigir={PODE} aoCorrigir={aoCorrigir} />);

    await user.click(screen.getByRole("button", { name: "Corrigir" }));
    await user.click(screen.getByRole("button", { name: "Salvar correção" }));

    expect(aoCorrigir).toHaveBeenCalledWith(
      "e1",
      "Ligar amanhã",
      expect.any(Function),
      "2026-10-02T15:30:00Z",
    );
  });

  describe("🔴 a nota mudou por baixo do formulário aberto (outra tela, recusa relida, refetch por foco)", () => {
    const MUDOU = evento({
      conteudo: "Ligar sexta",
      editadoEm: "2026-10-02T16:45:00Z",
      editadoPorNome: "Bruno",
      conteudoOriginal: "Ligar amanhã",
    });

    it("avisa com o texto novo e desliga o Salvar", async () => {
      const user = userEvent.setup();
      const aoCorrigir = vi.fn();
      const { rerender } = render(
        <ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={aoCorrigir} />,
      );
      await user.click(screen.getByRole("button", { name: "Corrigir" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      rerender(<ListaDeEventos eventos={[MUDOU]} podeCorrigir={PODE} aoCorrigir={aoCorrigir} />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Esta nota foi corrigida em outra tela e agora diz: Ligar sexta. Cancele e abra Corrigir de novo para partir do texto atual.",
      );
      expect(screen.getByRole("button", { name: "Salvar correção" })).toBeDisabled();
      expect(screen.getByLabelText("Texto corrigido")).toHaveValue("Ligar amanhã");
      expect(aoCorrigir).not.toHaveBeenCalled();
    });

    it("controle: a lista relida sem mudança não acende o alerta e o Salvar segue ligado", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={vi.fn()} />,
      );
      await user.click(screen.getByRole("button", { name: "Corrigir" }));

      rerender(<ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={vi.fn()} />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Salvar correção" })).toBeEnabled();
    });

    it("controle: durante a PRÓPRIA gravação a releitura não acende o alerta", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={vi.fn()} />,
      );
      await user.click(screen.getByRole("button", { name: "Corrigir" }));

      rerender(
        <ListaDeEventos eventos={[MUDOU]} podeCorrigir={PODE} aoCorrigir={vi.fn()} corrigindo />,
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("Cancelar e Corrigir de novo parte do texto atual, com a trava nova", async () => {
      const user = userEvent.setup();
      const aoCorrigir = vi.fn();
      const { rerender } = render(
        <ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={aoCorrigir} />,
      );
      await user.click(screen.getByRole("button", { name: "Corrigir" }));
      rerender(<ListaDeEventos eventos={[MUDOU]} podeCorrigir={PODE} aoCorrigir={aoCorrigir} />);

      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      await user.click(screen.getByRole("button", { name: "Corrigir" }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Texto corrigido")).toHaveValue("Ligar sexta");
      await user.click(screen.getByRole("button", { name: "Salvar correção" }));
      expect(aoCorrigir).toHaveBeenCalledWith(
        "e1",
        "Ligar sexta",
        expect.any(Function),
        "2026-10-02T16:45:00Z",
      );
    });
  });

  it("texto vazio não salva", async () => {
    const user = userEvent.setup();
    render(<ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Corrigir" }));
    await user.clear(screen.getByLabelText("Texto corrigido"));
    expect(screen.getByRole("button", { name: "Salvar correção" })).toBeDisabled();
  });

  it("pronto fecha a edição; Cancelar também; e o foco volta ao Corrigir", async () => {
    const user = userEvent.setup();
    render(
      <ListaDeEventos
        eventos={[evento()]}
        podeCorrigir={PODE}
        aoCorrigir={(_id, _texto, pronto) => pronto()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Corrigir" }));
    await user.click(screen.getByRole("button", { name: "Salvar correção" }));
    expect(screen.queryByLabelText("Texto corrigido")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corrigir" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Corrigir" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Texto corrigido")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corrigir" })).toHaveFocus();
  });

  it("sem pronto o formulário segue aberto com o que a pessoa escreveu (erro não perde o texto)", async () => {
    const user = userEvent.setup();
    render(<ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Corrigir" }));
    const campo = screen.getByLabelText("Texto corrigido");
    await user.clear(campo);
    await user.type(campo, "Ligar sexta");
    await user.click(screen.getByRole("button", { name: "Salvar correção" }));
    expect(screen.getByLabelText("Texto corrigido")).toHaveValue("Ligar sexta");
  });

  it("🔴 durante a gravação o formulário trava: campo só leitura (mantém o foco), Salvar e Cancelar desligados", async () => {
    const user = userEvent.setup();
    const aoCorrigir = vi.fn();
    const { rerender } = render(
      <ListaDeEventos eventos={[evento()]} podeCorrigir={PODE} aoCorrigir={aoCorrigir} />,
    );
    await user.click(screen.getByRole("button", { name: "Corrigir" }));
    expect(screen.getByLabelText("Texto corrigido")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();

    rerender(
      <ListaDeEventos
        eventos={[evento()]}
        podeCorrigir={PODE}
        aoCorrigir={aoCorrigir}
        corrigindo
      />,
    );
    const campo = screen.getByLabelText("Texto corrigido");
    expect(campo).toHaveAttribute("readonly");
    expect(campo).toBeEnabled();
    expect(screen.getByRole("button", { name: "Salvar correção" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("🔴 um formulário por vez: com um aberto, nenhum Corrigir; Cancelar devolve os dois", async () => {
    const user = userEvent.setup();
    const duas = [
      evento({ id: "a", conteudo: "Ligar amanhã" }),
      evento({ id: "b", conteudo: "Mandar proposta" }),
    ];
    render(<ListaDeEventos eventos={duas} podeCorrigir={PODE} aoCorrigir={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Corrigir" })).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Corrigir" })[0]);
    expect(screen.queryAllByRole("button", { name: "Corrigir" })).toHaveLength(0);
    expect(screen.getByLabelText("Texto corrigido")).toHaveValue("Ligar amanhã");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getAllByRole("button", { name: "Corrigir" })).toHaveLength(2);
  });

  it("🔴 mudança de etapa nunca oferece Corrigir, mesmo com podeCorrigir verdadeiro", () => {
    render(
      <ListaDeEventos
        eventos={[evento({ tipo: "stage_change", deEstagio: "prospeccao", paraEstagio: "r1" })]}
        podeCorrigir={PODE}
        aoCorrigir={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Corrigir" })).not.toBeInTheDocument();
  });

  it("podeCorrigir falso esconde o botão (negativo ao lado)", () => {
    render(<ListaDeEventos eventos={[evento()]} podeCorrigir={() => false} aoCorrigir={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Corrigir" })).not.toBeInTheDocument();
  });

  describe("o rastro da correção", () => {
    const QUANDO = formatDateTime("2026-10-02T15:30:00Z");

    it("mostra quem corrigiu, quando e o texto original", () => {
      render(
        <ListaDeEventos
          eventos={[
            evento({
              conteudo: "Ligar sexta",
              editadoEm: "2026-10-02T15:30:00Z",
              editadoPorNome: "Bruno",
              conteudoOriginal: "Ligar amanhã",
            }),
          ]}
        />,
      );
      expect(
        screen.getByText(`Editado por Bruno em ${QUANDO}. Texto original: Ligar amanhã`),
      ).toBeInTheDocument();
    });

    it("correção sem sessão (editado_por nulo): diz autor não identificado", () => {
      render(
        <ListaDeEventos
          eventos={[
            evento({
              conteudo: "Ligar sexta",
              editadoEm: "2026-10-02T15:30:00Z",
              editadoPorNome: null,
              conteudoOriginal: "Ligar amanhã",
            }),
          ]}
        />,
      );
      expect(
        screen.getByText(
          `Editado por autor não identificado em ${QUANDO}. Texto original: Ligar amanhã`,
        ),
      ).toBeInTheDocument();
    });

    it("sem texto original guardado: diz 'sem texto'", () => {
      render(
        <ListaDeEventos
          eventos={[
            evento({
              editadoEm: "2026-10-02T15:30:00Z",
              editadoPorNome: "Bruno",
              conteudoOriginal: null,
            }),
          ]}
        />,
      );
      expect(
        screen.getByText(`Editado por Bruno em ${QUANDO}. Texto original: sem texto`),
      ).toBeInTheDocument();
    });

    it("evento nunca corrigido não mostra rastro (controle)", () => {
      render(<ListaDeEventos eventos={[evento()]} />);
      expect(screen.queryByText(/Editado por/)).not.toBeInTheDocument();
    });

    const PRIMEIRA = {
      id: "c1",
      antes: "Ligar amanhã",
      depois: "Ligar sexta",
      corrigidoEm: "2026-10-02T15:30:00Z",
      corrigidoPorNome: "Ana",
    };
    const SEGUNDA = {
      id: "c2",
      antes: "Ligar sexta",
      depois: "Ligar sábado",
      corrigidoEm: "2026-10-02T16:45:00Z",
      corrigidoPorNome: null,
    };

    it("🔴 da segunda correção em diante, cada uma aparece com o próprio autor (C3: a primeira não se perde)", async () => {
      const user = userEvent.setup();
      render(
        <ListaDeEventos
          eventos={[
            evento({
              conteudo: "Ligar sábado",
              editadoEm: "2026-10-02T16:45:00Z",
              editadoPorNome: null,
              conteudoOriginal: "Ligar amanhã",
              correcoes: [SEGUNDA, PRIMEIRA],
            }),
          ]}
        />,
      );
      await user.click(screen.getByText("Ver as 2 correções"));
      const itens = within(screen.getByRole("list", { name: "Correções da nota" })).getAllByRole(
        "listitem",
      );
      expect(itens.map((li) => li.textContent)).toEqual([
        `Por autor não identificado em ${formatDateTime("2026-10-02T16:45:00Z")}: de "Ligar sexta" para "Ligar sábado".`,
        `Por Ana em ${QUANDO}: de "Ligar amanhã" para "Ligar sexta".`,
      ]);
    });

    it("evento que nasceu sem texto: a correção diz 'de sem texto', sem aspas", async () => {
      const user = userEvent.setup();
      render(
        <ListaDeEventos
          eventos={[
            evento({
              conteudo: "Ligar sexta",
              editadoEm: "2026-10-02T15:30:00Z",
              editadoPorNome: "Ana",
              conteudoOriginal: null,
              correcoes: [
                { ...SEGUNDA, antes: "Ligar sexta", depois: "Ligar sábado" },
                { ...PRIMEIRA, antes: null },
              ],
            }),
          ]}
        />,
      );
      await user.click(screen.getByText("Ver as 2 correções"));
      const itens = within(screen.getByRole("list", { name: "Correções da nota" })).getAllByRole(
        "listitem",
      );
      expect(itens[1]?.textContent).toBe(`Por Ana em ${QUANDO}: de sem texto para "Ligar sexta".`);
    });

    it("com uma correção só, a linha do rastro basta e a lista não aparece (controle)", () => {
      render(
        <ListaDeEventos
          eventos={[
            evento({
              conteudo: "Ligar sexta",
              editadoEm: "2026-10-02T15:30:00Z",
              editadoPorNome: "Ana",
              conteudoOriginal: "Ligar amanhã",
              correcoes: [PRIMEIRA],
            }),
          ]}
        />,
      );
      expect(
        screen.getByText(`Editado por Ana em ${QUANDO}. Texto original: Ligar amanhã`),
      ).toBeInTheDocument();
      expect(screen.queryByText(/correções/)).not.toBeInTheDocument();
    });
  });
});
