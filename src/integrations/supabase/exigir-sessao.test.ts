import { describe, expect, it } from "vitest";

import { baldeDaFuncao, chaveDaFuncao, ehFuncaoPublica, FUNCOES_PUBLICAS } from "./exigir-sessao";

describe("C17 · chaveDaFuncao normaliza o que o compilador entrega", () => {
  it("dev: caminho absoluto com ?tss-serverfn-split e sufixo _createServerFn_handler", () => {
    expect(
      chaveDaFuncao({
        filename: "/src/shared/ui/tema.ts?tss-serverfn-split",
        name: "lerTemaNoServidor_createServerFn_handler",
      }),
    ).toBe("src/shared/ui/tema.ts#lerTemaNoServidor");
  });

  it("build: caminho do projeto no Windows", () => {
    expect(
      chaveDaFuncao({
        filename: "C:\\Users\\x\\crm\\src\\lib\\ai.functions.ts",
        name: "aiAnalyze",
      }),
    ).toBe("src/lib/ai.functions.ts#aiAnalyze");
  });

  it("sem meta: chave impossivel, nunca publica", () => {
    expect(chaveDaFuncao(undefined)).toBe("?#?");
    expect(ehFuncaoPublica(undefined)).toBe(false);
  });
});

describe("C17 · allowlist", () => {
  it("sao exatamente as 4 que so leem cookie proprio", () => {
    expect([...FUNCOES_PUBLICAS].sort()).toEqual([
      "src/integrations/supabase/papel.ts#obterPapelNoServidor",
      "src/integrations/supabase/sessao.ts#obterSessaoNoServidor",
      "src/shared/ui/sidebar-estado.ts#lerNoServidor",
      "src/shared/ui/tema.ts#lerTemaNoServidor",
    ]);
  });

  it("as 3 de IA sao privadas; funcao nova desconhecida e privada", () => {
    for (const nome of ["aiAnalyze", "listarConversas", "carregarConversa", "exportarTudo"]) {
      expect(ehFuncaoPublica({ filename: "src/lib/ai.functions.ts", name: nome })).toBe(false);
    }
  });

  it("nome parecido em arquivo diferente NAO e publico", () => {
    expect(ehFuncaoPublica({ filename: "src/lib/outro.ts", name: "lerTemaNoServidor" })).toBe(
      false,
    );
  });

  it("balde do rate limit: so [a-z0-9_-]", () => {
    expect(baldeDaFuncao({ filename: "src/lib/ai.functions.ts", name: "aiAnalyze" })).toBe(
      "aianalyze",
    );
    expect(baldeDaFuncao({ filename: "x", name: "Nome Estranho!" })).toBe("nome-estranho-");
  });
});
