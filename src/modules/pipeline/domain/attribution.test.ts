import { describe, expect, it } from "vitest";

import {
  CAMPOS_UTM,
  extrairRef,
  montarLinkWhatsApp,
  temDadosDeCampanha,
  type DadosDeAtribuicao,
} from "./attribution";

const ID = "a3f1c2d4-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

describe("extrairRef", () => {
  it("acha o ref no meio da mensagem inteira do WhatsApp", () => {
    expect(extrairRef(`Olá! Vim pelo site e quero saber mais. ref:${ID}`)).toBe(ID);
  });

  it("tolera espaço depois dos dois-pontos e maiúsculas", () => {
    expect(extrairRef(`ref: ${ID.toUpperCase()}`)).toBe(ID);
  });

  it("aceita o id cru colado sozinho, sem o prefixo", () => {
    expect(extrairRef(`  ${ID}  `)).toBe(ID);
  });

  it("aceita o id sem hífens", () => {
    const semHifens = ID.replace(/-/g, "");
    expect(extrairRef(`ref:${semHifens}`)).toBe(semHifens);
  });

  it("recusa texto sem ref — devolve null, nunca lixo para a query", () => {
    expect(extrairRef("Olá, quero saber mais")).toBeNull();
    expect(extrairRef("")).toBeNull();
    expect(extrairRef("ref:")).toBeNull();
    expect(extrairRef("ref:abc")).toBeNull();
  });

  it("recusa id com forma errada", () => {
    expect(extrairRef("ref:zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz")).toBeNull();
    expect(extrairRef(`ref:${ID}00`)).toBeNull();
  });
});

describe("montarLinkWhatsApp", () => {
  it("monta o wa.me com o ref no texto", () => {
    const link = montarLinkWhatsApp("5511999999999", ID);
    expect(link).toMatch(/^https:\/\/wa\.me\/5511999999999\?text=/);
    expect(decodeURIComponent(link.split("text=")[1]!)).toContain(`ref:${ID}`);
  });

  it("limpa formatação do telefone", () => {
    expect(montarLinkWhatsApp("+55 (11) 99999-9999", ID)).toMatch(/wa\.me\/5511999999999/);
  });

  it("recusa telefone curto demais", () => {
    expect(() => montarLinkWhatsApp("11999", ID)).toThrow(/internacional/);
  });

  it("o ref extraído do próprio link é o mesmo que entrou", () => {
    const link = montarLinkWhatsApp("5511999999999", ID);
    const texto = decodeURIComponent(link.split("text=")[1]!);
    expect(extrairRef(texto)).toBe(ID);
  });
});

describe("temDadosDeCampanha", () => {
  const vazio: DadosDeAtribuicao = {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    landingUrl: null,
  };

  it("null e tudo-nulo não têm campanha — a tela mostra a mensagem explícita", () => {
    expect(temDadosDeCampanha(null)).toBe(false);
    expect(temDadosDeCampanha(vazio)).toBe(false);
  });

  it("qualquer UTM presente já é campanha", () => {
    expect(temDadosDeCampanha({ ...vazio, utmSource: "meta" })).toBe(true);
    expect(temDadosDeCampanha({ ...vazio, utmTerm: "andaime" })).toBe(true);
  });

  it("landing_url sozinha NÃO é campanha — só diz onde caiu, não de onde veio", () => {
    expect(temDadosDeCampanha({ ...vazio, landingUrl: "https://exemplo.test/lp" })).toBe(false);
  });
});

describe("CAMPOS_UTM", () => {
  it("são exatamente os 5 que o /api/track aceita", () => {
    expect(CAMPOS_UTM).toEqual([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]);
  });
});
