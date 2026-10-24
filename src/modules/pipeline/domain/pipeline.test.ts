import { describe, expect, it } from "vitest";

import {
  ehTipoDeEstagio,
  ehTipoTerminal,
  estagioCanonico,
  ordenarEstagios,
  problemasDosEstagios,
  problemasDosMotivos,
  type EstagioDoPipeline,
  type MotivoDeSaida,
} from "./pipeline";

const P = "10000000-0000-4000-8000-000000000001";

describe("ehTipoDeEstagio (narrowing do valor cru do Select)", () => {
  it("aceita os 8 valores do enum", () => {
    for (const tipo of [
      "prospeccao",
      "abordagem",
      "qualificacao",
      "r1",
      "r2",
      "fechado",
      "perdido",
      "descartado",
    ]) {
      expect(ehTipoDeEstagio(tipo)).toBe(true);
    }
  });

  it("🔴 recusa o que está fora do enum — inclusive maiúscula e vazio", () => {
    expect(ehTipoDeEstagio("invalido")).toBe(false);
    expect(ehTipoDeEstagio("Fechado")).toBe(false);
    expect(ehTipoDeEstagio("")).toBe(false);
  });
});
const e = (nome: string, ordem: number, tipo: EstagioDoPipeline["tipo"]): EstagioDoPipeline => ({
  id: nome,
  pipelineId: P,
  nome,
  ordem,
  tipo,
});
const COMPLETO = [
  e("Fechado", 6, "fechado"),
  e("Contato", 1, "prospeccao"),
  e("Perdido", 7, "perdido"),
  e("Descartado", 8, "descartado"),
  e("Proposta", 2, "r1"),
];

describe("invariantes de um pipeline (espelho de private.confere_invariantes_do_pipeline)", () => {
  it("pipeline completo não tem problema", () => {
    expect(problemasDosEstagios(COMPLETO)).toEqual([]);
  });

  it("🔴 sem 'fechado', ou com dois, acusa — o positivo acima é o controle", () => {
    expect(problemasDosEstagios(COMPLETO.filter((x) => x.tipo !== "fechado"))).toContain(
      "Falta um estágio do tipo fechado.",
    );
    expect(problemasDosEstagios([...COMPLETO, e("Fechado 2", 9, "fechado")])).toContain(
      "Só pode haver um estágio do tipo fechado.",
    );
  });

  it("sem estágio aberto acusa", () => {
    expect(
      problemasDosEstagios(
        COMPLETO.filter(
          (x) => x.tipo === "fechado" || x.tipo === "perdido" || x.tipo === "descartado",
        ),
      ),
    ).toContain("Falta pelo menos um estágio aberto.");
  });

  it("nome vazio e nome repetido (ignorando caixa e espaço) acusam", () => {
    expect(problemasDosEstagios([...COMPLETO, e("  ", 9, "r2")])).toContain("Estágio sem nome.");
    expect(problemasDosEstagios([...COMPLETO, e(" contato ", 9, "r2")])).toContain(
      "Dois estágios com o mesmo nome.",
    );
  });

  it("estágio canônico: menor ordem do tipo; sem o tipo aberto, o primeiro aberto", () => {
    expect(estagioCanonico(COMPLETO, "prospeccao")?.nome).toBe("Contato");
    expect(estagioCanonico(COMPLETO, "abordagem")?.nome).toBe("Contato");
    expect(estagioCanonico(COMPLETO, "fechado")?.nome).toBe("Fechado");
    expect(estagioCanonico([], "fechado")).toBeNull();
  });

  it("ordenar não muta e respeita ordem", () => {
    expect(ordenarEstagios(COMPLETO).map((x) => x.nome)).toEqual([
      "Contato",
      "Proposta",
      "Fechado",
      "Perdido",
      "Descartado",
    ]);
    expect(COMPLETO[0]?.nome).toBe("Fechado");
  });

  it("os três terminais são terminais; os cinco abertos não", () => {
    expect(ehTipoTerminal("fechado")).toBe(true);
    expect(ehTipoTerminal("perdido")).toBe(true);
    expect(ehTipoTerminal("descartado")).toBe(true);
    expect(ehTipoTerminal("prospeccao")).toBe(false);
    expect(ehTipoTerminal("r2")).toBe(false);
  });
});

const m = (
  rotulo: string,
  tipo: MotivoDeSaida["tipo"],
  ordem: number,
  ativo = true,
): MotivoDeSaida => ({ id: rotulo, pipelineId: P, tipo, rotulo, ordem, ativo });

const MOTIVOS = [m("Preço", "perda", 1), m("Sem verba", "descarte", 1)];

describe("problemasDosMotivos", () => {
  it("lista com um ativo de cada tipo não tem problema", () => {
    expect(problemasDosMotivos(MOTIVOS)).toEqual([]);
  });

  it("🔴 rótulo vazio acusa", () => {
    expect(problemasDosMotivos([...MOTIVOS, m(" ", "perda", 2)])).toContain("Motivo sem rótulo.");
  });

  it("🔴 rótulo repetido no MESMO tipo acusa — o mesmo rótulo em tipos diferentes é permitido", () => {
    expect(problemasDosMotivos([...MOTIVOS, m(" preço ", "perda", 2)])).toContain(
      "Dois motivos de perda com o mesmo rótulo.",
    );
    expect(problemasDosMotivos([...MOTIVOS, m("Preço", "descarte", 2)])).toEqual([]);
  });

  it("🔴 nenhum motivo ativo de um tipo acusa — inativo não conta", () => {
    expect(
      problemasDosMotivos([m("Preço", "perda", 1), m("Sem verba", "descarte", 1, false)]),
    ).toContain("Falta pelo menos um motivo ativo de descarte.");
    expect(problemasDosMotivos([m("Sem verba", "descarte", 1)])).toContain(
      "Falta pelo menos um motivo ativo de perda.",
    );
  });
});
