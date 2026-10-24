import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NENHUM_DADO,
  UMA_LINHA,
  ZERO_LINHAS,
  repetir,
  type ChamadaRegistrada,
  type RespostaFalsa,
} from "@/test/supabase-falso";

let resposta: RespostaFalsa = UMA_LINHA;
let limitePedido: unknown;
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client.v2", async () => {
  const { clienteFalso } = await import("@/test/supabase-falso");
  return {
    supabaseV2: {
      ...clienteFalso(
        () => resposta,
        (c: ChamadaRegistrada) => {
          if (c.metodo === "limit") limitePedido = c.args[0];
        },
      ),
      rpc: (...args: unknown[]) => rpc(...args),
    },
  };
});

const {
  apagarJornada,
  definirPapel,
  editarEtapaDaJornada,
  editarItemDaJornada,
  marcarItem,
  lerClientesComJornada,
  lerPapeis,
  iniciarJornada,
  liberarEtapa,
} = await import("./onboarding.repository");

const PESSOA = "7c2d5a91-3e84-4b06-9f1a-8d5c7e3b2a40";
const ITEM = "1a9f4c60-2b73-4e58-8d21-6f0b3c9e7a15";

const WRITES: ReadonlyArray<{ nome: string; chamar: () => Promise<void>; recusa: string }> = [
  {
    nome: "definirPapel",
    chamar: () => definirPapel("cs", PESSOA),
    recusa: "Você não tem permissão para configurar papéis.",
  },
  {
    nome: "definirPapel (tirando a pessoa do papel)",
    chamar: () => definirPapel("cs", null),
    recusa: "Você não tem permissão para configurar papéis.",
  },
  {
    nome: "marcarItem (marcando)",
    chamar: () => marcarItem(ITEM, true),
    recusa: "Você não tem permissão para marcar este item.",
  },
  {
    nome: "marcarItem (desmarcando)",
    chamar: () => marcarItem(ITEM, false),
    recusa: "Você não tem permissão para marcar este item.",
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

const CLIENTE_SEM_JORNADA = { id: "c1", name: "Acme", owner_id: PESSOA, onboarding_journeys: [] };

const CLIENTE_COM_ABERTA = {
  id: "c2",
  name: "Beta",
  owner_id: PESSOA,
  onboarding_journeys: [
    { id: "j-fechada", concluida_em: "2026-03-01", iniciada_em: "2026-01-01" },
    { id: "j-aberta", concluida_em: null, iniciada_em: "2026-04-01" },
  ],
};

const CLIENTE_SO_FECHADAS = {
  id: "c3",
  name: "Gama",
  owner_id: PESSOA,
  onboarding_journeys: [
    { id: "j-antiga", concluida_em: "2026-02-01", iniciada_em: "2026-01-01" },
    { id: "j-recente", concluida_em: "2026-06-01", iniciada_em: "2026-05-01" },
  ],
};

const PAPEL = { role_key: "cs", profile_id: PESSOA, pessoa: { full_name: "Ana", active: true } };

const PAPEL_COM_PESSOA_INATIVA = {
  role_key: "am",
  profile_id: PESSOA,
  pessoa: { full_name: "Meire", active: false },
};

const PAPEL_SEM_PESSOA = { role_key: "trafego", profile_id: null, pessoa: null };

describe("teto das listas de referência do onboarding", () => {
  beforeEach(() => {
    limitePedido = undefined;
  });

  it("lerClientesComJornada recusa no teto exato em vez de devolver lista truncada", async () => {
    resposta = { data: repetir(CLIENTE_SEM_JORNADA, 200), error: null };

    await expect(lerClientesComJornada()).rejects.toThrow(
      "A lista de clientes veio no teto de 200 e pode estar incompleta. " +
        "Escolher a partir de lista truncada esconde opção válida.",
    );
    expect(limitePedido).toBe(200);
  });

  it("uma abaixo do teto, lerClientesComJornada devolve tudo — e o cliente sem jornada sai com jornadaId null", async () => {
    resposta = { data: repetir(CLIENTE_SEM_JORNADA, 199), error: null };

    const clientes = await lerClientesComJornada();

    expect(clientes).toHaveLength(199);
    expect(clientes[0]).toEqual({
      id: "c1",
      nome: "Acme",
      jornadaId: null,
      jornadaConcluida: false,
      donoId: PESSOA,
    });
  });

  it("havendo jornada ABERTA, é ela que sai — mesmo com uma fechada na lista", async () => {
    resposta = { data: [CLIENTE_COM_ABERTA], error: null };

    const [cliente] = await lerClientesComJornada();

    expect(cliente).toEqual({
      id: "c2",
      nome: "Beta",
      jornadaId: "j-aberta",
      jornadaConcluida: false,
      donoId: PESSOA,
    });
  });

  it("sem jornada aberta, sai a última FECHADA — jornada concluída não some da tela", async () => {
    resposta = { data: [CLIENTE_SO_FECHADAS], error: null };

    const [cliente] = await lerClientesComJornada();

    expect(cliente).toEqual({
      id: "c3",
      nome: "Gama",
      jornadaId: "j-recente",
      jornadaConcluida: true,
      donoId: PESSOA,
    });
  });

  it("lerPapeis recusa no teto exato em vez de devolver lista truncada", async () => {
    resposta = { data: repetir(PAPEL, 50), error: null };

    await expect(lerPapeis()).rejects.toThrow(
      "A lista de papéis veio no teto de 50 e pode estar incompleta. " +
        "Escolher a partir de lista truncada esconde opção válida.",
    );
    expect(limitePedido).toBe(50);
  });

  it("uma abaixo do teto, lerPapeis devolve tudo com o nome da pessoa mapeado", async () => {
    resposta = { data: repetir(PAPEL, 49), error: null };

    const papeis = await lerPapeis();

    expect(papeis).toHaveLength(49);
    expect(papeis[0]).toEqual({
      papel: "cs",
      pessoaId: PESSOA,
      pessoa: "Ana",
      pessoaInativa: false,
    });
  });

  it("papel sem dono sai com pessoaId e pessoa nulos — o outro lado do `?.` acima", async () => {
    resposta = { data: [PAPEL_SEM_PESSOA], error: null };

    const [papel] = await lerPapeis();

    expect(papel).toEqual({ papel: "trafego", pessoaId: null, pessoa: null, pessoaInativa: false });
  });

  it("pessoa desativada sai com pessoaInativa: true, e o id e o nome continuam", async () => {
    resposta = { data: [PAPEL_COM_PESSOA_INATIVA], error: null };

    const [papel] = await lerPapeis();

    expect(papel).toEqual({ papel: "am", pessoaId: PESSOA, pessoa: "Meire", pessoaInativa: true });
  });
});

describe("ONB-4: jornada aberta duas vezes chega em português", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("🔴 23505 vira 'Este cliente já tem jornada aberta.'", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "uniq_jornada_aberta_por_cliente"',
        code: "23505",
      },
    });

    await expect(iniciarJornada("c1")).rejects.toThrow("Este cliente já tem jornada aberta.");
  });

  it("o code 23505 sobrevive à tradução — a tela continua sabendo que foi o banco", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "uniq_jornada_aberta_por_cliente"',
        code: "23505",
      },
    });

    const erro: unknown = await iniciarJornada("c1").catch((e: unknown) => e);
    expect(erro).toMatchObject({ code: "23505", message: "Este cliente já tem jornada aberta." });
  });

  it("o 23505 de liberarEtapa passa com a frase do banco, não vira a da jornada", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Esta etapa ja foi liberada em 21/09/2026 14:00.", code: "23505" },
    });

    await expect(liberarEtapa("etapa-1")).rejects.toThrow(
      "Esta etapa ja foi liberada em 21/09/2026 14:00.",
    );
  });

  it("outro erro NÃO vira a frase da jornada: passa por erroDoBanco como veio", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Papel cs sem pessoa.", code: "P0001" },
    });

    await expect(iniciarJornada("c1")).rejects.toThrow("Papel cs sem pessoa.");
  });

  it("sucesso devolve o id da jornada", async () => {
    rpc.mockResolvedValue({ data: "j-nova", error: null });

    await expect(iniciarJornada("c1")).resolves.toBe("j-nova");
    expect(rpc).toHaveBeenCalledWith("iniciar_jornada", { p_client_id: "c1" });
  });
});

describe("apagarJornada (D-067)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("chama a RPC com o id e devolve quantos cartões saíram", async () => {
    rpc.mockResolvedValue({ data: 3, error: null });

    await expect(apagarJornada("j1")).resolves.toBe(3);
    expect(rpc).toHaveBeenCalledWith("apagar_jornada", { p_journey_id: "j1" });
  });

  it("🔴 42501 'forbidden' vira 'Apagar jornada é do owner.', e o code sobrevive", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden", code: "42501" } });

    const erro: unknown = await apagarJornada("j1").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({ code: "42501", message: "Apagar jornada é do owner." });
  });

  it("P0002 (já apagada em outra tela) passa com a frase do banco", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Jornada não encontrada. Ela pode já ter sido apagada em outra tela.",
        code: "P0002",
      },
    });

    await expect(apagarJornada("j1")).rejects.toThrow(
      "Jornada não encontrada. Ela pode já ter sido apagada em outra tela.",
    );
  });
});

describe("editar item e etapa da jornada (entrega B)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("item: chama a RPC com o título sem espaço nas pontas, o prazo e o papel", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      editarItemDaJornada(ITEM, { titulo: " Kickoff ", prazoEmDias: 5, papel: "Design" }),
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("editar_item_da_jornada", {
      p_item_id: ITEM,
      p_titulo: "Kickoff",
      p_prazo_em_dias: 5,
      p_papel: "Design",
    });
  });

  it.each([[2.5], [Number.NaN], [-1], [366], [3_000_000_000]])(
    "prazo %s fora de 0 a 365 ou não inteiro: recusa antes do banco",
    async (prazo) => {
      await expect(
        editarItemDaJornada(ITEM, { titulo: "Kickoff", prazoEmDias: prazo, papel: "AM" }),
      ).rejects.toThrow("O prazo do item é um número inteiro de dias, de 0 a 365.");
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it.each([[0], [365]])("prazo %s, ponta do intervalo, chega à RPC", async (prazo) => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      editarItemDaJornada(ITEM, { titulo: "Kickoff", prazoEmDias: prazo, papel: "AM" }),
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("editar_item_da_jornada", {
      p_item_id: ITEM,
      p_titulo: "Kickoff",
      p_prazo_em_dias: prazo,
      p_papel: "AM",
    });
  });

  it("item: 42501 'forbidden' vira a frase de quem administra, e o code sobrevive", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden", code: "42501" } });

    const erro: unknown = await editarItemDaJornada(ITEM, {
      titulo: "Kickoff",
      prazoEmDias: 1,
      papel: "AM",
    }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({
      code: "42501",
      message: "Editar a jornada é do owner ou do responsável pelo cliente.",
    });
  });

  it("item: 22023 do banco passa com a frase dele (o positivo ao lado da tradução)", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'O papel "X" não existe. Escolha um dos papéis da lista.', code: "22023" },
    });

    await expect(
      editarItemDaJornada(ITEM, { titulo: "Kickoff", prazoEmDias: 1, papel: "X" }),
    ).rejects.toThrow('O papel "X" não existe. Escolha um dos papéis da lista.');
  });

  it("etapa: chama a RPC com descrição e responsável sem espaço nas pontas", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      editarEtapaDaJornada("e1", { descricao: " Nova descrição ", responsavel: " AM " }),
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("editar_etapa_da_jornada", {
      p_phase_id: "e1",
      p_descricao: "Nova descrição",
      p_responsavel: "AM",
    });
  });

  it("etapa: 42501 'forbidden' vira a mesma frase", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden", code: "42501" } });

    await expect(
      editarEtapaDaJornada("e1", { descricao: "Nova", responsavel: "AM" }),
    ).rejects.toThrow("Editar a jornada é do owner ou do responsável pelo cliente.");
  });

  it("etapa: P0002 passa com a frase do banco", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Etapa não encontrada. Recarregue a jornada.", code: "P0002" },
    });

    await expect(
      editarEtapaDaJornada("e1", { descricao: "Nova", responsavel: "AM" }),
    ).rejects.toThrow("Etapa não encontrada. Recarregue a jornada.");
  });
});
