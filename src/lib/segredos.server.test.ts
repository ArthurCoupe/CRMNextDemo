import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NOMES_DE_SEGREDO, segredo } from "./segredos.server";

afterEach(() => vi.unstubAllEnvs());

describe("segredo()", () => {
  it("le do ambiente; vazio e ausente viram undefined", () => {
    vi.stubEnv("GEMINI_API_KEY", "x");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(segredo("GEMINI_API_KEY")).toBe("x");
    expect(segredo("SUPABASE_SERVICE_ROLE_KEY")).toBeUndefined();
  });

  it("todo nome da lista esta na regra de lint (eslint.config.js)", () => {
    const doLint = new Set(
      /property\.name=\/\^\(([^)]+)\)\$\//
        .exec(readFileSync("eslint.config.js", "utf8"))?.[1]
        ?.split("|") ?? [],
    );
    expect(doLint.size).toBeGreaterThan(0);
    for (const nome of NOMES_DE_SEGREDO)
      expect(doLint.has(nome), `eslint.config.js sem ${nome}`).toBe(true);
  });
});

describe("lint recusa process.env.<SEGREDO> fora de segredos.server.ts", () => {
  const sonda = "src/lib/__sonda_c04_segredo.ts";

  it("arquivo real com process.env.GEMINI_API_KEY -> erro de no-restricted-syntax", () => {
    writeFileSync(sonda, "export const k = process.env.GEMINI_API_KEY;\n", "utf8");
    try {
      let saida = "";
      try {
        saida = execFileSync("bunx", ["eslint", "--format", "json", sonda], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          shell: process.platform === "win32",
        });
      } catch (e) {
        saida = String((e as { stdout?: string }).stdout ?? "");
      }
      const mensagens = (JSON.parse(saida) as { messages: { ruleId: string; message: string }[] }[])
        .flatMap((r) => r.messages)
        .filter((m) => m.ruleId === "no-restricted-syntax");
      expect(mensagens).toHaveLength(1);
      expect(mensagens[0]!.message).toMatch(/segredos\.server/);
    } finally {
      if (existsSync(sonda)) unlinkSync(sonda);
    }
  }, 120_000);
});
