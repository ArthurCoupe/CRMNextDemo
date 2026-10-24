import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("🔴 temaInicial decide o primeiro render, nunca document.documentElement", () => {
    const contains = vi.spyOn(document.documentElement.classList, "contains");

    render(<ThemeToggle temaInicial="light" />);

    expect(screen.getByRole("button", { name: "Mudar para tema escuro" })).toBeInTheDocument();
    expect(contains).not.toHaveBeenCalled();
  });

  it('temaInicial="dark" mostra o rótulo simétrico, sem consultar document', () => {
    const contains = vi.spyOn(document.documentElement.classList, "contains");

    render(<ThemeToggle temaInicial="dark" />);

    expect(screen.getByRole("button", { name: "Mudar para tema claro" })).toBeInTheDocument();
    expect(contains).not.toHaveBeenCalled();
  });
});
