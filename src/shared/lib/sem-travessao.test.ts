import { describe, expect, it } from "vitest";
import { semTravessao } from "./sem-travessao";

const TRAVESSAO = String.fromCharCode(0x2014);
const MEIA_RISCA = String.fromCharCode(0x2013);

describe("semTravessao", () => {
  it("texto sem traço volta idêntico", () => {
    const texto = "Etapa 4: 1º Lote, de 4 a 5 dias. Nota 6-8 (hífen fica).\n- item";
    expect(semTravessao(texto)).toBe(texto);
  });

  it("regra 1: dígito, traço e dígito colados viram intervalo com 'a'", () => {
    expect(semTravessao(`Dia 4${MEIA_RISCA}5`)).toBe("Dia 4 a 5");
    expect(semTravessao(`2020${TRAVESSAO}2021`)).toBe("2020 a 2021");
  });

  it("regra 1, negativo: com espaço entre os números não é intervalo", () => {
    expect(semTravessao(`Etapa 4 ${TRAVESSAO} 1º Lote`)).toBe("Etapa 4, 1º Lote");
    expect(semTravessao(`Etapa 4 ${TRAVESSAO} 1º Lote`)).not.toContain(" a ");
  });

  it("regra 3: ' (traço) e ' vira ', e '", () => {
    expect(semTravessao(`É uma esteira ${TRAVESSAO} e é ela que puxa.`)).toBe(
      "É uma esteira, e é ela que puxa.",
    );
  });

  it("regra 3, negativo: 'e' colado na palavra seguinte não é a conjunção", () => {
    expect(semTravessao(`fluxo ${TRAVESSAO} estoque`)).toBe("fluxo, estoque");
  });

  it("regra 4: traço com espaço dos dois lados vira vírgula", () => {
    expect(semTravessao(`Recarregue ${TRAVESSAO} o board mudou`)).toBe("Recarregue, o board mudou");
    expect(semTravessao(`a ${MEIA_RISCA} b`)).toBe("a, b");
  });

  it("regra 4, negativo: traço sem espaço de um dos lados não vira vírgula", () => {
    expect(semTravessao(`fim ${TRAVESSAO}`)).toBe("fim -");
  });

  it("regra 5: o traço que sobra vira hífen", () => {
    expect(semTravessao(TRAVESSAO)).toBe("-");
    expect(semTravessao(`${TRAVESSAO} item`)).toBe("- item");
    expect(semTravessao(`palavra${MEIA_RISCA}palavra`)).toBe("palavra-palavra");
  });

  it("nenhum dos dois caracteres sobrevive", () => {
    const sujo = `A ${TRAVESSAO} B ${MEIA_RISCA} e C, 1${TRAVESSAO}2, x${MEIA_RISCA}y ${TRAVESSAO}`;
    const limpo = semTravessao(sujo);
    expect(limpo).not.toContain(TRAVESSAO);
    expect(limpo).not.toContain(MEIA_RISCA);
  });

  it("regra 2: traço que é o valor inteiro vira hífen, não vírgula (célula sem valor)", () => {
    expect(semTravessao(`| Cliente | ${TRAVESSAO} |`)).toBe("| Cliente | - |");
    expect(semTravessao(`MRR: ${TRAVESSAO} · TCV: R$ 10`)).toBe("MRR: - · TCV: R$ 10");
    expect(semTravessao(`Responsável: ${TRAVESSAO}\nPrazo: hoje`)).toBe(
      "Responsável: -\nPrazo: hoje",
    );
    expect(semTravessao(`Responsável: ${TRAVESSAO}  \nPrazo: hoje`)).toBe(
      "Responsável: -  \nPrazo: hoje",
    );
  });

  it("regra 2, negativo: traço no meio da frase segue a regra da vírgula", () => {
    expect(semTravessao(`a ${TRAVESSAO} b`)).toBe("a, b");
    expect(semTravessao(`MRR ${TRAVESSAO} TCV`)).toBe("MRR, TCV");
  });

  it("corrida de 100 mil espaços termina rápido e o traço vira hífen", () => {
    const espacos = " ".repeat(100_000);
    const inicio = performance.now();
    const limpo = semTravessao(`a${espacos}${TRAVESSAO}b`);
    const ms = performance.now() - inicio;

    expect(limpo).toBe(`a${espacos}-b`);
    expect(ms).toBeLessThan(1000);
  });

  it("corrida longa de espaços com traço entre espaços ainda vira vírgula", () => {
    expect(semTravessao(`a${" ".repeat(1000)}${TRAVESSAO} b`)).toBe("a, b");
  });
});
