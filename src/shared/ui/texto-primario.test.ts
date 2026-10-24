import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");

function token(seletor: string, nome: string): string {
  const abre = css.indexOf(`\n${seletor} {`);
  expect(abre, `a regra ${seletor} não abre em nenhuma linha`).toBeGreaterThan(-1);
  const bloco = css.slice(abre, css.indexOf("\n}", abre));
  const achado = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(bloco);
  expect(achado, `--${nome} não está em ${seletor}`).not.toBeNull();
  return achado![1].toLowerCase();
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

describe("azul de texto", () => {
  it("o botão do tema claro segue no Royal exato do manual", () => {
    expect(token(".light", "primary")).toBe("#0074d9");
  });

  it("o Royal como texto reprova no claro: é por isso que o token existe", () => {
    expect(contraste("#0074d9", token(".light", "primary-soft"))).toBeLessThan(4.5);
  });

  it.each(["background", "card", "primary-soft", "accent", "muted"])(
    "no tema claro, texto azul sobre --%s passa AA",
    (fundo) => {
      expect(
        contraste(token(".light", "primary-texto"), token(".light", fundo)),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["background", "card", "primary-soft"])(
    "no tema escuro, texto azul sobre --%s passa AA",
    (fundo) => {
      expect(
        contraste(token(":root", "primary-texto"), token(":root", fundo)),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("a classe sem sufixo não pinta texto", () => {
  const arquivos = (readdirSync("src", { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => [f, readFileSync(join("src", f), "utf8")] as const);

  it("lê o código de verdade (controle positivo)", () => {
    expect(arquivos.length).toBeGreaterThan(100);
    expect(arquivos.some(([, texto]) => texto.includes("text-primary-texto"))).toBe(true);
  });

  it("nenhum componente usa `text-primary` sem sufixo", () => {
    const sem = /(^|[^-\w])text-primary(?![-\w])/;
    expect(arquivos.filter(([, texto]) => sem.test(texto)).map(([f]) => f)).toEqual([]);
  });
});
