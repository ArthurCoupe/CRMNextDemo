import { describe, expect, it } from "vitest";

import {
  montarLinkDeConversa,
  ordenarScriptsParaOportunidade,
  telefoneDeOutroPais,
  telefoneParaWhatsApp,
  textoDoToque,
  type ScriptSugerivel,
} from "./whatsapp";

describe("telefoneParaWhatsApp", () => {
  it.each([
    ["(11) 99999-9999", "5511999999999"],
    ["11 9999-9999", "551199999999"],
    ["+55 (11) 99999-9999", "5511999999999"],
    ["551199999999", "551199999999"],
    ["(011) 99999-9999", "5511999999999"],
    ["0055 11 99999-9999", "5511999999999"],
    ["(55) 99999-9999", "5555999999999"],
  ])("%s vira %s", (entrada, esperado) => {
    expect(telefoneParaWhatsApp(entrada)).toBe(esperado);
  });

  it.each([
    [null],
    [""],
    ["   "],
    ["9999-9999"],
    ["441199999999"],
    ["4411999999999"],
    ["55119999999999"],
  ])("%j não vira número de WhatsApp", (entrada) => {
    expect(telefoneParaWhatsApp(entrada)).toBeNull();
  });

  it.each([["+51 987 654 321"], ["+1 (415) 555-2671"], ["+34 91 123 4567"], ["0051 987 654 321"]])(
    "%s é estrangeiro com código de país: não vira número",
    (entrada) => {
      expect(telefoneParaWhatsApp(entrada)).toBeNull();
    },
  );

  const LRE = String.fromCharCode(0x202a);
  const PDF = String.fromCharCode(0x202c);
  const LRM = String.fromCharCode(0x200e);
  const NBSP = String.fromCharCode(0x00a0);

  it.each([
    ["(+34) 911 234 567"],
    ["Tel: +51 987 654 321"],
    ["tel:+51987654321"],
    [" +51 987 654 321"],
    [`${NBSP}+51 987 654 321`],
    [`${LRE}+51 987 654 321${PDF}`],
    [`${LRM}+51 987 654 321`],
    [" 0051 987 654 321"],
    ["Tel: 0051 987 654 321"],
    ["(0051) 987 654 321"],
  ])("%j tem o país antes do primeiro dígito: estrangeiro, não vira número", (entrada) => {
    expect(telefoneParaWhatsApp(entrada)).toBeNull();
  });

  it.each([
    ["+55 (11) 99999-9999", "5511999999999"],
    [" +55 11 9999-9999", "551199999999"],
    ["0055 11 99999-9999", "5511999999999"],
    ["(+55) 11 99999-9999", "5511999999999"],
    [`${LRE}+55 11 99999-9999${PDF}`, "5511999999999"],
  ])("controle: %j com código 55 continua virando %s", (entrada, esperado) => {
    expect(telefoneParaWhatsApp(entrada)).toBe(esperado);
  });
});

describe("telefoneDeOutroPais", () => {
  const LRM = String.fromCharCode(0x200e);

  it.each([
    ["+51 987 654 321"],
    ["+1 (415) 555-0100"],
    ["(+34) 911 234 567"],
    ["Tel: +51 987 654 321"],
    [`${LRM}+51 987 654 321`],
    ["0051 987 654 321"],
    ["Tel: 0051 987 654 321"],
  ])("%j tem código de outro país: é de fora e não vira número", (entrada) => {
    expect(telefoneDeOutroPais(entrada)).toBe(true);
    expect(telefoneParaWhatsApp(entrada)).toBeNull();
  });

  it.each([
    ["+55 (11) 99999-9999"],
    ["0055 11 99999-9999"],
    ["+55 11 9999"],
    ["(11) 99999-9999"],
    ["9999-9999"],
    ["+"],
    [""],
    [null],
  ])("controle: %j não é de fora do Brasil", (entrada) => {
    expect(telefoneDeOutroPais(entrada)).toBe(false);
  });
});

describe("montarLinkDeConversa", () => {
  it("põe o texto codificado no parâmetro text", () => {
    expect(montarLinkDeConversa("5511999999999", "Oi, tudo bem?")).toBe(
      "https://wa.me/5511999999999?text=Oi%2C%20tudo%20bem%3F",
    );
  });

  it("acento, &, #, %, quebra de linha e emoji voltam intactos", () => {
    const texto = "Olá & bem-vindo #1 — 100%\nlinha 2 🚀";
    const link = new URL(montarLinkDeConversa("5511999999999", texto));

    expect(link.origin + link.pathname).toBe("https://wa.me/5511999999999");
    expect(link.searchParams.get("text")).toBe(texto);
    expect([...link.searchParams.keys()]).toEqual(["text"]);
  });

  it.each([[""], ["   "], ["\n"]])("texto vazio (%j) abre a conversa sem ?text=", (texto) => {
    expect(montarLinkDeConversa("5511999999999", texto)).toBe("https://wa.me/5511999999999");
  });
});

describe("ordenarScriptsParaOportunidade", () => {
  function script(
    id: string,
    nicho: string,
    pipelineStage: ScriptSugerivel["pipelineStage"],
  ): ScriptSugerivel & { id: string } {
    return { id, nicho, pipelineStage };
  }

  const OPORTUNIDADE = { nicho: "Advocacia", estagio: "qualificacao" as const };

  it("nicho e etapa primeiro, depois um dos dois, depois nenhum; sugerido é ter casado algo", () => {
    const saida = ordenarScriptsParaOportunidade(
      [
        script("nenhum", "odonto", null),
        script("so-etapa", "odonto", "qualificacao"),
        script("so-nicho", "advocacia", "r1"),
        script("os-dois", "advocacia", "qualificacao"),
      ],
      OPORTUNIDADE,
    );

    expect(saida.map((s) => s.script.id)).toEqual(["os-dois", "so-etapa", "so-nicho", "nenhum"]);
    expect(saida.map((s) => s.sugerido)).toEqual([true, true, true, false]);
  });

  it("empate mantém a ordem de entrada (a do banco), sem reordenar por nome", () => {
    const saida = ordenarScriptsParaOportunidade(
      [script("b", "odonto", null), script("a", "odonto", null)],
      OPORTUNIDADE,
    );
    expect(saida.map((s) => s.script.id)).toEqual(["b", "a"]);
  });

  it("nicho casa sem acento, sem caixa e sem espaço nas pontas", () => {
    const [unico] = ordenarScriptsParaOportunidade([script("x", "  ADVOCÁCIA ", null)], {
      nicho: "advocacia",
      estagio: "r1",
    });
    expect(unico?.sugerido).toBe(true);
  });

  it("nicho vazio nunca casa, nem com outro vazio", () => {
    const vazios = ordenarScriptsParaOportunidade(
      [script("x", "", null), script("y", "   ", null)],
      { nicho: null, estagio: "r1" },
    );
    expect(vazios.map((s) => s.sugerido)).toEqual([false, false]);

    const branco = ordenarScriptsParaOportunidade([script("x", "", null)], {
      nicho: "   ",
      estagio: "r1",
    });
    expect(branco[0]?.sugerido).toBe(false);
  });

  it("script de nicho todos casa com qualquer nicho de lead, sem caixa nem espaço", () => {
    const saida = ordenarScriptsParaOportunidade(
      [
        script("nenhum", "odonto", null),
        script("generico", " TODOS ", null),
        script("generico-e-etapa", "todos", "qualificacao"),
        script("so-nicho", "advocacia", "r1"),
      ],
      OPORTUNIDADE,
    );

    expect(saida.map((s) => s.script.id)).toEqual([
      "generico-e-etapa",
      "so-nicho",
      "generico",
      "nenhum",
    ]);
    expect(saida.map((s) => s.sugerido)).toEqual([true, true, true, false]);
  });

  it("no empate, o script do nicho do lead vem antes do genérico, mesmo cadastrado depois", () => {
    const saida = ordenarScriptsParaOportunidade(
      [
        script("abertura", "todos", null),
        script("qualificacao-advocacia", "advocacia", null),
        script("generico-e-etapa", "todos", "qualificacao"),
        script("nicho-e-etapa", "advocacia", "qualificacao"),
      ],
      OPORTUNIDADE,
    );
    expect(saida.map((s) => s.script.id)).toEqual([
      "nicho-e-etapa",
      "generico-e-etapa",
      "qualificacao-advocacia",
      "abertura",
    ]);
    expect(saida.every((s) => s.sugerido)).toBe(true);
  });

  it("todos casa sem acento: Tódos também é genérico", () => {
    const [unico] = ordenarScriptsParaOportunidade([script("x", "Tódos", null)], {
      nicho: null,
      estagio: "r1",
    });
    expect(unico?.sugerido).toBe(true);
  });

  it("script de nicho todos casa também com lead sem nicho; outro nicho não", () => {
    const saida = ordenarScriptsParaOportunidade(
      [script("odonto", "odonto", null), script("generico", "todos", null)],
      { nicho: null, estagio: "r1" },
    );
    expect(saida.map((s) => [s.script.id, s.sugerido])).toEqual([
      ["generico", true],
      ["odonto", false],
    ]);
  });

  it("não mexe na lista recebida", () => {
    const entrada = Object.freeze([
      script("nenhum", "odonto", null),
      script("os-dois", "advocacia", "qualificacao"),
    ]);
    ordenarScriptsParaOportunidade(entrada, OPORTUNIDADE);
    expect(entrada.map((s) => s.id)).toEqual(["nenhum", "os-dois"]);
  });
});

describe("textoDoToque", () => {
  it("com script, grava o título", () => {
    expect(textoDoToque("Qualificação advocacia")).toBe("WhatsApp · Qualificação advocacia");
  });

  it("sem script, diz que foi sem script", () => {
    expect(textoDoToque(null)).toBe("WhatsApp · sem script");
  });
});
