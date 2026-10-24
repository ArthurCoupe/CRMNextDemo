import { describe, expect, it } from "vitest";

import {
  agendaEditavel,
  COR_DO_STATUS,
  conteudoEditavel,
  ETAPAS,
  ORDEM_DOS_STATUS,
  ROTULO_DO_STATUS,
} from "./post";

describe("post", () => {
  it("as etapas P·E·CO·L cobrem os seis status uma vez, na ordem do fluxo", () => {
    expect(ETAPAS.flatMap((e) => e.status)).toEqual(ORDEM_DOS_STATUS);
    expect(ETAPAS.map((e) => `${e.sigla} · ${e.nome}`)).toEqual([
      "P · Produção",
      "E · Envio",
      "CO · Correção",
      "L · Lançamento",
    ]);
  });

  it("conteúdo só muda em rascunho e ajuste pedido; agenda até a publicação", () => {
    expect(ORDEM_DOS_STATUS.filter(conteudoEditavel)).toEqual(["rascunho", "ajuste_pedido"]);
    expect(ORDEM_DOS_STATUS.filter((s) => !agendaEditavel(s))).toEqual(["publicado"]);
  });

  it("todo status tem rótulo e cor", () => {
    for (const s of ORDEM_DOS_STATUS) {
      expect(ROTULO_DO_STATUS[s]).not.toBe("");
      expect(COR_DO_STATUS[s]).toMatch(/^bg-/);
    }
  });
});
