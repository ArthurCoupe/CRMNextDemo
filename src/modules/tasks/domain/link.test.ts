import { describe, expect, it } from "vitest";

import { hostDoLink, validarLink } from "./link";

const URL_ERRADA = "O link precisa começar com https:// e ter até 2.000 caracteres.";

describe("validarLink — o mesmo teto e o mesmo https:// dos CHECKs do banco", () => {
  it("devolve rótulo e URL sem espaço nas pontas", () => {
    expect(validarLink("  Briefing ", " https://docs.google.com/x  ")).toEqual({
      ok: true,
      link: { rotulo: "Briefing", url: "https://docs.google.com/x" },
    });
  });

  it.each([[""], ["   "]])("rótulo %j recusa", (rotulo) => {
    expect(validarLink(rotulo, "https://a.com")).toEqual({
      ok: false,
      erro: "Dê um nome ao link.",
    });
  });

  it("rótulo com 80 caracteres passa e com 81 recusa", () => {
    expect(validarLink("a".repeat(80), "https://a.com").ok).toBe(true);
    expect(validarLink("a".repeat(81), "https://a.com")).toEqual({
      ok: false,
      erro: "O nome do link pode ter até 80 caracteres.",
    });
  });

  it("conta caractere como o char_length do banco: 80 emojis passam", () => {
    expect(validarLink("😀".repeat(80), "https://a.com").ok).toBe(true);
  });

  it.each([
    ["http://", "http://a.com"],
    ["javascript:", "javascript:alert(1)"],
    ["espaço no meio", "https://a.com/a b"],
    ["só o esquema", "https://"],
    ["vazia", ""],
  ])("URL %s recusa", (_caso, url) => {
    expect(validarLink("Site", url)).toEqual({ ok: false, erro: URL_ERRADA });
  });

  it("URL com 2000 caracteres passa e com 2001 recusa", () => {
    expect(validarLink("Site", "https://" + "a".repeat(1992)).ok).toBe(true);
    expect(validarLink("Site", "https://" + "a".repeat(1993))).toEqual({
      ok: false,
      erro: URL_ERRADA,
    });
  });
});

describe("hostDoLink — o domínio que a tela mostra ao lado do rótulo", () => {
  it.each([
    ["https comum", "https://docs.google.com/document/d/1", "docs.google.com"],
    [
      "subdomínio que imita",
      "https://drive.google.com.evil.example/x",
      "drive.google.com.evil.example",
    ],
    ["usuário antes do @", "https://drive.google.com@evil.example/", "evil.example"],
  ])("%s mostra o host de verdade", (_caso, url, host) => {
    expect(hostDoLink(url)).toBe(host);
  });

  it("texto que não é URL devolve null", () => {
    expect(hostDoLink("não é link")).toBeNull();
  });
});
