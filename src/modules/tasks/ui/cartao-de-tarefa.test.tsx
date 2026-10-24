import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tarefa } from "../domain/task";
import { CartaoDeTarefa } from "./cartao-de-tarefa";

const perfil = { papel: "owner" as string | null, meuId: "user-1" as string | null };
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfil }));

const arrasto = vi.hoisted(() => ({ ativo: false }));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const real = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...real,
    useDraggable: (args: Parameters<typeof real.useDraggable>[0]) => {
      const resultado = real.useDraggable(args);
      return arrasto.ativo ? { ...resultado, isDragging: true } : resultado;
    },
  };
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

const onAbrir = vi.fn();
const onMover = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  perfil.papel = "owner";
  perfil.meuId = "user-1";
  arrasto.ativo = false;
});

function renderCartao(tarefa: Tarefa = TAREFA, movendo = false) {
  return render(
    <DndContext>
      <CartaoDeTarefa tarefa={tarefa} movendo={movendo} onAbrir={onAbrir} onMover={onMover} />
    </DndContext>,
  );
}

function abrirMenuDeMover() {
  const gatilho = screen.getByRole("button", { name: "Mover para" });
  gatilho.focus();
  fireEvent.keyDown(gatilho, { key: "ArrowDown" });
}

describe("abrir", () => {
  it("clicar no cartão abre a tarefa", async () => {
    const user = userEvent.setup();
    renderCartao();

    await user.click(screen.getByRole("button", { name: /Revisar contrato/ }));

    expect(onAbrir).toHaveBeenCalledTimes(1);
  });
});

describe("quem move (D-066)", () => {
  it("🔴 member que não responde nem participa: sem alça nem menu, mas abre", async () => {
    perfil.papel = "member";
    perfil.meuId = "user-2";
    const user = userEvent.setup();
    renderCartao();

    expect(screen.queryByRole("button", { name: "Arrastar tarefa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mover para" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Revisar contrato/ }));
    expect(onAbrir).toHaveBeenCalledTimes(1);
  });

  it("participante tem alça e menu (o positivo ao lado)", () => {
    perfil.papel = "member";
    perfil.meuId = "user-2";
    renderCartao({ ...TAREFA, participantes: [{ id: "user-2", nome: "Beltrana", ativo: true }] });

    expect(screen.getByRole("button", { name: "Arrastar tarefa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover para" })).toBeInTheDocument();
  });

  it("🔴 responsável desativado (papel null, sessão válida): sem alça nem menu", () => {
    perfil.papel = null;
    perfil.meuId = "user-1";
    renderCartao();

    expect(screen.queryByRole("button", { name: "Arrastar tarefa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mover para" })).not.toBeInTheDocument();
  });

  it("o menu lista as outras três colunas e move com a escolhida", async () => {
    const user = userEvent.setup();
    renderCartao();

    abrirMenuDeMover();
    expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
      "Em andamento",
      "Em revisão",
      "Concluída",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "Em revisão" }));

    expect(onMover).toHaveBeenCalledWith("review");
  });

  it("enquanto move, o menu trava", () => {
    renderCartao(TAREFA, true);

    expect(screen.getByRole("button", { name: "Mover para" })).toBeDisabled();
  });
});

describe("o cartão arrastado fica por cima", () => {
  const artigo = () => screen.getByRole("article");

  it("🔴 arrastando, o cartão leva z-10", () => {
    arrasto.ativo = true;
    renderCartao();

    expect(artigo()).toHaveClass("z-10");
  });

  it("parado, ou movendo pelo menu, o cartão não leva z-10", () => {
    const { unmount } = renderCartao();
    expect(artigo()).not.toHaveClass("z-10");
    unmount();

    renderCartao(TAREFA, true);
    expect(artigo()).not.toHaveClass("z-10");
    expect(artigo()).toHaveClass("opacity-60");
  });
});

describe("leitor de tela", () => {
  it("a alça diz 'tarefa arrastável' em português e é descrita pelo título", () => {
    renderCartao();

    const alca = screen.getByRole("button", { name: "Arrastar tarefa" });
    expect(alca).toHaveAttribute("aria-roledescription", "tarefa arrastável");
    expect(alca).toHaveAccessibleDescription(/Revisar contrato/);
    expect(alca.getAttribute("aria-describedby")).toMatch(/^DndDescribedBy-\S+ \S+$/);
    expect(alca).toHaveAttribute("tabindex", "-1");
  });

  it("o menu 'Mover para' é descrito pelo título, e o rótulo continua o mesmo", () => {
    renderCartao();

    const menu = screen.getByRole("button", { name: "Mover para" });
    expect(menu).toHaveAccessibleDescription("Revisar contrato");
  });

  it("com dois cartões, cada alça aponta o título do próprio cartão", () => {
    render(
      <DndContext>
        <CartaoDeTarefa tarefa={TAREFA} movendo={false} onAbrir={onAbrir} onMover={onMover} />
        <CartaoDeTarefa
          tarefa={{ ...TAREFA, id: "tarefa-2", titulo: "Ligar para a Acme" }}
          movendo={false}
          onAbrir={onAbrir}
          onMover={onMover}
        />
      </DndContext>,
    );

    const [primeira, segunda] = screen.getAllByRole("button", { name: "Arrastar tarefa" });
    expect(primeira).toHaveAccessibleDescription(/Revisar contrato/);
    expect(primeira).not.toHaveAccessibleDescription(/Ligar para a Acme/);
    expect(segunda).toHaveAccessibleDescription(/Ligar para a Acme/);
  });
});

describe("o resumo", () => {
  it("o responsável mostra quantos participantes há além dele", () => {
    renderCartao({
      ...TAREFA,
      participantes: [
        { id: "user-2", nome: "Beltrana", ativo: true },
        { id: "user-3", nome: "Ciclano", ativo: true },
      ],
    });

    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("sem participantes, nenhum +N", () => {
    renderCartao();

    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it("descrição e links viram aviso só para o leitor de tela", () => {
    renderCartao({
      ...TAREFA,
      descricao: "Pedir o contrato",
      links: [{ id: "l1", rotulo: "Briefing", url: "https://docs.google.com/x" }],
    });

    expect(screen.getByText("Tem descrição.")).toHaveClass("sr-only");
    expect(screen.getByText("Tem links.")).toHaveClass("sr-only");
  });

  it("sem descrição nem links, nenhum aviso", () => {
    renderCartao();

    expect(screen.queryByText("Tem descrição.")).not.toBeInTheDocument();
    expect(screen.queryByText("Tem links.")).not.toBeInTheDocument();
  });
});

describe("o resumo — ícones de descrição e de links", () => {
  const LINK = { id: "l1", rotulo: "Briefing", url: "https://docs.google.com/x" };
  const iconeDeDescricao = (c: HTMLElement) => c.querySelector<SVGElement>("svg.lucide-align-left");
  const iconeDeLinks = (c: HTMLElement) => c.querySelector<SVGElement>("svg.lucide-link-2");

  it("com descrição e links, cada um tem seu ícone, escondido do leitor de tela e ao lado do aviso", () => {
    const { container } = renderCartao({ ...TAREFA, descricao: "Pedir o contrato", links: [LINK] });

    expect(iconeDeDescricao(container)).toHaveAttribute("aria-hidden", "true");
    expect(iconeDeLinks(container)).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Tem descrição.").parentElement).toContainElement(
      iconeDeDescricao(container),
    );
    expect(screen.getByText("Tem links.").parentElement).toContainElement(iconeDeLinks(container));
  });

  it("só com descrição, só o ícone de descrição", () => {
    const { container } = renderCartao({ ...TAREFA, descricao: "Pedir o contrato" });

    expect(iconeDeDescricao(container)).toBeInTheDocument();
    expect(iconeDeLinks(container)).not.toBeInTheDocument();
  });

  it("só com links, só o ícone de links", () => {
    const { container } = renderCartao({ ...TAREFA, links: [LINK] });

    expect(iconeDeLinks(container)).toBeInTheDocument();
    expect(iconeDeDescricao(container)).not.toBeInTheDocument();
  });

  it("sem descrição, com descrição só de espaços, e sem links: nenhum ícone", () => {
    const { container, unmount } = renderCartao();
    expect(iconeDeDescricao(container)).not.toBeInTheDocument();
    expect(iconeDeLinks(container)).not.toBeInTheDocument();
    unmount();

    const outro = renderCartao({ ...TAREFA, descricao: "   " });
    expect(iconeDeDescricao(outro.container)).not.toBeInTheDocument();
  });
});
