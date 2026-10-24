import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { NOMES_DE_SEGREDO } from "../src/lib/segredos.server";
import {
  aplicarStackDemo,
  chaveDeServicoLocal,
  nomesDoEnvExample,
  recusarModoDemoFora,
  URL_DEMO,
  VERSAO_DA_CLI,
} from "./stack-local";

vi.mock("node:child_process", () => {
  const execSync = vi.fn();
  return { execSync, default: { execSync } };
});
const status = vi.mocked(execSync);

const saida = (apiUrl: string, fim = "\n") =>
  `API_URL="${apiUrl}"${fim}ANON_KEY="publica"${fim}SECRET_KEY="chave-local-de-teste"${fim}`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("chaveDeServicoLocal", () => {
  it("devolve a SECRET_KEY quando o status é da stack da demo, pela CLI de versão fixa", () => {
    status.mockReturnValueOnce(saida(URL_DEMO));
    expect(chaveDeServicoLocal()).toBe("chave-local-de-teste");
    expect(status).toHaveBeenCalledWith(
      `npx --yes supabase@${VERSAO_DA_CLI} status -o env --workdir .demo`,
      expect.objectContaining({ stdio: ["ignore", "pipe", "ignore"] }),
    );
  });

  it("a CLI recebe só o ambiente da lista de permissão, nenhuma credencial com qualquer nome", () => {
    const credenciais = [
      "SUPABASE_SERVICE_ROLE_KEY",
      "GEMINI_API_KEY",
      "NPM_TOKEN",
      "PGPASSWORD",
      "SUPABASE_DB_URL",
      "DOCKER_AUTH_CONFIG",
      "SUPABASE_URL",
    ];
    for (const nome of credenciais) vi.stubEnv(nome, "x");
    const permitidas = ["DOCKER_HOST", "NODE_USE_SYSTEM_CA"];
    for (const nome of permitidas) vi.stubEnv(nome, "1");
    status.mockReturnValueOnce(saida(URL_DEMO));
    chaveDeServicoLocal();
    const nomes = Object.keys(status.mock.calls.at(-1)?.[1]?.env ?? {});
    for (const nome of credenciais) expect(nomes).not.toContain(nome);
    for (const nome of permitidas) expect(nomes).toContain(nome);
    expect(nomes.some((n) => n.toUpperCase() === "PATH")).toBe(true);
  });

  it("a CLI roda com telemetria desligada, mesmo que o shell diga o contrário", () => {
    vi.stubEnv("DO_NOT_TRACK", "0");
    status.mockReturnValueOnce(saida(URL_DEMO));
    chaveDeServicoLocal();
    const env = status.mock.calls.at(-1)?.[1]?.env ?? {};
    expect(env.DO_NOT_TRACK).toBe("1");
    expect(env.SUPABASE_TELEMETRY_DISABLED).toBe("1");
  });

  it("outra stack no ar (outra API_URL): não devolve a chave dela", () => {
    status.mockReturnValueOnce(saida("http://127.0.0.1:54321"));
    expect(chaveDeServicoLocal()).toBeUndefined();
  });

  it("saída com CRLF (Windows) não deixa \\r na chave", () => {
    status.mockReturnValueOnce(saida(URL_DEMO, "\r\n"));
    expect(chaveDeServicoLocal()).toBe("chave-local-de-teste");
  });

  it("sem a CLI ou sem a stack: undefined, sem lançar, e o aviso leva só o código de saída", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    status.mockImplementationOnce(() => {
      throw Object.assign(new Error("SECRET_KEY=sb_secret_vazou"), {
        status: 1,
        stdout: "SECRET_KEY=x",
      });
    });
    expect(chaveDeServicoLocal()).toBeUndefined();
    expect(aviso).toHaveBeenCalledWith("[stack-local] supabase status falhou (exit 1)");
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("SECRET_KEY");
    aviso.mockRestore();
  });

  it("os scripts do package.json chamam a mesma versão da CLI", () => {
    const { scripts } = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const comCli = Object.values(scripts).filter((s) => /\bsupabase@/.test(s));
    for (const s of comCli) expect(s).toContain(`supabase@${VERSAO_DA_CLI}`);
  });
});

describe("aplicarStackDemo (--mode demo)", () => {
  const nomes = nomesDoEnvExample(readFileSync(resolve(__dirname, "../.env.example"), "utf8"));
  const doShell = () => Object.fromEntries(nomes.map((n) => [n, `shell-${n}`]));

  it("o .env.example lista todo segredo que o servidor lê", () => {
    for (const nome of NOMES_DE_SEGREDO) expect(nomes, nome).toContain(nome);
    expect(nomes).toContain("VITE_HCAPTCHA_SITE_KEY");
  });

  it("nenhum valor exportado no shell sobra na demo, chave de serviço inclusive", () => {
    const env: Record<string, string | undefined> = doShell();
    aplicarStackDemo(nomes, env, () => undefined);
    const sobrou = Object.entries(env).filter(([, v]) => v?.startsWith("shell-"));
    expect(sobrou).toEqual([]);
    for (const nome of NOMES_DE_SEGREDO) expect(env[nome], nome).toBe("");
  });

  it("aponta para a stack da demo e liga o modo demo", () => {
    const env: Record<string, string | undefined> = doShell();
    aplicarStackDemo(nomes, env, () => "chave-da-demo");
    expect(env.VITE_SUPABASE_URL).toBe(URL_DEMO);
    expect(env.SUPABASE_URL).toBe(URL_DEMO);
    expect(env.VITE_CRM_DEMO).toBe("1");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("chave-da-demo");
  });

  it("VITE_CRM_DEMO fora do --mode demo derruba o build", () => {
    for (const mode of ["production", "development"])
      expect(() => recusarModoDemoFora(mode, { VITE_CRM_DEMO: "1" }), mode).toThrow(
        /VITE_CRM_DEMO/,
      );
    expect(() => recusarModoDemoFora("production", { VITE_CRM_DEMO: "" })).not.toThrow();
    expect(() => recusarModoDemoFora("demo", { VITE_CRM_DEMO: "1" })).not.toThrow();
  });

  it("nomesDoEnvExample: só a linha NOME=, não comentário nem texto", () => {
    expect(nomesDoEnvExample("# GEMINI_API_KEY=x\nA_B=1\n  C=2\nD_1=\nminuscula=3")).toEqual([
      "A_B",
      "D_1",
    ]);
  });
});
