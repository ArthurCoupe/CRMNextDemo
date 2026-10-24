import { describe, expect, it } from "vitest";

import { ORDEM_DOS_STATUS } from "./post";
import { destinosDe, passoDoMovimento, podeMover, rotuloDaAcao, TRANSICOES } from "./transicoes";

const PARES = ORDEM_DOS_STATUS.flatMap((de) => ORDEM_DOS_STATUS.map((para) => [de, para] as const));

describe("transicoes", () => {
  it("são exatamente as onze da spec", () => {
    expect(
      PARES.filter(([de, para]) => podeMover(de, para)).map(([de, para]) => `${de}>${para}`),
    ).toEqual([
      "rascunho>em_aprovacao",
      "em_aprovacao>rascunho",
      "em_aprovacao>ajuste_pedido",
      "em_aprovacao>aprovado",
      "ajuste_pedido>rascunho",
      "ajuste_pedido>em_aprovacao",
      "aprovado>ajuste_pedido",
      "aprovado>agendado",
      "aprovado>publicado",
      "agendado>aprovado",
      "agendado>publicado",
    ]);
  });

  it("publicado é final e nenhum status vai para ele mesmo", () => {
    expect(destinosDe("publicado")).toEqual([]);
    for (const s of ORDEM_DOS_STATUS) expect(podeMover(s, s)).toBe(false);
  });

  it("toda transição válida tem rótulo de ação, e só ela", () => {
    for (const [de, para] of PARES) {
      expect(rotuloDaAcao(de, para) !== undefined).toBe(podeMover(de, para));
    }
    expect(rotuloDaAcao("agendado", "aprovado")).toBe("Desagendar");
    expect(rotuloDaAcao("ajuste_pedido", "em_aprovacao")).toBe("Reenviar ao cliente");
  });

  it("passo do movimento: nada fora da tabela, nota no ajuste, link na publicação", () => {
    expect(passoDoMovimento("rascunho", "rascunho")).toBe("nada");
    expect(passoDoMovimento("rascunho", "aprovado")).toBe("nada");
    expect(passoDoMovimento("rascunho", "em_aprovacao")).toBe("mover");
    expect(passoDoMovimento("em_aprovacao", "ajuste_pedido")).toBe("pedir_nota");
    expect(passoDoMovimento("aprovado", "ajuste_pedido")).toBe("pedir_nota");
    expect(passoDoMovimento("aprovado", "publicado")).toBe("pedir_link");
    expect(passoDoMovimento("agendado", "publicado")).toBe("pedir_link");
  });

  it("a tabela tem uma entrada por status", () => {
    expect(Object.keys(TRANSICOES).sort()).toEqual([...ORDEM_DOS_STATUS].sort());
  });
});
