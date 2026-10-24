import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const global = globalThis as { __webpack_nonce__?: string };

function estiloDoViewport(): HTMLStyleElement | undefined {
  return [...document.querySelectorAll("style")].find((s) =>
    s.textContent?.includes("[data-radix-select-viewport]"),
  );
}

function abrirSelect() {
  return render(
    <Select defaultOpen>
      <SelectTrigger>
        <SelectValue placeholder="Escolha" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">A</SelectItem>
      </SelectContent>
    </Select>,
  );
}

afterEach(() => {
  delete global.__webpack_nonce__;
});

describe("SelectContent — nonce da CSP", () => {
  it("🔴 o <style> do Viewport leva o nonce publicado pelo roteador", () => {
    global.__webpack_nonce__ = "nonce-de-teste";
    abrirSelect();

    expect(estiloDoViewport()?.getAttribute("nonce")).toBe("nonce-de-teste");
  });

  it("controle: sem nonce publicado, o <style> existe e sai sem nonce", () => {
    abrirSelect();

    const estilo = estiloDoViewport();
    expect(estilo).toBeDefined();
    expect(estilo?.hasAttribute("nonce")).toBe(false);
  });
});
