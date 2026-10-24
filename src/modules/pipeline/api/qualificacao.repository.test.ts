import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

import type { CatalogoLidoParaEdicao } from "./qualificacao.repository";

let resposta: RespostaFalsa = UMA_LINHA;
const chamadas: ChamadaRegistrada[] = [];

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: clienteFalso(
      () => resposta,
      (chamada) => chamadas.push(chamada),
    ),
  };
});

const { lerCatalogoParaEdicao, salvarCatalogoDeQualificacao } =
  await import("./qualificacao.repository");

const ATUALIZADO_EM = "2026-10-07T12:00:00.123456+00:00";

const BRUTO = {
  version: 1,
  tiers: { A: 6, B: 4 },
  questions: [
    {
      key: "decisor",
      label: "Q2 · Decisão",
      prompt: "Você decide sozinho?",
      options: [
        { points: 2, label: "Aprova sozinho" },
        { points: 0, label: "Não decide", ko: true },
      ],
    },
  ],
};

const LIDO: CatalogoLidoParaEdicao = {
  catalogo: {
    version: 1,
    questions: [
      {
        key: "decisor",
        label: "Q2 · Decisão",
        prompt: "Você decide sozinho?",
        options: [
          { label: "Aprova sozinho", points: 2, ko: false },
          { label: "Não decide", points: 0, ko: true },
        ],
      },
    ],
  },
  bruto: BRUTO,
  atualizadoEm: ATUALIZADO_EM,
};

const RECUSA =
  "As perguntas não foram salvas: alguém salvou antes de você, ou a sessão não é de owner. Recarregue a página e refaça.";

const ERRO_DE_PERMISSAO = { code: "42501", message: "x", details: "", hint: "" };

beforeEach(() => {
  resposta = UMA_LINHA;
  chamadas.length = 0;
});

describe("lerCatalogoParaEdicao", () => {
  it("devolve o catálogo lido, o JSON cru e o carimbo de updated_at", async () => {
    resposta = { data: { value: BRUTO, updated_at: ATUALIZADO_EM }, error: null };

    const lido = await lerCatalogoParaEdicao();

    expect(lido.atualizadoEm).toBe(ATUALIZADO_EM);
    expect(lido.bruto).toEqual(BRUTO);
    expect(lido.catalogo.questions.map((p) => p.key)).toEqual(["decisor"]);
    expect(chamadas).toContainEqual({ metodo: "select", args: ["value, updated_at"] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["key", "qualification_questions"] });
  });

  it("🔴 value que não é objeto falha alto, não vira editor vazio", async () => {
    resposta = { data: { value: [], updated_at: ATUALIZADO_EM }, error: null };

    await expect(lerCatalogoParaEdicao()).rejects.toThrow(
      "Catálogo de qualificação ausente ou com formato inválido.",
    );
  });

  it("🔴 erro do banco sai por erroDoBanco, com o code preservado", async () => {
    resposta = { data: null, error: ERRO_DE_PERMISSAO };

    await expect(lerCatalogoParaEdicao()).rejects.toMatchObject({ code: "42501", message: "x" });
  });
});

describe("salvarCatalogoDeQualificacao", () => {
  it("grava o catálogo montado, com tiers preservado, só se ninguém salvou depois da leitura", async () => {
    await salvarCatalogoDeQualificacao(
      LIDO,
      LIDO.catalogo.questions.map((p) => ({ ...p, label: "Q2 · Quem decide" })),
    );

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      value: {
        version: 2,
        tiers: { A: 6, B: 4 },
        questions: [
          {
            key: "decisor",
            label: "Q2 · Quem decide",
            prompt: "Você decide sozinho?",
            options: [
              { points: 2, label: "Aprova sozinho" },
              { points: 0, label: "Não decide", ko: true },
            ],
          },
        ],
      },
    });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["key", "qualification_questions"] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["updated_at", ATUALIZADO_EM] });
    expect(chamadas).toContainEqual({ metodo: "select", args: ["key"] });
  });

  it("🔴 zero linha (outro salvou antes, ou não é owner) vira a frase, não sucesso", async () => {
    resposta = ZERO_LINHAS;

    await expect(salvarCatalogoDeQualificacao(LIDO, LIDO.catalogo.questions)).rejects.toThrow(
      RECUSA,
    );
  });

  it("data null também", async () => {
    resposta = NENHUM_DADO;

    await expect(salvarCatalogoDeQualificacao(LIDO, LIDO.catalogo.questions)).rejects.toThrow(
      RECUSA,
    );
  });

  it("🔴 erro do banco sai por erroDoBanco, com o code preservado, depois do update", async () => {
    resposta = { data: null, error: ERRO_DE_PERMISSAO };

    await expect(salvarCatalogoDeQualificacao(LIDO, LIDO.catalogo.questions)).rejects.toMatchObject(
      { code: "42501", message: "x" },
    );

    expect(chamadas.map((c) => c.metodo)).toContain("update");
  });

  it("🔴 o catálogo montado também passa pelo leitor da ficha: opção ausente no cru não chega ao banco", async () => {
    const semOpcoes: CatalogoLidoParaEdicao = {
      ...LIDO,
      bruto: { version: 1, questions: [{ key: "decisor", label: "Q2", prompt: "Decide?" }] },
    };

    await expect(salvarCatalogoDeQualificacao(semOpcoes, LIDO.catalogo.questions)).rejects.toThrow(
      'Pergunta "decisor" incompleta no catálogo.',
    );

    expect(chamadas.map((c) => c.metodo)).not.toContain("update");
  });

  it("🔴 catálogo inválido não chega ao banco", async () => {
    await expect(
      salvarCatalogoDeQualificacao(LIDO, [
        { key: "decisor", label: "Q2", prompt: "Decide?", options: [{ label: "Sim", points: 3 }] },
      ]),
    ).rejects.toThrow("Pergunta 1, opção 1: os pontos vão de 0 a 2, sem fração.");

    expect(chamadas.map((c) => c.metodo)).not.toContain("update");
  });
});
