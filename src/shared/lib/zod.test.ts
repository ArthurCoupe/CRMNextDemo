import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { z } from "./zod";

describe("zod do app (CSP sem unsafe-eval)", () => {
  it("vem com jitless ligado", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("construir e validar um objeto não executa Function", () => {
    const espiao = vi.spyOn(globalThis, "Function");
    const schema = z.object({ id: z.string().uuid(), n: z.number() });
    expect(schema.safeParse({ id: "8a3f4c2e-1b5d-4e6f-9a7b-0c1d2e3f4a5b", n: 1 }).success).toBe(
      true,
    );
    expect(schema.safeParse({ id: "x", n: 1 }).success).toBe(false);
    expect(espiao).not.toHaveBeenCalled();
    espiao.mockRestore();
  });

  it("zod.ts está em sideEffects do package.json (senão o build descarta o z.config)", () => {
    const pacote = JSON.parse(readFileSync("package.json", "utf8")) as { sideEffects?: unknown };
    expect(pacote.sideEffects).toContain("./src/shared/lib/zod.ts");
  });

  it('ninguém em src/ importa de "zod" fora de zod.ts', () => {
    const saida = execFileSync("git", ["grep", "-l", "-E", "from [\"']zod", "--", "src/"], {
      encoding: "utf8",
    });
    const arquivos = saida
      .trim()
      .split("\n")
      .filter((f) => !/\.test\.tsx?$/.test(f));
    expect(arquivos).toEqual(["src/shared/lib/zod.ts"]);
  });
});
