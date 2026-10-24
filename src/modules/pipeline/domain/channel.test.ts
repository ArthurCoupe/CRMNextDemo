import { describe, expect, it } from "vitest";

import { Constants } from "@/shared/types/database.types";

import {
  CANAIS,
  ehCanalDeVerdade,
  rotuloDaChaveDeCanal,
  rotuloDoCanal,
  SEM_ATRIBUICAO,
  teseDoCanal,
  type Canal,
} from "./channel";

const DO_BANCO = Constants.public.Enums.acquisition_channel;

describe("a lista acompanha o enum do banco", () => {
  it("CANAIS tem exatamente os canais do enum", () => {
    expect([...CANAIS].sort()).toEqual([...DO_BANCO].sort());
  });

  it("todo canal do banco tem rótulo e tese", () => {
    DO_BANCO.forEach((canal) => {
      expect(rotuloDoCanal(canal as Canal), canal).toBeTruthy();
      expect(teseDoCanal(canal as Canal), canal).toBeTruthy();
    });
  });

  it("a tese não é o rótulo repetido — ela explica o canal", () => {
    DO_BANCO.forEach((canal) => {
      expect(teseDoCanal(canal as Canal).length, canal).toBeGreaterThan(30);
    });
  });
});

describe("sem atribuição não é um canal", () => {
  it("`sem_atribuicao` tem rótulo próprio e não é canal de verdade", () => {
    expect(rotuloDaChaveDeCanal(SEM_ATRIBUICAO)).toBe("Sem atribuição");
    expect(ehCanalDeVerdade(SEM_ATRIBUICAO)).toBe(false);
  });

  it("não está em CANAIS — quem monta formulário não o oferece", () => {
    expect(CANAIS).not.toContain(SEM_ATRIBUICAO);
  });

  it("nunca vira `outbound` nem nenhum canal real", () => {
    expect(rotuloDaChaveDeCanal(SEM_ATRIBUICAO)).not.toBe(rotuloDoCanal("outbound"));
    DO_BANCO.forEach((canal) => {
      expect(rotuloDaChaveDeCanal(SEM_ATRIBUICAO)).not.toBe(rotuloDoCanal(canal as Canal));
    });
  });
});

describe("rotuloDaChaveDeCanal", () => {
  it("traduz as chaves conhecidas", () => {
    expect(rotuloDaChaveDeCanal("pago")).toBe("Tráfego pago");
    expect(rotuloDaChaveDeCanal("indicacao")).toBe("Indicação");
  });

  it("chave desconhecida aparece crua, não vira balde genérico", () => {
    expect(rotuloDaChaveDeCanal("parceria_2027")).toBe("parceria_2027");
    expect(ehCanalDeVerdade("parceria_2027")).toBe(false);
  });

  it("chave do protótipo de Object não é canal", () => {
    expect(ehCanalDeVerdade("toString")).toBe(false);
    expect(rotuloDaChaveDeCanal("toString")).toBe("toString");
  });
});
