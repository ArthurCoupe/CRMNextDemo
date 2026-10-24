import { describe, expect, it } from "vitest";

import type { ItemDaProposta } from "./grupos";
import { moverItem } from "./ordem";

function item(id: string, tipo: ItemDaProposta["tipo"], ordem: number): ItemDaProposta {
  return {
    id,
    produtoId: null,
    nome: id,
    descricao: null,
    frente: "trafego",
    frentesDoCombo: null,
    linhaDeNegocio: "demanda",
    tipo,
    precoCatalogo: 0,
    valor: 0,
    ordem,
    contratoId: null,
  };
}

describe("moverItem (A1.4)", () => {
  const a = item("a", "mrr", 1);
  const b = item("b", "mrr", 2);
  const c = item("c", "mrr", 3);

  it("descer troca com o vizinho de baixo e devolve só quem mudou", () => {
    expect(moverItem([a, b, c], "a", "descer")).toEqual([
      { id: "b", ordem: 1 },
      { id: "a", ordem: 2 },
    ]);
  });

  it("subir troca com o vizinho de cima", () => {
    expect(moverItem([a, b, c], "c", "subir")).toEqual([
      { id: "c", ordem: 2 },
      { id: "b", ordem: 3 },
    ]);
  });

  it("na ponta não há o que mover", () => {
    expect(moverItem([a, b, c], "a", "subir")).toEqual([]);
    expect(moverItem([a, b, c], "c", "descer")).toEqual([]);
  });

  it("o vizinho é do MESMO grupo: pula o item do outro tipo", () => {
    const p = item("p", "tcv", 2);
    const m2 = item("m2", "mrr", 3);

    expect(moverItem([a, p, m2], "a", "descer")).toEqual([
      { id: "m2", ordem: 1 },
      { id: "a", ordem: 3 },
    ]);
    expect(moverItem([a, p, m2], "p", "subir")).toEqual([]);
  });

  it("ordem repetida (0 e 0) vira 1 e 2", () => {
    const x = item("x", "mrr", 0);
    const y = item("y", "mrr", 0);

    expect(moverItem([x, y], "x", "descer")).toEqual([
      { id: "y", ordem: 1 },
      { id: "x", ordem: 2 },
    ]);
  });

  it("id que não está na lista não move nada", () => {
    expect(moverItem([a, b], "zz", "descer")).toEqual([]);
  });
});
