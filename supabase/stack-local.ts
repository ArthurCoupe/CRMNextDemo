import { execSync } from "node:child_process";

export const VERSAO_DA_CLI = "2.119.0";

export const AMBIENTE_DA_CLI =
  /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|TEMP|TMP|TMPDIR|USER|USERNAME|LANG|LC_ALL|XDG_[A-Z_]+|DOCKER_(HOST|CONFIG|CONTEXT|CERT_PATH|TLS_VERIFY)|HTTPS?_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|NODE_USE_SYSTEM_CA|NPM_CONFIG_(CACHE|REGISTRY))$/i;

export const CHAVE_PUBLICAVEL = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export const URL_DEMO = "http://127.0.0.1:54721";

export function chaveDeServicoLocal(url = URL_DEMO, workdir = ".demo"): string | undefined {
  try {
    const saida = execSync(
      `npx --yes supabase@${VERSAO_DA_CLI} status -o env --workdir ${workdir}`,
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 60_000,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([nome]) => AMBIENTE_DA_CLI.test(nome)),
          ),
          DO_NOT_TRACK: "1",
          SUPABASE_TELEMETRY_DISABLED: "1",
        },
      },
    );
    const valor = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\\r\\n]*)"?`, "m"))?.[1];
    if (valor("API_URL") !== url) return undefined;
    return valor("SECRET_KEY") || undefined;
  } catch (erro) {
    const e = erro as { status?: unknown; code?: unknown; signal?: unknown } | null;
    const causa = [e?.code, e?.signal].filter((c) => typeof c === "string" && /^[A-Z_]+$/.test(c));
    console.warn(
      `[stack-local] supabase status falhou (exit ${String(e?.status ?? "?")}${causa.map((c) => ` ${String(c)}`).join("")})`,
    );
    return undefined;
  }
}

export function nomesDoEnvExample(texto: string): string[] {
  return [...texto.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
}

export function recusarModoDemoFora(
  mode: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (mode !== "demo" && env.VITE_CRM_DEMO)
    throw new Error("VITE_CRM_DEMO só vale no --mode demo: tire a variável");
}

export function aplicarStackDemo(
  nomes: readonly string[],
  env: Record<string, string | undefined> = process.env,
  chaveLocal: () => string | undefined = () => chaveDeServicoLocal(),
) {
  for (const nome of nomes) env[nome] = "";
  Object.assign(env, {
    VITE_SUPABASE_URL: URL_DEMO,
    VITE_SUPABASE_PUBLISHABLE_KEY: CHAVE_PUBLICAVEL,
    VITE_SUPABASE_PROJECT_ID: "crm-demo",
    SUPABASE_URL: URL_DEMO,
    SUPABASE_PUBLISHABLE_KEY: CHAVE_PUBLICAVEL,
    VITE_CRM_DEMO: "1",
  });
  const chave = chaveLocal();
  if (chave) env.SUPABASE_SERVICE_ROLE_KEY = chave;
}
