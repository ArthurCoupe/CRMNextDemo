import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import {
  CAMINHO_DO_RELATORIO,
  gerarNonce,
  HASH_DE_STYLE_VAZIO,
  HASH_DO_CSS_DO_SONNER,
  HEADER_DA_CSP,
  montarCsp,
  publicarNonceDaPagina,
} from "./csp";

describe("C34 · montarCsp", () => {
  const nonce = gerarNonce();
  const csp = montarCsp(nonce, "https://abc.supabase.co");
  const diretivas = Object.fromEntries(
    csp.split("; ").map((d) => {
      const [nome, ...resto] = d.split(" ");
      return [nome, resto.join(" ")];
    }),
  );

  it("nonce tem 128 bits em base64 e muda a cada chamada", () => {
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(gerarNonce()).not.toBe(nonce);
  });

  it("script-src usa o nonce e NAO tem 'unsafe-inline' nem 'unsafe-eval'", () => {
    expect(diretivas["script-src"]).toContain(`'nonce-${nonce}'`);
    expect(diretivas["script-src"]).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("connect-src tem o Supabase por https e wss; default-src e 'self'", () => {
    expect(diretivas["connect-src"]).toContain("https://abc.supabase.co");
    expect(diretivas["connect-src"]).toContain("wss://abc.supabase.co");
    expect(diretivas["default-src"]).toBe("'self'");
  });

  it("object-src 'none', base-uri 'self', frame-ancestors 'none', form-action 'self', report-uri", () => {
    expect(diretivas["object-src"]).toBe("'none'");
    expect(diretivas["base-uri"]).toBe("'self'");
    expect(diretivas["frame-ancestors"]).toBe("'none'");
    expect(diretivas["form-action"]).toBe("'self'");
    expect(diretivas["report-uri"]).toBe(CAMINHO_DO_RELATORIO);
  });

  it("Checkpoint C: enforce (o header que bloqueia, nao o que so reporta)", () => {
    expect(HEADER_DA_CSP).toBe("Content-Security-Policy");
  });

  it("sem SUPABASE_URL a policy sai sem a origem do Supabase (em enforce, o navegador recusa o banco; start.ts avisa no log)", () => {
    const semSupa = montarCsp(nonce, undefined);
    expect(semSupa).not.toContain("supabase.co");
    expect(semSupa).toContain("connect-src 'self'");
  });
});

describe("C34 · estilo sem 'unsafe-inline' em <style> (divida 6)", () => {
  const nonce = gerarNonce();
  const diretivas = Object.fromEntries(
    montarCsp(nonce, undefined)
      .split("; ")
      .map((d) => {
        const [nome, ...resto] = d.split(" ");
        return [nome, resto.join(" ")];
      }),
  );

  it("🔴 style-src e style-src-elem NAO tem 'unsafe-inline'; <style> so com nonce ou o hash do sonner", () => {
    expect(diretivas["style-src"]).not.toContain("unsafe-inline");
    expect(diretivas["style-src-elem"]).not.toContain("unsafe-inline");
    expect(diretivas["style-src-elem"]).toContain(`'nonce-${nonce}'`);
    expect(diretivas["style-src-elem"]).toContain(`'${HASH_DO_CSS_DO_SONNER}'`);
    expect(diretivas["style-src-elem"]).toContain(`'${HASH_DE_STYLE_VAZIO}'`);
  });

  it("controle: style= em atributo segue permitido (Radix e Recharts), so em style-src-attr", () => {
    expect(diretivas["style-src-attr"]).toBe("'unsafe-inline'");
  });

  it("🔴 o hash bate com o CSS do sonner INSTALADO (atualizar o sonner sem atualizar o hash falha aqui)", () => {
    const fonte = readFileSync("node_modules/sonner/dist/index.mjs", "utf8");
    const chamadas = [...fonte.matchAll(/__insertCSS\("((?:[^"\\]|\\.)*)"\)/g)];
    expect(chamadas).toHaveLength(1);
    const css = JSON.parse(`"${chamadas[0]![1]}"`) as string;
    const hash = `sha256-${createHash("sha256").update(css, "utf8").digest("base64")}`;
    expect(hash).toBe(HASH_DO_CSS_DO_SONNER);
  });

  it("o hash de <style> vazio e mesmo o da string vazia (e nada alem dela)", () => {
    expect(HASH_DE_STYLE_VAZIO).toBe(
      `sha256-${createHash("sha256").update("", "utf8").digest("base64")}`,
    );
  });
});

describe("C34 · publicarNonceDaPagina (cliente)", () => {
  const global = globalThis as { __webpack_nonce__?: string };

  afterEach(() => {
    delete global.__webpack_nonce__;
    document.head.innerHTML = "";
  });

  it("🔴 le o nonce do <script> do SSR e o publica para os <style> do Radix e do Select", () => {
    const script = document.createElement("script");
    script.setAttribute("nonce", "nonce-da-pagina");
    document.head.appendChild(script);

    expect(publicarNonceDaPagina(document)).toBe("nonce-da-pagina");
    expect(global.__webpack_nonce__).toBe("nonce-da-pagina");
  });

  it("controle: pagina sem <script nonce> nao publica nada", () => {
    document.head.appendChild(document.createElement("script"));

    expect(publicarNonceDaPagina(document)).toBeUndefined();
    expect(global.__webpack_nonce__).toBeUndefined();
  });
});
