import { describe, expect, it } from "vitest";

import { acoes, podeEditar, ROTULO_DO_STATUS, rotuloDaProposta } from "./ciclo";

describe("ROTULO_DO_STATUS", () => {
  it("um rótulo por status", () => {
    expect(ROTULO_DO_STATUS).toEqual({
      rascunho: "Rascunho",
      enviada: "Enviada",
      aceita: "Aceita",
      recusada: "Recusada",
    });
  });
});

describe("rotuloDaProposta", () => {
  it("numero com 4 digitos e a versao", () => {
    expect(rotuloDaProposta(7, 1)).toBe("Nº 0007 v1");
    expect(rotuloDaProposta(12345, 3)).toBe("Nº 12345 v3");
  });
});

describe("podeEditar", () => {
  it("so o rascunho", () => {
    expect(podeEditar("rascunho")).toBe(true);
    expect(podeEditar("enviada")).toBe(false);
    expect(podeEditar("aceita")).toBe(false);
    expect(podeEditar("recusada")).toBe(false);
  });
});

describe("acoes", () => {
  it.each([
    ["rascunho", "member", true, ["baixar_pdf", "excluir"]],
    ["rascunho", "owner", true, ["baixar_pdf", "excluir"]],
    ["rascunho", "owner", false, ["baixar_pdf", "excluir"]],
    ["rascunho", "client", true, []],
    ["rascunho", null, true, []],
    ["enviada", "member", true, ["baixar_pdf", "recusar", "nova_versao"]],
    ["enviada", "manager", true, ["baixar_pdf", "recusar", "nova_versao"]],
    ["enviada", "owner", true, ["baixar_pdf", "recusar", "nova_versao", "aceitar"]],
    ["enviada", "owner", false, ["baixar_pdf"]],
    ["enviada", "manager", false, ["baixar_pdf"]],
    ["enviada", "member", false, ["baixar_pdf"]],
    ["recusada", "member", true, ["baixar_pdf", "nova_versao"]],
    ["recusada", "manager", true, ["baixar_pdf", "nova_versao"]],
    ["recusada", "owner", true, ["baixar_pdf", "nova_versao"]],
    ["recusada", "member", false, ["baixar_pdf"]],
    ["recusada", "client", true, []],
    ["aceita", "owner", true, ["baixar_pdf"]],
    ["aceita", "manager", true, ["baixar_pdf"]],
    ["aceita", "member", true, ["baixar_pdf"]],
    ["aceita", "owner", false, ["baixar_pdf"]],
    ["aceita", null, true, []],
    ["enviada", "client", true, []],
    ["enviada", null, true, []],
  ] as const)("%s, %s, ultima=%s", (status, papel, ultima, esperado) => {
    expect(acoes(status, papel, ultima)).toEqual(esperado);
  });
});
