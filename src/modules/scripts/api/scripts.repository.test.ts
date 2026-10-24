import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

import type { DadosDeScript } from "./scripts.repository";

let resposta: RespostaFalsa = UMA_LINHA;
const chamadas: ChamadaRegistrada[] = [];

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: {
      ...clienteFalso(
        () => resposta,
        (c) => chamadas.push(c),
      ),
      rpc: (...args: unknown[]) => {
        chamadas.push({ metodo: "rpc", args });
        return Promise.resolve(resposta);
      },
    },
  };
});

const {
  listarScripts,
  criarScript,
  atualizarScript,
  definirSituacaoDoScript,
  apagarScript,
  registrarUso,
  listarMaisUsados,
  listarScriptsDeWhatsApp,
} = await import("./scripts.repository");

const SCRIPT = "9f1b8c02-91d4-4a67-b0e5-2c7a9d4e6f81";
const UPDATED_AT = "2026-09-08T00:00:00.000Z";

const DADOS = {
  tipo: "sdr" as const,
  title: "Primeiro toque",
  body: "Oi, tudo bem?",
  nicho: "advocacia",
  canal: "whatsapp" as const,
  momento: "primeiro_contato" as const,
  pipelineStage: null,
};

describe("o filtro vai para o Postgres, nao para a memoria", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("filtra por tipo e por active no banco", async () => {
    await listarScripts({ tipo: "sdr" });

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["tipo", "sdr"]);
    expect(eqs).toContainEqual(["active", true]);
  });

  it("cada filtro opcional preenchido vira um .eq a mais", async () => {
    await listarScripts({ tipo: "closer", canal: "reuniao", momento: "proposta", nicho: "odonto" });

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["canal", "reuniao"]);
    expect(eqs).toContainEqual(["momento", "proposta"]);
    expect(eqs).toContainEqual(["nicho", "odonto"]);
  });

  it("filtro vazio NAO vira .eq com undefined", async () => {
    await listarScripts({ tipo: "sdr" });

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs.some((a) => a[1] === undefined)).toBe(false);
    expect(eqs).toHaveLength(2);
  });

  it("🔴 a projecao e explicita — nenhum select('*')", async () => {
    await listarScripts({ tipo: "sdr" });

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select?.args[0]).not.toBe("*");
    expect(String(select?.args[0])).toContain("body");
  });

  it("tem teto", async () => {
    await listarScripts({ tipo: "sdr" });
    expect(chamadas.some((c) => c.metodo === "limit")).toBe(true);
  });

  it("desempata por title, para a ordem nao depender do plano do Postgres", async () => {
    await listarScripts({ tipo: "sdr" });

    const orders = chamadas.filter((c) => c.metodo === "order").map((c) => c.args[0]);
    expect(orders).toEqual(["sort_order", "title"]);
  });
});

describe("a busca da lupa tambem vai para o Postgres", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("termo preenchido chama a RPC com tipo, termo aparado e os filtros", async () => {
    await listarScripts({ tipo: "closer", canal: "reuniao", busca: "  objeção " });

    expect(chamadas).toEqual([
      {
        metodo: "rpc",
        args: ["buscar_scripts", { p_tipo: "closer", p_termo: "objeção", p_canal: "reuniao" }],
      },
    ]);
  });

  it("filtro ausente fica FORA do corpo — nada de p_nicho: undefined", async () => {
    await listarScripts({ tipo: "sdr", busca: "oi" });

    const corpo = chamadas.find((c) => c.metodo === "rpc")?.args[1];
    expect(corpo).toEqual({ p_tipo: "sdr", p_termo: "oi" });
  });

  it("termo vazio ou so espaco NAO chama a RPC — volta a listagem normal", async () => {
    await listarScripts({ tipo: "sdr", busca: "   " });

    expect(chamadas.some((c) => c.metodo === "rpc")).toBe(false);
    expect(chamadas[0]).toEqual({ metodo: "from", args: ["scripts"] });
  });

  it("a linha da RPC vira Script, na ordem que o banco mandou", async () => {
    const linha = {
      id: SCRIPT,
      tipo: "sdr",
      title: "Primeiro toque",
      body: "Oi",
      nicho: "todos",
      canal: "whatsapp",
      momento: "primeiro_contato",
      pipeline_stage: null,
      sort_order: 0,
      active: true,
      updated_at: UPDATED_AT,
    };
    resposta = { data: [linha, { ...linha, id: "outro", title: "Z" }], error: null };

    const scripts = await listarScripts({ tipo: "sdr", busca: "oi" });

    expect(scripts.map((s) => s.id)).toEqual([SCRIPT, "outro"]);
    expect(scripts[0]).toMatchObject({ pipelineStage: null, sortOrder: 0, updatedAt: UPDATED_AT });
  });

  it("erro da RPC passa por erroDoBanco — mensagem do banco chega como Error", async () => {
    resposta = { data: null, error: { code: "42883", message: "function not found" } };

    const erro: unknown = await listarScripts({ tipo: "sdr", busca: "oi" }).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("function not found");
  });
});

describe("write barrado pela RLS volta zero linha, e o repositorio recusa", () => {
  const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
    {
      nome: "criarScript",
      chamar: () => criarScript(DADOS),
      recusa: "Criar script é do owner e do manager.",
    },
    {
      nome: "atualizarScript",
      chamar: () => atualizarScript(SCRIPT, { title: "x" }, UPDATED_AT),
      recusa: "Alguém editou este script enquanto você escrevia. Recarregue e refaça.",
    },
    {
      nome: "definirSituacaoDoScript",
      chamar: () => definirSituacaoDoScript(SCRIPT, false),
      recusa: "Arquivar script é do owner e do manager.",
    },
    {
      nome: "apagarScript",
      chamar: () => apagarScript(SCRIPT),
      recusa:
        "Só owner e manager apagam script. Se ele já foi apagado em outra tela, recarregue a página.",
    },
  ];

  for (const write of WRITES) {
    it(`${write.nome} lanca quando a RLS devolve lista vazia`, async () => {
      resposta = ZERO_LINHAS;
      await expect(write.chamar()).rejects.toThrow(write.recusa);
    });

    it(`${write.nome} lanca igual quando o PostgREST devolve data null`, async () => {
      resposta = NENHUM_DADO;
      await expect(write.chamar()).rejects.toThrow(write.recusa);
    });

    it(`${write.nome} passa quando a linha volta`, async () => {
      resposta = UMA_LINHA;
      await expect(write.chamar()).resolves.toBeUndefined();
    });
  }
});

describe("apagarScript (D-067)", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = UMA_LINHA;
  });

  it("apaga a linha de scripts pelo id e pede o id de volta", async () => {
    await apagarScript(SCRIPT);

    expect(chamadas.find((c) => c.metodo === "from")?.args).toEqual(["scripts"]);
    expect(chamadas.some((c) => c.metodo === "delete")).toBe(true);
    expect(chamadas.find((c) => c.metodo === "eq")?.args).toEqual(["id", SCRIPT]);
    expect(chamadas.find((c) => c.metodo === "select")?.args).toEqual(["id"]);
    expect(chamadas.some((c) => c.metodo === "update")).toBe(false);
  });
});

describe("SCR-2: nicho vazio grava 'todos', explícito", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = UMA_LINHA;
  });

  it("criarScript com nicho '' manda a coluna nicho = 'todos'", async () => {
    await criarScript({ ...DADOS, nicho: "" });

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.args[0]).toMatchObject({ nicho: "todos" });
  });

  it("criarScript com nicho preenchido manda a coluna com o valor digitado", async () => {
    await criarScript(DADOS);

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.args[0]).toMatchObject({ nicho: "advocacia" });
  });

  it("🔴 atualizarScript com nicho '' grava 'todos' — não mantém o valor antigo em silêncio", async () => {
    await atualizarScript(SCRIPT, { nicho: "" }, UPDATED_AT);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toMatchObject({ nicho: "todos" });
  });

  it("o positivo ao lado: atualizarScript com nicho preenchido grava o valor digitado", async () => {
    await atualizarScript(SCRIPT, { nicho: "clinicas" }, UPDATED_AT);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toMatchObject({ nicho: "clinicas" });
  });
});

describe("SCR-3: edicao concorrente — o UPDATE confere updated_at", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  it("manda .eq('updated_at', updatedAt) na cadeia do UPDATE", async () => {
    resposta = UMA_LINHA;
    await atualizarScript(SCRIPT, { title: "novo" }, UPDATED_AT);

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["updated_at", UPDATED_AT]);
  });

  it("🔴 updated_at divergente (outra pessoa salvou antes) volta zero linha e lança a mensagem de conflito", async () => {
    resposta = ZERO_LINHAS;

    await expect(atualizarScript(SCRIPT, { title: "novo" }, UPDATED_AT)).rejects.toThrow(
      "Alguém editou este script enquanto você escrevia. Recarregue e refaça.",
    );
  });

  it("updated_at igual: a linha volta e a promessa resolve", async () => {
    resposta = UMA_LINHA;

    await expect(atualizarScript(SCRIPT, { title: "novo" }, UPDATED_AT)).resolves.toBeUndefined();
  });
});

describe("SCR-5: tipo viaja no UPDATE junto de canal e momento", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = UMA_LINHA;
  });

  it("🔴 atualizarScript com tipo no parcial manda a coluna tipo", async () => {
    await atualizarScript(
      SCRIPT,
      { tipo: "closer", canal: "reuniao", momento: "fechamento" },
      UPDATED_AT,
    );

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toMatchObject({
      tipo: "closer",
      canal: "reuniao",
      momento: "fechamento",
    });
  });

  it("sem tipo no parcial, a coluna tipo não vai", async () => {
    await atualizarScript(SCRIPT, { title: "novo" }, UPDATED_AT);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).not.toHaveProperty("tipo");
  });
});

describe("A1.7: editar não apaga o estágio gravado", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = UMA_LINHA;
  });

  it("o UPDATE da edição não leva pipeline_stage, nem com os dados inteiros", async () => {
    await atualizarScript(SCRIPT, DADOS, UPDATED_AT);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toMatchObject({ title: "Primeiro toque" });
    expect(update?.args[0]).not.toHaveProperty("pipeline_stage");
  });

  it("nem quando quem chama manda um estágio", async () => {
    const comEstagio: DadosDeScript = { ...DADOS, pipelineStage: "qualificacao" };

    await atualizarScript(SCRIPT, comEstagio, UPDATED_AT);

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toMatchObject({ title: "Primeiro toque" });
    expect(update?.args[0]).not.toHaveProperty("pipeline_stage");
  });

  it("controle: criar continua gravando o estágio que veio", async () => {
    await criarScript({ ...DADOS, pipelineStage: "qualificacao" });

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.args[0]).toMatchObject({ pipeline_stage: "qualificacao" });
  });
});

describe("registrarUso", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = UMA_LINHA;
  });

  it("grava no log com o id do script", async () => {
    await registrarUso(SCRIPT);

    const insert = chamadas.find((c) => c.metodo === "insert");
    expect(insert?.args[0]).toMatchObject({ script_id: SCRIPT });
  });

  it("🔴 falha ao registrar NAO impede o copiar — mas nao passa calada", async () => {
    resposta = { data: null, error: { message: "insert negado", code: "42501" } };
    await expect(registrarUso(SCRIPT)).rejects.toThrow("insert negado");
  });
});

describe("listarMaisUsados", () => {
  const OUTRO_SCRIPT = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

  beforeEach(() => {
    chamadas.length = 0;
  });

  it("ordena por used_at decrescente antes do teto — a janela é sempre a mais recente", async () => {
    resposta = { data: [], error: null };

    await listarMaisUsados("sdr");

    const order = chamadas.find((c) => c.metodo === "order");
    expect(order?.args).toEqual(["used_at", { ascending: false }]);

    const ordemDosMetodos = chamadas.map((c) => c.metodo);
    expect(ordemDosMetodos.indexOf("order")).toBeLessThan(ordemDosMetodos.indexOf("limit"));
    expect(chamadas.find((c) => c.metodo === "limit")?.args[0]).toBe(200);
  });

  it("filtra por tipo no banco, nao em memoria", async () => {
    resposta = { data: [], error: null };

    await listarMaisUsados("closer");

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["scripts.tipo", "closer"]);
  });

  it("🔴 SCR-4: filtra scripts.active = true no join — arquivado sai dos usados", async () => {
    resposta = { data: [], error: null };

    await listarMaisUsados("sdr");

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["scripts.active", true]);
    expect(eqs).toContainEqual(["scripts.tipo", "sdr"]);
  });

  it("agrega usos por script e ordena do mais usado para o menos usado", async () => {
    const linha = (scriptId: string, titulo: string) => ({
      script_id: scriptId,
      scripts: { id: scriptId, title: titulo, tipo: "sdr" },
    });
    resposta = {
      data: [
        linha(OUTRO_SCRIPT, "Segundo lugar"),
        linha(SCRIPT, "Primeiro lugar"),
        linha(SCRIPT, "Primeiro lugar"),
        linha(SCRIPT, "Primeiro lugar"),
      ],
      error: null,
    };

    const resultado = await listarMaisUsados("sdr");

    expect(resultado).toEqual([
      { scriptId: SCRIPT, titulo: "Primeiro lugar", usos: 3 },
      { scriptId: OUTRO_SCRIPT, titulo: "Segundo lugar", usos: 1 },
    ]);
  });

  it("linha com scripts nulo (join que nao bateu) e ignorada na contagem", async () => {
    resposta = {
      data: [
        { script_id: OUTRO_SCRIPT, scripts: null },
        { script_id: SCRIPT, scripts: { id: SCRIPT, title: "Unico", tipo: "sdr" } },
      ],
      error: null,
    };

    const resultado = await listarMaisUsados("sdr");

    expect(resultado).toEqual([{ scriptId: SCRIPT, titulo: "Unico", usos: 1 }]);
  });

  it("erro do banco propaga via erroDoBanco, nao objeto cru", async () => {
    resposta = { data: null, error: { message: "tabela sem permissao", code: "42501" } };

    const erro: unknown = await listarMaisUsados("sdr").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("tabela sem permissao");
  });
});

describe("listarScriptsDeWhatsApp: a lista do botao da ficha (D-059)", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("filtra canal whatsapp e active no banco, sem filtrar tipo (SDR e Closer juntos)", async () => {
    await listarScriptsDeWhatsApp();

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toEqual([
      ["canal", "whatsapp"],
      ["active", true],
    ]);
  });

  it("projecao explicita, ordem sort_order e title, teto de 200", async () => {
    await listarScriptsDeWhatsApp();

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select?.args[0]).not.toBe("*");
    expect(String(select?.args[0])).toContain("body");
    expect(chamadas.filter((c) => c.metodo === "order").map((c) => c.args[0])).toEqual([
      "sort_order",
      "title",
    ]);
    expect(chamadas.find((c) => c.metodo === "limit")?.args[0]).toBe(200);
  });

  it("devolve as linhas no formato da tela", async () => {
    resposta = {
      data: [
        {
          id: SCRIPT,
          tipo: "closer",
          title: "Qualificação advocacia",
          body: "Oi, tudo bem?",
          nicho: "advocacia",
          canal: "whatsapp",
          momento: "abertura",
          pipeline_stage: "qualificacao",
          sort_order: 0,
          active: true,
          updated_at: UPDATED_AT,
        },
      ],
      error: null,
    };

    const [script] = await listarScriptsDeWhatsApp();
    expect(script?.title).toBe("Qualificação advocacia");
    expect(script?.pipelineStage).toBe("qualificacao");
  });

  it("recusa do banco vira Error com a mensagem, nao objeto cru", async () => {
    resposta = { data: null, error: { message: "tabela sem permissao", code: "42501" } };

    const erro: unknown = await listarScriptsDeWhatsApp().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe("tabela sem permissao");
  });
});
