// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ambienteDaCli, configDaDemo, preparar } from "./stack.mjs";

const CONFIG = readFileSync(resolve(__dirname, "../../supabase/config.toml"), "utf8");

describe("ambienteDaCli", () => {
  it("🔴 a CLI não recebe credencial do shell, com qualquer nome", () => {
    const env = ambienteDaCli({
      PATH: "/bin",
      USERPROFILE: "C:/Users/x",
      SUPABASE_SERVICE_ROLE_KEY: "s",
      RESEND_API_KEY: "r",
      SUPABASE_ACCESS_TOKEN: "t",
      SUPABASE_DB_PASSWORD: "p",
      DO_NOT_TRACK: "0",
    });
    expect(env).toEqual({
      PATH: "/bin",
      USERPROFILE: "C:/Users/x",
      DO_NOT_TRACK: "1",
      SUPABASE_TELEMETRY_DISABLED: "1",
    });
  });
});

describe("preparar", () => {
  const TRAVA = readFileSync(resolve(__dirname, "../../supabase/demo/trava.sql"), "utf8");
  const SEED = readFileSync(resolve(__dirname, "../../supabase/demo/seed.sql"), "utf8");
  const pasta = () => join(mkdtempSync(join(tmpdir(), "crm-demo-")), "supabase");
  const seeds = (destino: string) =>
    readFileSync(join(destino, "config.toml"), "utf8").match(/^sql_paths = (.*)$/m)?.[1];

  it("🔴 demo pública: a trava roda depois do seed, num arquivo de nome novo a cada chamada", () => {
    const destino = pasta();
    preparar(destino, { trava: true, agora: new Date("2026-10-24T03:04:05Z") });
    expect(seeds(destino)).toBe('["./seed.sql", "./trava-20261024030405.sql"]');
    expect(readFileSync(join(destino, "trava-20261024030405.sql"), "utf8")).toBe(TRAVA);
    expect(readFileSync(join(destino, "seed.sql"), "utf8")).toBe(SEED);
    preparar(destino, { trava: true, agora: new Date("2026-10-24T03:04:06Z") });
    expect(seeds(destino)).toBe('["./seed.sql", "./trava-20261024030406.sql"]');
    expect(readdirSync(destino).filter((f) => f.startsWith("trava-"))).toEqual([
      "trava-20261024030406.sql",
    ]);
  });

  it("controle: a stack local da demo fica só com o seed, sem trava", () => {
    const destino = pasta();
    preparar(destino);
    expect(seeds(destino)).toBeUndefined();
    expect(readdirSync(destino).filter((f) => f.endsWith(".sql"))).toEqual(["seed.sql"]);
    expect(readFileSync(join(destino, "seed.sql"), "utf8")).toBe(SEED);
  });
});

describe("configDaDemo", () => {
  it("🔴 a demo sobe com outro project_id e só em portas 547xx", () => {
    const demo = configDaDemo(CONFIG);
    expect(demo).toMatch(/^project_id = "crm-demo"$/m);
    expect(demo.replace(/^\s*#.*$/gm, "")).not.toMatch(/crm-local/);
    const portas = [...demo.matchAll(/^\s*(?:shadow_)?port = (\d+)$/gm)].map((m) => m[1]);
    expect(portas.length).toBeGreaterThan(0);
    for (const p of portas) expect(p, p).toMatch(/^547\d\d$/);
  });

  it("controle: o resto do config.toml fica igual", () => {
    const tirarPortasEId = (t: string) =>
      t.replace(/^project_id = .*$/m, "").replace(/^(\s*(?:shadow_)?port = )\d+$/gm, "$1");
    expect(tirarPortasEId(configDaDemo(CONFIG))).toBe(tirarPortasEId(CONFIG));
  });

  it("🔴 config.toml que mudou de forma derruba o script em vez de subir na porta de dev", () => {
    expect(() =>
      configDaDemo(CONFIG.replace(/^project_id = .*$/m, 'project_id = "outro"')),
    ).toThrow(/project_id/);
    expect(() => configDaDemo(`${CONFIG}\n[novo]\nport = 54499\n`)).toThrow(/casou 7/);
    expect(() => configDaDemo(`${CONFIG}\n[novo]\nurl = "http://127.0.0.1:54498"\n`)).toThrow(
      /sobrou porta 544xx/,
    );
  });
});
