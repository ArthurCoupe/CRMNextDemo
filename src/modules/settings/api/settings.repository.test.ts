import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

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

const { lerTime, salvarMetas, definirSituacaoDaPessoa, definirPapelDaPessoa, atualizarPerfil } =
  await import("./settings.repository");

const PESSOA = "3f1b8c02-91d4-4a67-b0e5-2c7a9d4e6f81";

const METAS = {
  toquesSemana: 40,
  r1Semana: 8,
  mrrMensal: 30000,
  tcvAlvo: 120000,
  confirmado: true,
};

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "salvarMetas",
    chamar: () => salvarMetas(METAS),
    recusa: "Alterar metas é do owner.",
  },
  {
    nome: "definirSituacaoDaPessoa",
    chamar: () => definirSituacaoDaPessoa(PESSOA, false),
    recusa: "Nao foi possivel alterar a situacao: so um owner pode fazer isso.",
  },
  {
    nome: "definirPapelDaPessoa",
    chamar: () => definirPapelDaPessoa(PESSOA, "manager"),
    recusa: "Nao foi possivel trocar o papel: so um owner pode fazer isso.",
  },
  {
    nome: "atualizarPerfil",
    chamar: () => atualizarPerfil(PESSOA, { nomeCompleto: "Marina Silva", cargo: "SDR" }),
    recusa:
      "O perfil não foi salvo. Recarregue a página: o perfil pode ter mudado ou a sessão expirou.",
  },
];

describe("write barrado pela RLS volta zero linha, e o repositório recusa com a mensagem certa", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas.length = 0;
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

describe("nome em branco não chega ao banco, e cargo vazio vira null (A1.5)", () => {
  beforeEach(() => {
    resposta = UMA_LINHA;
    chamadas.length = 0;
  });

  for (const branco of ["", "   ", "\t\n"]) {
    it(`recusa ${JSON.stringify(branco)} antes de qualquer PATCH`, async () => {
      await expect(atualizarPerfil(PESSOA, { nomeCompleto: branco, cargo: "SDR" })).rejects.toThrow(
        "O nome não pode ficar em branco.",
      );

      expect(chamadas.map((c) => c.metodo)).not.toContain("update");
    });
  }

  it("o positivo ao lado: nome e cargo aparados e gravados juntos, na linha certa", async () => {
    await expect(
      atualizarPerfil(PESSOA, { nomeCompleto: "  Marina Silva  ", cargo: "  SDR  " }),
    ).resolves.toBeUndefined();

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toEqual({ full_name: "Marina Silva", job_title: "SDR" });
    expect(chamadas.find((c) => c.metodo === "eq")?.args).toEqual(["id", PESSOA]);
  });

  it("cargo só com espaço grava null, nunca texto vazio", async () => {
    await atualizarPerfil(PESSOA, { nomeCompleto: "Marina Silva", cargo: "   " });

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      full_name: "Marina Silva",
      job_title: null,
    });
  });

  it("cargo null grava null", async () => {
    await atualizarPerfil(PESSOA, { nomeCompleto: "Marina Silva", cargo: null });

    expect(chamadas.find((c) => c.metodo === "update")?.args[0]).toEqual({
      full_name: "Marina Silva",
      job_title: null,
    });
  });
});

describe("lerTime deriva as iniciais do nome, e não lê a coluna morta", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  it("as iniciais vêm do nome, para cada pessoa", async () => {
    resposta = {
      data: [
        {
          id: "p1",
          full_name: "Augusto Conceição",
          email: "a@exemplo.test",
          role: "owner",
          active: true,
        },
        {
          id: "p2",
          full_name: "Ana Paula Souza",
          email: "b@exemplo.test",
          role: "member",
          active: false,
        },
      ],
      error: null,
    };

    const time = await lerTime();

    expect(time.pessoas.map((p) => p.iniciais)).toEqual(["AC", "AS"]);
  });

  it("🔴 a projeção NÃO pede `initials` — a coluna está NULL nos 7 e não tem consumidor", async () => {
    resposta = { data: [], error: null };

    await lerTime();

    const select = chamadas.find((chamada) => chamada.metodo === "select");
    const colunas = String(select?.args[0] ?? "")
      .split(",")
      .map((coluna) => coluna.trim());
    expect(colunas).not.toContain("initials");
    expect(colunas).toContain("full_name");
    expect(colunas).toContain("active");
  });

  it("nome ausente cai no mesmo `?` que o card já mostrava — não inventa símbolo novo", async () => {
    resposta = {
      data: [{ id: "p1", full_name: "", email: "a@exemplo.test", role: "member", active: true }],
      error: null,
    };

    const time = await lerTime();

    expect(time.pessoas[0]?.iniciais).toBe("?");
  });
});

describe("lerTime filtra role (SET-3): client não entra na lista", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  it("chama .in('role', ['owner','manager','member']) — o duplo é cego ao filtro, quem prende o defeito é a CADEIA, não o retorno", async () => {
    resposta = { data: [], error: null };

    await lerTime();

    expect(chamadas).toContainEqual({
      metodo: "in",
      args: ["role", ["owner", "manager", "member"]],
    });
  });
});

describe("lerTime traz o cargo (A2.1)", () => {
  beforeEach(() => {
    chamadas.length = 0;
  });

  it("projeta job_title e devolve como cargo, nulo quando não há", async () => {
    resposta = {
      data: [
        {
          id: "p1",
          full_name: "Augusto Conceição",
          email: "a@exemplo.test",
          role: "owner",
          active: true,
          job_title: "Sócio",
        },
        {
          id: "p2",
          full_name: "Ana Paula Souza",
          email: "b@exemplo.test",
          role: "member",
          active: true,
          job_title: null,
        },
      ],
      error: null,
    };

    const time = await lerTime();

    expect(time.pessoas.map((p) => p.cargo)).toEqual(["Sócio", null]);
    const select = chamadas.find((chamada) => chamada.metodo === "select");
    const colunas = String(select?.args[0] ?? "")
      .split(",")
      .map((coluna) => coluna.trim());
    expect(colunas).toContain("job_title");
  });
});
