import { describe, expect, it } from "vitest";

import { criarLimite, excedeuOLimite } from "./rate-limit";

const MINUTO = 60_000;

describe("criarLimite", () => {
  it("deixa passar até o teto e barra o excedente", () => {
    const limite = criarLimite(MINUTO, 3);
    expect(limite.permitir("ana", 0)).toBe(true);
    expect(limite.permitir("ana", 1)).toBe(true);
    expect(limite.permitir("ana", 2)).toBe(true);
    expect(limite.permitir("ana", 3)).toBe(false);
  });

  it("🔴 a janela ROLA: passado o tempo, o balde zera", () => {
    const limite = criarLimite(MINUTO, 2);
    expect(limite.permitir("ana", 0)).toBe(true);
    expect(limite.permitir("ana", 10)).toBe(true);
    expect(limite.permitir("ana", 20)).toBe(false);
    expect(limite.permitir("ana", MINUTO)).toBe(true);
  });

  it("🔴 baldes são por chave — um usuário não gasta a cota do outro", () => {
    const limite = criarLimite(MINUTO, 1);
    expect(limite.permitir("ana", 0)).toBe(true);
    expect(limite.permitir("ana", 1)).toBe(false);
    expect(limite.permitir("bruno", 1)).toBe(true);
  });

  it("🔴 baldes são por INSTÂNCIA — o upload não gasta a cota da IA", () => {
    const upload = criarLimite(MINUTO, 1);
    const ia = criarLimite(MINUTO, 1);
    expect(upload.permitir("ana", 0)).toBe(true);
    expect(upload.permitir("ana", 1)).toBe(false);
    expect(ia.permitir("ana", 1)).toBe(true);
  });

  it("🔴 o mapa tem teto — chave forjada em volume não vira vazamento", () => {
    const limite = criarLimite(MINUTO, 1);
    for (let i = 0; i <= 10_000; i += 1) limite.permitir(`chave-${i}`, 0);
    expect(limite.permitir("chave-0", 1)).toBe(true);
  });

  it("esquecer() zera tudo", () => {
    const limite = criarLimite(MINUTO, 1);
    expect(limite.permitir("ana", 0)).toBe(true);
    expect(limite.permitir("ana", 1)).toBe(false);
    limite.esquecer();
    expect(limite.permitir("ana", 2)).toBe(true);
  });
});

describe("excedeuOLimite", () => {
  it("🔴 não conta o teto para quem estourou", () => {
    const erro = excedeuOLimite("envio de arquivo");
    expect(erro.message).toContain("envio de arquivo");
    expect(erro.message).not.toMatch(/\d+\s*(por|\/)/);
  });
});
