import { describe, expect, it } from "vitest";

import {
  agruparPorColuna,
  contarVencidas,
  destinoDoArrasto,
  diasDeAtraso,
  ehColuna,
  ehRecorrencia,
  ordenarTarefas,
  rotuloDeAtraso,
  tarefaVencida,
  type Tarefa,
} from "./task";

function tarefa(p: Partial<Tarefa> & { id: string }): Tarefa {
  return {
    titulo: "t",
    descricao: null,
    categoria: "Comercial · vendas",
    tipo: "Fazer follow-up",
    responsavelId: null,
    responsavel: null,
    clienteId: null,
    cliente: null,
    coluna: "todo",
    prioridade: "media",
    prazo: null,
    recorrencia: "nenhuma",
    raizRecorrente: null,
    criadoPor: null,
    participantes: [],
    links: [],
    pastaDoDriveDoCliente: null,
    ...p,
  };
}

describe("rotuloDeAtraso — o critério das 23h e da 01h", () => {
  const vencida = tarefa({ id: "1", prazo: "2026-08-12" });

  it("diz 3 dias às 23h de São Paulo", () => {
    expect(rotuloDeAtraso(vencida, new Date("2026-08-15T23:00:00-03:00"))).toBe(
      "vencida há 3 dias",
    );
  });

  it("diz 3 dias à 01h de São Paulo — mesmo dia civil, UTC já virou", () => {
    expect(rotuloDeAtraso(vencida, new Date("2026-08-15T01:00:00-03:00"))).toBe(
      "vencida há 3 dias",
    );
  });

  it("singular no primeiro dia", () => {
    expect(
      rotuloDeAtraso(
        tarefa({ id: "1", prazo: "2026-08-14" }),
        new Date("2026-08-15T12:00:00-03:00"),
      ),
    ).toBe("vencida há 1 dia");
  });

  it("hoje não está vencida, e amanhã também não", () => {
    const agora = new Date("2026-08-15T12:00:00-03:00");
    expect(rotuloDeAtraso(tarefa({ id: "1", prazo: "2026-08-15" }), agora)).toBeNull();
    expect(rotuloDeAtraso(tarefa({ id: "2", prazo: "2026-08-16" }), agora)).toBeNull();
  });

  it("sem prazo nunca vence", () => {
    expect(tarefaVencida(tarefa({ id: "1" }))).toBe(false);
    expect(diasDeAtraso(tarefa({ id: "1" }))).toBe(0);
  });

  it("concluída não vence — prazo passado de tarefa feita é história, não pendência", () => {
    const feita = tarefa({ id: "1", prazo: "2026-01-01", coluna: "done" });
    expect(tarefaVencida(feita, new Date("2026-08-15T12:00:00-03:00"))).toBe(false);
    expect(rotuloDeAtraso(feita, new Date("2026-08-15T12:00:00-03:00"))).toBeNull();
  });
});

describe("ordenarTarefas", () => {
  const agora = new Date("2026-08-15T12:00:00-03:00");

  it("vencida vem antes, mesmo com prioridade menor", () => {
    const r = ordenarTarefas(
      [
        tarefa({ id: "urgente-no-prazo", prioridade: "urgente", prazo: "2026-08-20" }),
        tarefa({ id: "baixa-vencida", prioridade: "baixa", prazo: "2026-08-10" }),
      ],
      agora,
    );
    expect(r.map((t) => t.id)).toEqual(["baixa-vencida", "urgente-no-prazo"]);
  });

  it("mais atrasada primeiro entre duas vencidas", () => {
    const r = ordenarTarefas(
      [tarefa({ id: "3dias", prazo: "2026-08-12" }), tarefa({ id: "10dias", prazo: "2026-08-05" })],
      agora,
    );
    expect(r.map((t) => t.id)).toEqual(["10dias", "3dias"]);
  });

  it("sem atraso, ordena por prioridade e depois por prazo", () => {
    const r = ordenarTarefas(
      [
        tarefa({ id: "media-cedo", prioridade: "media", prazo: "2026-08-16" }),
        tarefa({ id: "alta-tarde", prioridade: "alta", prazo: "2026-08-30" }),
        tarefa({ id: "alta-cedo", prioridade: "alta", prazo: "2026-08-20" }),
      ],
      agora,
    );
    expect(r.map((t) => t.id)).toEqual(["alta-cedo", "alta-tarde", "media-cedo"]);
  });

  it("sem prazo vai para o fim, não para o topo", () => {
    const r = ordenarTarefas(
      [
        tarefa({ id: "sem-prazo", prioridade: "alta" }),
        tarefa({ id: "com-prazo", prioridade: "alta", prazo: "2026-08-30" }),
      ],
      agora,
    );
    expect(r.map((t) => t.id)).toEqual(["com-prazo", "sem-prazo"]);
  });

  it("não muta a entrada", () => {
    const entrada = [
      tarefa({ id: "b", prioridade: "baixa" }),
      tarefa({ id: "a", prioridade: "alta" }),
    ];
    ordenarTarefas(entrada, agora);
    expect(entrada.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("agruparPorColuna", () => {
  it("devolve as QUATRO colunas mesmo vazias", () => {
    const g = agruparPorColuna([tarefa({ id: "1", coluna: "todo" })]);
    expect(Object.keys(g).sort()).toEqual(["doing", "done", "review", "todo"]);
    expect(g.review).toEqual([]);
  });

  it("separa e ordena dentro de cada coluna", () => {
    const agora = new Date("2026-08-15T12:00:00-03:00");
    const g = agruparPorColuna(
      [
        tarefa({ id: "a", coluna: "doing", prioridade: "baixa" }),
        tarefa({ id: "b", coluna: "doing", prioridade: "urgente" }),
        tarefa({ id: "c", coluna: "todo" }),
      ],
      agora,
    );
    expect(g.doing.map((t) => t.id)).toEqual(["b", "a"]);
    expect(g.todo.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("contarVencidas", () => {
  it("conta só as que estão vencidas e não concluídas", () => {
    const agora = new Date("2026-08-15T12:00:00-03:00");
    expect(
      contarVencidas(
        [
          tarefa({ id: "1", prazo: "2026-08-01" }),
          tarefa({ id: "2", prazo: "2026-08-01", coluna: "done" }),
          tarefa({ id: "3", prazo: "2026-09-01" }),
          tarefa({ id: "4" }),
        ],
        agora,
      ),
    ).toBe(1);
  });
});

describe("destinoDoArrasto — soltar o cartão numa coluna", () => {
  const lista = [tarefa({ id: "a", coluna: "todo" }), tarefa({ id: "b", coluna: "doing" })];

  it("soltar em outra coluna devolve a tarefa e o destino", () => {
    expect(destinoDoArrasto(lista, "a", "review")).toEqual({ id: "a", coluna: "review" });
  });

  it.each<[string, string | number, string | number | null | undefined]>([
    ["na mesma coluna", "a", "todo"],
    ["fora das colunas", "a", null],
    ["sem destino", "a", undefined],
    ["em alvo que não é coluna", "a", "b"],
    ["tarefa que saiu da lista", "z", "review"],
  ])("soltar %s não move", (_caso, ativo, sobre) => {
    expect(destinoDoArrasto(lista, ativo, sobre)).toBeNull();
  });
});

describe("ehColuna", () => {
  it("só as quatro colunas", () => {
    expect(["todo", "doing", "review", "done"].every(ehColuna)).toBe(true);
    expect([undefined, null, 1, "feito", ""].some(ehColuna)).toBe(false);
  });
});

describe("ehRecorrencia", () => {
  it("aceita as quatro recorrências", () => {
    expect(["nenhuma", "semanal", "quinzenal", "mensal"].every(ehRecorrencia)).toBe(true);
  });

  it("recusa texto fora da lista, vazio e chave herdada do objeto", () => {
    expect(
      ["diaria", "", "Semanal", "constructor", "toString", "urgente"].some(ehRecorrencia),
    ).toBe(false);
  });
});
