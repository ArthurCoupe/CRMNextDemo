import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  repetir,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";
import type { PessoaParaGravar } from "./payroll.repository";

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

const { apagarPessoaDaFolha, atualizarPessoa, definirSituacaoDaPessoa, listarPerfis } =
  await import("./payroll.repository");

const PESSOA = "7c2e4a19-5db3-4f80-9a61-e83d5b0c7f42";

const DADOS: PessoaParaGravar = {
  profileId: null,
  pessoa: "Fulana de Tal",
  cargo: "Closer",
  vinculo: "clt",
  bu: "demanda",
  custoMensal: 5000,
  beneficios: 800,
  percentualSugerido: null,
  inicio: "2026-01-01",
  fim: null,
};

const RECUSA = "Nada foi alterado: só o owner edita a folha.";

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "atualizarPessoa",
    chamar: () => atualizarPessoa(PESSOA, DADOS),
    recusa: RECUSA,
  },
  {
    nome: "definirSituacaoDaPessoa",
    chamar: () => definirSituacaoDaPessoa(PESSOA, false),
    recusa: RECUSA,
  },
  {
    nome: "apagarPessoaDaFolha",
    chamar: () => apagarPessoaDaFolha(PESSOA),
    recusa:
      "Só o owner apaga pessoa da folha. Se você usa app autenticador, saia e entre de novo com o código de 6 dígitos.",
  },
];

describe("write barrado pela RLS volta zero linha, e o repositório recusa com a mensagem certa", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
  });

  for (const write of WRITES) {
    it(`${write.nome} lança quando a RLS devolve lista vazia`, async () => {
      resposta = ZERO_LINHAS;

      await expect(write.chamar()).rejects.toThrow(write.recusa);
    });

    it(`${write.nome} lança igual quando o PostgREST devolve data null`, async () => {
      resposta = NENHUM_DADO;

      await expect(write.chamar()).rejects.toThrow(write.recusa);
    });

    it(`${write.nome} passa quando a linha volta — o positivo ao lado do negativo`, async () => {
      resposta = UMA_LINHA;

      await expect(write.chamar()).resolves.toBeUndefined();
    });
  }
});

const PERFIL = "3f6b8c21-9d47-4e50-b2a8-1c7e5d904f36";
const OUTRO_PERFIL = "5a2d7e88-1b34-4c96-8f07-6e3a9b2c4d15";

function perfil(id: string, nome: string, ativo: boolean) {
  return { id, full_name: nome, active: ativo };
}

const chamou = (metodo: string) => chamadas.some((c) => c.metodo === metodo);

describe("listarPerfis: desativar a conta não pode esvaziar o vínculo da pessoa", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("com perfil vinculado, filtra por 'ativo OU é ele' — e o desativado volta marcado", async () => {
    resposta = {
      data: [perfil(PERFIL, "Ana Souza", false), perfil(OUTRO_PERFIL, "Bia Lima", true)],
      error: null,
    };

    const lista = await listarPerfis(PERFIL);

    expect(chamadas).toContainEqual({ metodo: "or", args: [`active.eq.true,id.eq.${PERFIL}`] });
    expect(chamadas).not.toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(lista).toEqual([
      { id: PERFIL, nome: "Ana Souza", ativo: false },
      { id: OUTRO_PERFIL, nome: "Bia Lima", ativo: true },
    ]);
  });

  it("o positivo ao lado: sem vínculo (criação de pessoa), volta ao active = true puro", async () => {
    resposta = { data: [perfil(OUTRO_PERFIL, "Bia Lima", true)], error: null };

    const lista = await listarPerfis(null);

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
    expect(lista).toEqual([{ id: OUTRO_PERFIL, nome: "Bia Lima", ativo: true }]);
  });

  it("undefined é tratado como sem vínculo — a assinatura permite omitir o argumento", async () => {
    await listarPerfis();

    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
    expect(chamou("or")).toBe(false);
  });

  it("🔴 id fora do formato UUID não entra cru no or= — a vírgula viraria sintaxe", async () => {
    await listarPerfis("nao-e-uuid,role.eq.owner");

    expect(chamou("or")).toBe(false);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["active", true] });
  });

  it("🔴 a projeção inclui `active` — sem ela o campo `ativo` mente em silêncio", async () => {
    resposta = { data: [perfil(OUTRO_PERFIL, "Bia Lima", true)], error: null };

    await listarPerfis(PERFIL);

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select).toBeDefined();
    const colunas = String(select?.args[0] ?? "")
      .split(",")
      .map((coluna) => coluna.trim());
    expect(colunas).toContain("active");
    expect(colunas).toContain("id");
    expect(colunas).toContain("full_name");
  });

  it("🔴 a cauda da cadeia mantém ordenação e teto — nos dois ramos", async () => {
    await listarPerfis(PERFIL);

    expect(chamadas).toContainEqual({ metodo: "order", args: ["full_name"] });
    expect(chamadas).toContainEqual({ metodo: "limit", args: [500] });

    chamadas.length = 0;
    await listarPerfis(null);

    expect(chamadas).toContainEqual({ metodo: "order", args: ["full_name"] });
    expect(chamadas).toContainEqual({ metodo: "limit", args: [500] });
  });

  it("🔴 lista no teto EXATO recusa — truncar calado esconde a conta vinculada", async () => {
    resposta = { data: repetir(perfil(OUTRO_PERFIL, "Bia Lima", true), 500), error: null };

    await expect(listarPerfis(PERFIL)).rejects.toThrow(/teto de 500/);
  });

  it("uma linha abaixo do teto passa — a guarda não recusa lista completa", async () => {
    resposta = { data: repetir(perfil(OUTRO_PERFIL, "Bia Lima", true), 499), error: null };

    await expect(listarPerfis(PERFIL)).resolves.toHaveLength(499);
  });
});

describe("apagarPessoaDaFolha: a cadeia e o erro do banco", () => {
  beforeEach(() => {
    chamadas.length = 0;
    resposta = UMA_LINHA;
  });

  it("a cadeia é DELETE em `payroll` preso ao id, com `.select` para ver a recusa", async () => {
    await apagarPessoaDaFolha(PESSOA);

    expect(chamadas).toContainEqual({ metodo: "from", args: ["payroll"] });
    expect(chamadas).toContainEqual({ metodo: "delete", args: [] });
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", PESSOA] });
    expect(chamadas).toContainEqual({ metodo: "select", args: ["id"] });
  });

  it("erro do banco passa por erroDoBanco, com o code preservado", async () => {
    resposta = {
      data: null,
      error: { message: "permission denied for table payroll", code: "42501" },
    };

    const erro: unknown = await apagarPessoaDaFolha(PESSOA).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ code: "42501", message: "permission denied for table payroll" });
  });
});
