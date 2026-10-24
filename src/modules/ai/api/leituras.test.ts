import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lerClientes, lerOnboarding, lerPipeline, lerQuemPergunta, type Cliente } from "./leituras";

function clienteFalso(porTabela: Record<string, readonly unknown[]>): Cliente {
  const encadear = (tabela: string): unknown =>
    new Proxy(
      {
        then: (resolver: (r: { data: readonly unknown[]; error: null }) => void) =>
          resolver({ data: porTabela[tabela] ?? [], error: null }),
      },
      {
        get: (alvo, chave) => {
          if (chave === "then") return Reflect.get(alvo, chave);
          if (typeof chave === "symbol") return undefined;
          return () => encadear(tabela);
        },
      },
    );

  return { from: (tabela: string) => encadear(tabela) } as unknown as Cliente;
}

const oportunidade = {
  name: "Acme",
  stage: "novo",
  estimated_value: null,
  next_followup_at: null,
  stage_changed_at: null,
};

const cliente = { id: "c1", name: "Acme", status: "active", segment: null, nicho: null };

function repetir<T>(linha: T, quantas: number): readonly T[] {
  return Array.from({ length: quantas }, () => linha);
}

describe("teto das leituras do contexto", () => {
  it("abaixo do teto, devolve tudo", async () => {
    const supabase = clienteFalso({ opportunities: repetir(oportunidade, 199) });
    await expect(lerPipeline(supabase)).resolves.toHaveLength(199);
  });

  it("no teto, recusa em vez de devolver lista truncada", async () => {
    const supabase = clienteFalso({ opportunities: repetir(oportunidade, 200) });
    await expect(lerPipeline(supabase)).rejects.toThrow(/teto de 200/);
  });

  it("recusa pelo teto da saúde mesmo com a lista de clientes curta", async () => {
    const supabase = clienteFalso({
      clients: repetir(cliente, 5),
      v_client_health: repetir({ client_id: "c1", ultimo_evento_em: null }, 200),
    });
    await expect(lerClientes(supabase)).rejects.toThrow(/v_client_health/);
  });
});

describe("dias civis em São Paulo, não em UTC (AI-1)", () => {
  const INSTANTE_DE_NOITE = "2026-09-20T02:30:00+00:00";
  const AGORA = new Date("2026-09-21T15:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: AGORA });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stage_changed_at às 23:30 de SP conta pelo dia civil de SP", async () => {
    const supabase = clienteFalso({
      opportunities: [{ ...oportunidade, stage_changed_at: INSTANTE_DE_NOITE }],
    });
    const [lida] = await lerPipeline(supabase);
    expect(lida?.diasNoEstagio).toBe(2);
  });

  it("ultimo_evento_em às 23:30 de SP conta pelo dia civil de SP", async () => {
    const supabase = clienteFalso({
      clients: [cliente],
      v_client_health: [{ client_id: "c1", ultimo_evento_em: INSTANTE_DE_NOITE }],
    });
    const [lido] = await lerClientes(supabase);
    expect(lido?.diasSemContato).toBe(2);
  });

  it("iniciada_em às 23:30 de SP conta pelo dia civil de SP", async () => {
    const supabase = clienteFalso({
      onboarding_journeys: [
        { iniciada_em: INSTANTE_DE_NOITE, clients: { name: "Acme" }, onboarding_phases: [] },
      ],
    });
    const [lido] = await lerOnboarding(supabase);
    expect(lido?.diasDesdeInicio).toBe(2);
  });
});

function clienteComPapel(papel: string): Cliente {
  const perfil = { data: { full_name: "Fulana" }, error: null };
  return {
    rpc: () => Promise.resolve({ data: papel, error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(perfil) }) }),
    }),
  } as unknown as Cliente;
}

describe("lerQuemPergunta: o assistente é só para a equipe", () => {
  it("papel `client` recusa antes de qualquer leitura", async () => {
    await expect(lerQuemPergunta(clienteComPapel("client"), "u1")).rejects.toThrow(
      "O assistente é só para a equipe.",
    );
  });

  it.each(["owner", "manager", "member"])(
    "papel `%s` passa, com o nome do perfil",
    async (papel) => {
      await expect(lerQuemPergunta(clienteComPapel(papel), "u1")).resolves.toEqual({
        papel,
        nome: "Fulana",
      });
    },
  );
});
