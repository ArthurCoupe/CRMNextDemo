import { describe, expect, it } from "vitest";

import {
  concluidosNaEtapa,
  estadoDaEtapa,
  etapaCorrente,
  papeisComPessoaAtiva,
  papeisComPessoaDesativada,
  papeisExigidos,
  papeisSemPessoa,
  pendentesAntesDe,
  primeiraBloqueada,
  progressoDaJornada,
  proximaLiberavel,
  type EtapaDaJornada,
  type ItemDaJornada,
  type Jornada,
} from "./onboarding";

function item(p: Partial<ItemDaJornada> & { id: string }): ItemDaJornada {
  return {
    ordem: 0,
    titulo: "item",
    papel: "AM",
    prazoEmDias: 1,
    tarefaId: null,
    concluidoEm: null,
    ...p,
  };
}

function etapa(p: Partial<EtapaDaJornada> & { id: string; ordem: number }): EtapaDaJornada {
  return {
    nome: "Etapa",
    descricao: "",
    periodo: "",
    responsavel: "",
    liberadaEm: null,
    itens: [],
    ...p,
  };
}

function jornada(etapas: readonly EtapaDaJornada[]): Jornada {
  return {
    id: "j",
    clienteId: "c",
    cliente: "Cliente",
    versaoDoMetodo: 1,
    iniciadaEm: "2026-08-17T12:00:00Z",
    concluidaEm: null,
    etapas,
  };
}

const CONCLUIDO = "2026-08-18T12:00:00Z";

describe("estadoDaEtapa", () => {
  it("sem liberação é bloqueada, mesmo com item concluído", () => {
    const e = etapa({
      id: "e",
      ordem: 0,
      liberadaEm: null,
      itens: [item({ id: "i", concluidoEm: CONCLUIDO })],
    });
    expect(estadoDaEtapa(e)).toBe("bloqueada");
  });

  it("liberada com item pendente é liberada", () => {
    const e = etapa({
      id: "e",
      ordem: 0,
      liberadaEm: CONCLUIDO,
      itens: [item({ id: "a", concluidoEm: CONCLUIDO }), item({ id: "b" })],
    });
    expect(estadoDaEtapa(e)).toBe("liberada");
    expect(concluidosNaEtapa(e)).toBe(1);
  });

  it("liberada com todos concluídos é concluída", () => {
    const e = etapa({
      id: "e",
      ordem: 0,
      liberadaEm: CONCLUIDO,
      itens: [item({ id: "a", concluidoEm: CONCLUIDO }), item({ id: "b", concluidoEm: CONCLUIDO })],
    });
    expect(estadoDaEtapa(e)).toBe("concluida");
  });

  it("liberada e SEM ITENS não é concluída", () => {
    const e = etapa({ id: "e", ordem: 0, liberadaEm: CONCLUIDO, itens: [] });
    expect(estadoDaEtapa(e)).toBe("liberada");
  });
});

describe("progressoDaJornada — conta CONCLUÍDAS, não liberadas", () => {
  it("liberar uma etapa não move o número", () => {
    const antes = jornada([
      etapa({
        id: "0",
        ordem: 0,
        liberadaEm: CONCLUIDO,
        itens: [item({ id: "a", concluidoEm: CONCLUIDO })],
      }),
      etapa({ id: "1", ordem: 1 }),
    ]);
    expect(progressoDaJornada(antes)).toEqual({ concluidas: 1, total: 2 });

    const depoisDeLiberar = jornada([
      etapa({
        id: "0",
        ordem: 0,
        liberadaEm: CONCLUIDO,
        itens: [item({ id: "a", concluidoEm: CONCLUIDO })],
      }),
      etapa({ id: "1", ordem: 1, liberadaEm: CONCLUIDO, itens: [item({ id: "b" })] }),
    ]);
    expect(progressoDaJornada(depoisDeLiberar)).toEqual({ concluidas: 1, total: 2 });
  });

  it("jornada nova está em 0 de 8", () => {
    const j = jornada(Array.from({ length: 8 }, (_, i) => etapa({ id: String(i), ordem: i })));
    expect(progressoDaJornada(j)).toEqual({ concluidas: 0, total: 8 });
  });
});

describe("etapaCorrente", () => {
  it("é a primeira que não está concluída", () => {
    const j = jornada([
      etapa({
        id: "0",
        ordem: 0,
        liberadaEm: CONCLUIDO,
        itens: [item({ id: "a", concluidoEm: CONCLUIDO })],
      }),
      etapa({ id: "1", ordem: 1, liberadaEm: CONCLUIDO, itens: [item({ id: "b" })] }),
      etapa({ id: "2", ordem: 2 }),
    ]);
    expect(etapaCorrente(j)?.id).toBe("1");
  });

  it("é null quando tudo está concluído", () => {
    const j = jornada([
      etapa({
        id: "0",
        ordem: 0,
        liberadaEm: CONCLUIDO,
        itens: [item({ id: "a", concluidoEm: CONCLUIDO })],
      }),
    ]);
    expect(etapaCorrente(j)).toBeNull();
  });
});

describe("proximaLiberavel — não pula a fila", () => {
  it("na jornada nova, é a Etapa 0", () => {
    const j = jornada([etapa({ id: "0", ordem: 0 }), etapa({ id: "1", ordem: 1 })]);
    expect(proximaLiberavel(j)?.id).toBe("0");
  });

  it("com a anterior liberada mas incompleta, não libera a seguinte", () => {
    const j = jornada([
      etapa({ id: "0", ordem: 0, liberadaEm: CONCLUIDO, itens: [item({ id: "a" })] }),
      etapa({ id: "1", ordem: 1 }),
    ]);
    expect(proximaLiberavel(j)).toBeNull();
  });

  it("com a anterior concluída, libera a seguinte", () => {
    const j = jornada([
      etapa({
        id: "0",
        ordem: 0,
        liberadaEm: CONCLUIDO,
        itens: [item({ id: "a", concluidoEm: CONCLUIDO })],
      }),
      etapa({ id: "1", ordem: 1 }),
    ]);
    expect(proximaLiberavel(j)?.id).toBe("1");
  });

  it("com tudo liberado, não há próxima", () => {
    const j = jornada([
      etapa({ id: "0", ordem: 0, liberadaEm: CONCLUIDO, itens: [item({ id: "a" })] }),
    ]);
    expect(proximaLiberavel(j)).toBeNull();
  });

  it("não depende da ordem em que as etapas chegam da consulta", () => {
    const j = jornada([
      etapa({ id: "1", ordem: 1 }),
      etapa({
        id: "0",
        ordem: 0,
        liberadaEm: CONCLUIDO,
        itens: [item({ id: "a", concluidoEm: CONCLUIDO })],
      }),
    ]);
    expect(proximaLiberavel(j)?.id).toBe("1");
  });
});

describe("primeiraBloqueada — só nela o forçar avanço faz sentido", () => {
  const travada = jornada([
    etapa({ id: "0", ordem: 0, liberadaEm: CONCLUIDO, itens: [item({ id: "a" })] }),
    etapa({ id: "1", ordem: 1 }),
    etapa({ id: "2", ordem: 2 }),
    etapa({ id: "5", ordem: 5 }),
  ]);

  it("com a fila travada, proximaLiberavel é null — era daí que vinha o defeito", () => {
    expect(proximaLiberavel(travada)).toBeNull();
  });

  it("aponta UMA etapa, a de menor ordem ainda não liberada", () => {
    expect(primeiraBloqueada(travada)?.id).toBe("1");
  });

  it("não depende da ordem em que as etapas chegam", () => {
    const fora = jornada([
      etapa({ id: "5", ordem: 5 }),
      etapa({ id: "1", ordem: 1 }),
      etapa({ id: "0", ordem: 0, liberadaEm: CONCLUIDO, itens: [item({ id: "a" })] }),
    ]);
    expect(primeiraBloqueada(fora)?.id).toBe("1");
  });

  it("é null quando tudo já foi liberado", () => {
    const tudo = jornada([
      etapa({ id: "0", ordem: 0, liberadaEm: CONCLUIDO, itens: [item({ id: "a" })] }),
    ]);
    expect(primeiraBloqueada(tudo)).toBeNull();
  });
});

describe("pendentesAntesDe — o número que a pergunta de forçar avanço mostra", () => {
  it("é 0 na Etapa 0, que não tem anterior", () => {
    const j = jornada([etapa({ id: "0", ordem: 0 }), etapa({ id: "1", ordem: 1 })]);
    expect(pendentesAntesDe(j, j.etapas[0])).toBe(0);
  });

  it("conta os itens abertos da anterior liberada", () => {
    const j = jornada([
      etapa({
        id: "0",
        ordem: 0,
        liberadaEm: CONCLUIDO,
        itens: [item({ id: "a", concluidoEm: CONCLUIDO }), item({ id: "b" }), item({ id: "c" })],
      }),
      etapa({ id: "1", ordem: 1 }),
    ]);
    expect(pendentesAntesDe(j, j.etapas[1])).toBe(2);
  });

  it("é 0 quando a anterior está inteira concluída — não há o que forçar", () => {
    const j = jornada([
      etapa({
        id: "0",
        ordem: 0,
        liberadaEm: CONCLUIDO,
        itens: [item({ id: "a", concluidoEm: CONCLUIDO })],
      }),
      etapa({ id: "1", ordem: 1 }),
    ]);
    expect(pendentesAntesDe(j, j.etapas[1])).toBe(0);
  });

  it("com a anterior nem liberada, conta todos os itens dela", () => {
    const j = jornada([
      etapa({ id: "0", ordem: 0, liberadaEm: null, itens: [item({ id: "a" }), item({ id: "b" })] }),
      etapa({ id: "1", ordem: 1 }),
    ]);
    expect(pendentesAntesDe(j, j.etapas[1])).toBe(2);
  });
});

describe("papéis", () => {
  const e = etapa({
    id: "e",
    ordem: 3,
    itens: [
      item({ id: "a", papel: "Tráfego" }),
      item({ id: "b", papel: "AM" }),
      item({ id: "c", papel: "AM" }),
    ],
  });

  it("exigidos vêm sem repetição e ordenados", () => {
    expect(papeisExigidos(e)).toEqual(["AM", "Tráfego"]);
  });

  it("aponta só os que não têm pessoa", () => {
    expect(papeisSemPessoa(e, ["AM"])).toEqual(["Tráfego"]);
    expect(papeisSemPessoa(e, ["AM", "Tráfego"])).toEqual([]);
  });

  const configurados = [
    { papel: "AM", pessoaId: "u1", pessoaInativa: false },
    { papel: "Tráfego", pessoaId: "u2", pessoaInativa: true },
    { papel: "Copy", pessoaId: null, pessoaInativa: false },
  ];

  it("com pessoa ativa: pessoa desativada NÃO conta, como na guarda do banco", () => {
    expect(papeisComPessoaAtiva(configurados)).toEqual(["AM"]);
  });

  it("os desativados saem à parte, para a tela dizer que é troca e não configuração", () => {
    expect(papeisComPessoaDesativada(configurados)).toEqual(["Tráfego"]);
  });
});
