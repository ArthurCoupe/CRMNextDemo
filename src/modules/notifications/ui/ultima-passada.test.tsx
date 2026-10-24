import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { todaySP } from "@/shared/lib/date";

import type { UltimaPassada as Carimbo } from "../domain/passada";
import { useUltimaPassada } from "../hooks/use-notifications";
import { UltimaPassada } from "./ultima-passada";

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ papel: "owner" }) }));
vi.mock("../hooks/use-notifications", () => ({ useUltimaPassada: vi.fn() }));

const FALHA = "falha: lead_frio: column em_nutricao does not exist";
const DADO = "dado: oportunidade o1 está fria e não tem responsável";

function carimbo(sobrescrita: Partial<Carimbo>): Carimbo {
  return {
    dia: todaySP(),
    ok: true,
    terminouEm: new Date().toISOString(),
    erro: null,
    contadores: { digest: { enviados: 2, duplicados: 0, falhas: 0 } },
    problemas: [],
    ...sobrescrita,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UltimaPassada com runner caído", () => {
  it("controle: passada ok mostra a linha verde e a linha `dado:` em cinza", () => {
    vi.mocked(useUltimaPassada).mockReturnValue({
      data: carimbo({ problemas: [DADO] }),
      isError: false,
      isPending: false,
    } as never);

    const { container } = render(<UltimaPassada />);

    expect(screen.getByText(/Última passada:/)).toBeInTheDocument();
    expect(container.textContent).toContain("0 falhas");
    expect(screen.getByText(`· ${DADO}`)).not.toHaveClass("text-destructive");
  });

  it("🔴 ok=false com `falha:`: sem linha verde, e a falha pintada como erro", () => {
    vi.mocked(useUltimaPassada).mockReturnValue({
      data: carimbo({ ok: false, problemas: [DADO, FALHA] }),
      isError: false,
      isPending: false,
    } as never);

    const { container } = render(<UltimaPassada />);

    expect(screen.queryByText(/Última passada:/)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("0 falhas");
    expect(screen.getByText("A última passada falhou")).toBeInTheDocument();
    expect(screen.getByText(`· ${FALHA}`)).toHaveClass("text-destructive");
    expect(screen.getByText(`· ${DADO}`)).not.toHaveClass("text-destructive");
  });
});
