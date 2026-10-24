import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { URL_DO_APP } from "@/shared/lib/app-url";
import { Route } from "./__root";

const meta = (await Route.options.head!({} as never)).meta ?? [];

function conteudoDe(chave: string): string | undefined {
  const tag = meta.find((m) => m?.name === chave || m?.property === chave);
  return typeof tag?.content === "string" ? tag.content : undefined;
}

describe("meta tags da raiz", () => {
  it("identifica a Next Business como autora", () => {
    expect(conteudoDe("author")).toBe("Next Business");
  });

  it("dá título e descrição em português, sobre o produto", () => {
    expect(meta.find((m) => typeof m?.title === "string")?.title).toBe("Next CRM");

    const titulo = conteudoDe("og:title");
    expect(titulo).toBe("Next CRM · Next Business");
    expect(conteudoDe("twitter:title")).toBe(titulo);

    const descricao = conteudoDe("description");
    expect(descricao).toContain("CRM interno da Next Business");
    expect(conteudoDe("og:description")).toBe(descricao);
    expect(conteudoDe("twitter:description")).toBe(descricao);
  });

  it("declara o charSet utf-8 no array de meta", () => {
    expect(meta.find((m) => typeof m?.charSet === "string")?.charSet).toBe("utf-8");
  });

  it("serve a imagem do cartão do próprio domínio, por URL absoluta", () => {
    const imagem = conteudoDe("og:image");
    expect(imagem).toBe(`${URL_DO_APP}/logo.png`);
    expect(new URL(imagem!).href).toBe(imagem);
    expect(conteudoDe("twitter:image")).toBe(imagem);
  });

  it("aponta para um arquivo que existe em public/", () => {
    const caminho = new URL(conteudoDe("og:image")!).pathname;
    const publico = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");
    expect(existsSync(resolve(publico, `.${caminho}`))).toBe(true);
  });

  it("não declara twitter:site, porque a Next não tem @handle", () => {
    expect(conteudoDe("twitter:site")).toBeUndefined();
    expect(conteudoDe("twitter:card")).toBe("summary");
  });
});
