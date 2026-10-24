import { describe, expect, it } from "vitest";

import { Constants } from "@/shared/types/database.types";

import {
  CANAIS_POR_TIPO,
  MOMENTOS_POR_TIPO,
  combinacaoValida,
  ehTipoDeScript,
  rotuloDoCanal,
  rotuloDoMomento,
  rotuloDoTipo,
} from "./script";

describe("o que cada tipo de script aceita", () => {
  it("SDR aceita os quatro canais frios, e nao aceita reuniao", () => {
    expect(CANAIS_POR_TIPO.sdr).toEqual(["whatsapp", "email", "linkedin", "cold_call"]);
    expect(CANAIS_POR_TIPO.sdr).not.toContain("reuniao");
  });

  it("Closer aceita reuniao, e nao aceita os canais de prospeccao fria", () => {
    expect(CANAIS_POR_TIPO.closer).toEqual(["reuniao", "whatsapp", "email"]);
    expect(CANAIS_POR_TIPO.closer).not.toContain("cold_call");
    expect(CANAIS_POR_TIPO.closer).not.toContain("linkedin");
  });

  it("os momentos nao se misturam entre os dois tipos", () => {
    expect(MOMENTOS_POR_TIPO.sdr).toEqual(["primeiro_contato", "follow_up", "quebra_objecao"]);
    expect(MOMENTOS_POR_TIPO.closer).toEqual(["abertura", "proposta", "objecao", "fechamento"]);

    const intersecao = MOMENTOS_POR_TIPO.sdr.filter((m) =>
      (MOMENTOS_POR_TIPO.closer as readonly string[]).includes(m),
    );
    expect(intersecao).toEqual([]);
  });

  it("a uniao de CANAIS_POR_TIPO cobre exatamente o enum script_channel do banco", () => {
    const doDominio = new Set([...CANAIS_POR_TIPO.sdr, ...CANAIS_POR_TIPO.closer]);
    const doBanco = new Set(Constants.public.Enums.script_channel);
    expect(doDominio).toEqual(doBanco);
  });

  it("a uniao de MOMENTOS_POR_TIPO cobre exatamente o enum script_moment do banco", () => {
    const doDominio = new Set([...MOMENTOS_POR_TIPO.sdr, ...MOMENTOS_POR_TIPO.closer]);
    const doBanco = new Set(Constants.public.Enums.script_moment);
    expect(doDominio).toEqual(doBanco);
  });
});

describe("combinacaoValida espelha o CHECK do banco", () => {
  it("recusa momento de closer em script de SDR", () => {
    expect(combinacaoValida("sdr", "whatsapp", "abertura")).toBe(false);
  });

  it("recusa canal de prospeccao fria em script de closer", () => {
    expect(combinacaoValida("closer", "cold_call", "proposta")).toBe(false);
  });

  it("aceita a combinacao legitima dos dois tipos", () => {
    expect(combinacaoValida("sdr", "whatsapp", "primeiro_contato")).toBe(true);
    expect(combinacaoValida("closer", "reuniao", "fechamento")).toBe(true);
  });
});

describe("ehTipoDeScript", () => {
  it("aceita os dois tipos do enum script_kind do banco", () => {
    expect(Constants.public.Enums.script_kind.every(ehTipoDeScript)).toBe(true);
  });

  it("recusa texto fora da lista, vazio e chave herdada do objeto", () => {
    expect(["gerente", "", "SDR", "constructor", "toString"].some(ehTipoDeScript)).toBe(false);
  });
});

describe("rotulos em portugues", () => {
  it("traduz canal, momento e tipo", () => {
    expect(rotuloDoCanal("cold_call")).toBe("Cold call");
    expect(rotuloDoMomento("quebra_objecao")).toBe("Quebra de objeção");
    expect(rotuloDoTipo("sdr")).toBe("SDR");
  });

  it("cobre TODO valor do enum, sem cair em fallback", () => {
    for (const canal of [...CANAIS_POR_TIPO.sdr, ...CANAIS_POR_TIPO.closer]) {
      expect(rotuloDoCanal(canal)).not.toContain("_");
    }
    for (const momento of [...MOMENTOS_POR_TIPO.sdr, ...MOMENTOS_POR_TIPO.closer]) {
      expect(rotuloDoMomento(momento)).not.toContain("_");
    }
  });
});
