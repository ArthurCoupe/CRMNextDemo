import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const onPointerDown = vi.fn();
const onKeyDown = vi.fn();

vi.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({
    attributes: { role: "button", tabIndex: 0, "aria-roledescription": "draggable" },
    listeners: { onPointerDown, onKeyDown },
    setNodeRef: () => {},
    setActivatorNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
}));

const { OpportunityCard } = await import("./opportunity-card");

const OPORTUNIDADE = {
  id: "86e00000-0000-4000-8000-000000000001",
  nome: "Padaria do Zé",
  estagio: "qualificacao",
  contatoNome: null,
  responsavelNome: null,
  responsavelId: null,
  linhaDeNegocio: null,
  frentesEsperadas: null,
  proximoFollowUp: null,
  respostas: [],
  fechadoMrr: null,
  fechadoTcv: null,
  clienteId: null,
} as unknown as Parameters<typeof OpportunityCard>[0]["oportunidade"];

beforeEach(() => {
  onPointerDown.mockReset();
  onKeyDown.mockReset();
});

describe("o checkbox de seleção", () => {
  it("só existe quando `selecionavel` — o member não vê checkbox", () => {
    const { rerender } = render(
      <OpportunityCard oportunidade={OPORTUNIDADE} aoAbrir={vi.fn()} podeArrastar={false} />,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();

    rerender(
      <OpportunityCard
        oportunidade={OPORTUNIDADE}
        aoAbrir={vi.fn()}
        podeArrastar
        selecionavel
        selecionado={false}
        aoSelecionar={vi.fn()}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Selecionar Padaria do Zé" })).toBeInTheDocument();
  });

  it("clicar alterna pela `aoSelecionar(id)` e NÃO abre a ficha", async () => {
    const user = userEvent.setup();
    const aoSelecionar = vi.fn();
    const aoAbrir = vi.fn();
    render(
      <OpportunityCard
        oportunidade={OPORTUNIDADE}
        aoAbrir={aoAbrir}
        podeArrastar
        selecionavel
        selecionado={false}
        aoSelecionar={aoSelecionar}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Selecionar Padaria do Zé" }));

    expect(aoSelecionar).toHaveBeenCalledWith(OPORTUNIDADE.id);
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it("`selecionado` é o estado marcado", () => {
    render(
      <OpportunityCard
        oportunidade={OPORTUNIDADE}
        aoAbrir={vi.fn()}
        podeArrastar
        selecionavel
        selecionado
        aoSelecionar={vi.fn()}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("🔴 pointerdown no checkbox NÃO chega ao sensor de ponteiro — no card, chega", () => {
    render(
      <OpportunityCard
        oportunidade={OPORTUNIDADE}
        aoAbrir={vi.fn()}
        podeArrastar
        selecionavel
        selecionado={false}
        aoSelecionar={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("checkbox"));
    expect(onPointerDown).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByRole("button", { name: /Padaria do Zé/ }));
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("🔴 Space no checkbox NÃO chega ao sensor de teclado — no card, chega", () => {
    render(
      <OpportunityCard
        oportunidade={OPORTUNIDADE}
        aoAbrir={vi.fn()}
        podeArrastar
        selecionavel
        selecionado={false}
        aoSelecionar={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByRole("checkbox"), { key: " ", code: "Space" });
    expect(onKeyDown).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("button", { name: /Padaria do Zé/ }), {
      key: " ",
      code: "Space",
    });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});

describe("selo de primeiro contato (D-063)", () => {
  const CONTATO = { venceEm: "2026-01-05T13:05:00Z", primeiroToqueEm: null };

  it("no prazo: '1º contato até 10:05', sem a cor de erro", () => {
    render(
      <OpportunityCard
        oportunidade={OPORTUNIDADE}
        aoAbrir={vi.fn()}
        podeArrastar={false}
        primeiroContato={CONTATO}
        agora={new Date("2026-01-05T13:00:00Z")}
      />,
    );
    const selo = screen.getByText("1º contato até 10:05");
    expect(selo.closest("p")).not.toHaveClass("text-destructive");
  });

  it("🔴 atrasado: '1º contato atrasado desde 10:05', com a cor de erro", () => {
    render(
      <OpportunityCard
        oportunidade={OPORTUNIDADE}
        aoAbrir={vi.fn()}
        podeArrastar={false}
        primeiroContato={CONTATO}
        agora={new Date("2026-01-05T13:06:00Z")}
      />,
    );
    expect(screen.getByText("1º contato atrasado desde 10:05").closest("p")).toHaveClass(
      "text-destructive",
    );
  });

  it("tocado, ou sem dado de primeiro contato: nenhum selo", () => {
    const { rerender } = render(
      <OpportunityCard
        oportunidade={OPORTUNIDADE}
        aoAbrir={vi.fn()}
        podeArrastar={false}
        primeiroContato={{ ...CONTATO, primeiroToqueEm: "2026-01-05T13:03:00Z" }}
        agora={new Date("2026-01-05T13:06:00Z")}
      />,
    );
    expect(screen.queryByText(/1º contato/)).toBeNull();

    rerender(
      <OpportunityCard oportunidade={OPORTUNIDADE} aoAbrir={vi.fn()} podeArrastar={false} />,
    );
    expect(screen.queryByText(/1º contato/)).toBeNull();
  });
});

describe("selo Sem contrato (D-071)", () => {
  function cartao(parcial: { estagio: string; clienteId: string | null }) {
    return (
      <OpportunityCard
        oportunidade={{ ...OPORTUNIDADE, ...parcial } as typeof OPORTUNIDADE}
        aoAbrir={vi.fn()}
        podeArrastar={false}
      />
    );
  }

  it("ganha sem contrato mostra o selo, na cor de atenção", () => {
    render(cartao({ estagio: "fechado", clienteId: null }));
    expect(screen.getByText("Sem contrato")).toHaveClass("text-amber-500");
  });

  it("ganha com contrato não mostra o selo", () => {
    render(cartao({ estagio: "fechado", clienteId: "cli-1" }));
    expect(screen.queryByText("Sem contrato")).toBeNull();
  });

  it("fora de Fechado, sem contrato é o normal: nenhum selo", () => {
    render(cartao({ estagio: "r2", clienteId: null }));
    expect(screen.queryByText("Sem contrato")).toBeNull();
  });

  it("o selo antigo não aparece mais", () => {
    render(cartao({ estagio: "fechado", clienteId: null }));
    expect(screen.queryByText("Sem cliente")).toBeNull();
  });
});
