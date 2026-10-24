import { describe, expect, it } from "vitest";

import { opcoesDeVenda, vendaQueFica } from "./venda-de-origem";

const GANHAS = [
  { id: "v-beta", nome: "Beta" },
  { id: "v-acme", nome: "Acme" },
];
const ORIGENS = [
  { vendaId: "v-gama", vendaNome: "Gama", clienteId: "cli-1" },
  { vendaId: "v-delta", vendaNome: "Delta", clienteId: "cli-2" },
];

describe("opcoesDeVenda", () => {
  it("ganhas sem contrato mais as vendas do cliente, em ordem de nome", () => {
    expect(opcoesDeVenda(GANHAS, ORIGENS, "cli-1")).toEqual([
      { id: "v-acme", nome: "Acme" },
      { id: "v-beta", nome: "Beta" },
      { id: "v-gama", nome: "Gama" },
    ]);
  });

  it("🔴 venda com contrato de outro cliente fica fora", () => {
    const ids = opcoesDeVenda(GANHAS, ORIGENS, "cli-1").map((v) => v.id);
    expect(ids).not.toContain("v-delta");
    expect(opcoesDeVenda(GANHAS, ORIGENS, "cli-2").map((v) => v.id)).toContain("v-delta");
  });

  it("sem cliente escolhido, só as ganhas sem contrato", () => {
    expect(opcoesDeVenda(GANHAS, ORIGENS, "").map((v) => v.id)).toEqual(["v-acme", "v-beta"]);
  });

  it("venda que aparece nas duas listas sai uma vez só", () => {
    const repetida = [{ vendaId: "v-acme", vendaNome: "Acme", clienteId: "cli-1" }];
    expect(opcoesDeVenda(GANHAS, repetida, "cli-1")).toHaveLength(2);
  });

  it("🔴 na edição, a venda atual do contrato é sempre opção, mesmo de outro cliente (spec §4)", () => {
    const atual = { id: "v-delta", nome: "Delta" };
    expect(opcoesDeVenda(GANHAS, ORIGENS, "cli-1", atual).map((v) => v.id)).toContain("v-delta");
    expect(opcoesDeVenda(GANHAS, ORIGENS, "cli-1", null).map((v) => v.id)).not.toContain("v-delta");
  });
});

describe("vendaQueFica", () => {
  const opcoes = [{ id: "v-acme", nome: "Acme" }];

  it("a venda escolhida fica se continua entre as opções", () => {
    expect(vendaQueFica("v-acme", opcoes)).toBe("v-acme");
  });

  it("🔴 a venda que deixou de ser opção volta para nenhuma", () => {
    expect(vendaQueFica("v-delta", opcoes)).toBeNull();
  });

  it("nenhuma continua nenhuma", () => {
    expect(vendaQueFica(null, opcoes)).toBeNull();
  });
});
