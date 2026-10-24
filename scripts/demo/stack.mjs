#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { AMBIENTE_DA_CLI, VERSAO_DA_CLI } from "../../supabase/stack-local.ts";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const ORIGEM = join(RAIZ, "supabase");
const DESTINO = join(RAIZ, ".demo", "supabase");

const TROCAS = [
  [/^project_id = "crm-local"$/m, 'project_id = "crm-demo"', 1],
  [/^((?:shadow_)?port = )544(\d\d)$/gm, "$1547$2", 6],
];

export function ambienteDaCli(env = process.env) {
  return {
    ...Object.fromEntries(Object.entries(env).filter(([nome]) => AMBIENTE_DA_CLI.test(nome))),
    DO_NOT_TRACK: "1",
    SUPABASE_TELEMETRY_DISABLED: "1",
  };
}

export function configDaDemo(texto) {
  let saida = texto;
  for (const [de, para, esperado] of TROCAS) {
    const casou = saida.match(de)?.length ?? 0;
    if (casou !== esperado)
      throw new Error(`config.toml da demo: ${de} casou ${casou} vez(es), esperado ${esperado}`);
    saida = saida.replace(de, para);
  }
  if (/\b544\d\d\b/.test(saida.replace(/^\s*#.*$/gm, "")))
    throw new Error("config.toml da demo: sobrou porta 544xx fora de comentario");
  return saida;
}

export function preparar(destino = DESTINO, { trava = false, agora = new Date() } = {}) {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  let config = configDaDemo(readFileSync(join(ORIGEM, "config.toml"), "utf8"));
  cpSync(join(ORIGEM, "migrations"), join(destino, "migrations"), { recursive: true });
  cpSync(join(ORIGEM, "demo", "seed.sql"), join(destino, "seed.sql"));
  if (trava) {
    if (/^\[db\.seed\]/m.test(config)) throw new Error("config.toml ja tem [db.seed]");
    const nome = `trava-${agora.toISOString().replace(/\D/g, "").slice(0, 14)}.sql`;
    cpSync(join(ORIGEM, "demo", "trava.sql"), join(destino, nome));
    config += `\n[db.seed]\nenabled = true\nsql_paths = ["./seed.sql", "./${nome}"]\n`;
  }
  writeFileSync(join(destino, "config.toml"), config);
}

function travar() {
  const r = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_crm-demo",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    {
      input: readFileSync(join(ORIGEM, "demo", "trava.sql")),
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  return r.status ?? 1;
}

const rodandoComoScript = process.argv[1] === fileURLToPath(import.meta.url);

if (rodandoComoScript && process.argv[2] === "travar") {
  process.exitCode = travar();
} else if (rodandoComoScript) {
  preparar();
  const r = spawnSync(
    "npx",
    ["--yes", `supabase@${VERSAO_DA_CLI}`, ...process.argv.slice(2), "--workdir", ".demo"],
    {
      cwd: RAIZ,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: ambienteDaCli(),
    },
  );
  process.exitCode = r.status ?? 1;
}
