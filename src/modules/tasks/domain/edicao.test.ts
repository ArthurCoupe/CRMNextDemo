import { describe, expect, it } from "vitest";

import { rascunhoDe, validarEdicao, type RascunhoDaTarefa } from "./edicao";
import type { Tarefa } from "./task";

const TAREFA: Tarefa = {
  id: "t1",
  titulo: "Revisar contrato",
  descricao: "Ligar antes",
  categoria: "Comercial",
  tipo: "Follow-up",
  responsavelId: "user-1",
  responsavel: "Fulano",
  clienteId: "c1",
  cliente: "Acme",
  coluna: "todo",
  prioridade: "media",
  prazo: "2026-09-10",
  recorrencia: "nenhuma",
  raizRecorrente: null,
  criadoPor: null,
  participantes: [],
  links: [],
  pastaDoDriveDoCliente: null,
};

const INICIAL = rascunhoDe(TAREFA);
const com = (p: Partial<RascunhoDaTarefa>): RascunhoDaTarefa => ({ ...INICIAL, ...p });

describe("rascunhoDe", () => {
  it("nulo vira string vazia, para o campo de formulário", () => {
    expect(
      rascunhoDe({ ...TAREFA, descricao: null, prazo: null, clienteId: null, responsavelId: null }),
    ).toEqual({
      titulo: "Revisar contrato",
      descricao: "",
      categoria: "Comercial",
      tipo: "Follow-up",
      prioridade: "media",
      prazo: "",
      clienteId: "",
      responsavelId: "",
      recorrencia: "nenhuma",
    });
  });
});

describe("validarEdicao manda só o que mudou", () => {
  it("nada mudou: alteração vazia", () => {
    expect(validarEdicao(INICIAL, INICIAL)).toEqual({ ok: true, alteracao: {} });
  });

  it("título: sem espaço nas pontas, e só ele", () => {
    expect(validarEdicao(INICIAL, com({ titulo: "  Novo  " }))).toEqual({
      ok: true,
      alteracao: { titulo: "Novo" },
    });
  });

  it("título só com espaço nas pontas a mais não é mudança", () => {
    expect(validarEdicao(INICIAL, com({ titulo: " Revisar contrato " }))).toEqual({
      ok: true,
      alteracao: {},
    });
  });

  it("🔴 título em branco recusa", () => {
    expect(validarEdicao(INICIAL, com({ titulo: "   " }))).toEqual({
      ok: false,
      erro: "O título da tarefa não pode ficar em branco.",
    });
  });

  it("🔴 categoria trocada sem tipo recusa", () => {
    expect(validarEdicao(INICIAL, com({ categoria: "Site · web", tipo: "" }))).toEqual({
      ok: false,
      erro: "Escolha o tipo da tarefa.",
    });
  });

  it("categoria e tipo vão juntos, mesmo quando só o tipo mudou (a FK é composta)", () => {
    expect(validarEdicao(INICIAL, com({ tipo: "Proposta" }))).toEqual({
      ok: true,
      alteracao: { categoria: "Comercial", tipo: "Proposta" },
    });
  });

  it("descrição apagada vira null; com espaço nas pontas, limpa", () => {
    expect(validarEdicao(INICIAL, com({ descricao: "  " }))).toEqual({
      ok: true,
      alteracao: { descricao: null },
    });
    expect(validarEdicao(INICIAL, com({ descricao: "  Outra  " }))).toEqual({
      ok: true,
      alteracao: { descricao: "Outra" },
    });
  });

  it("🔴 descrição acima de 2000 recusa com a contagem; 2000 exatos passam", () => {
    expect(validarEdicao(INICIAL, com({ descricao: "x".repeat(2001) }))).toEqual({
      ok: false,
      erro: "Descrição com 2001 caracteres: o limite é 2000. Encurte para gravar.",
    });
    expect(validarEdicao(INICIAL, com({ descricao: "x".repeat(2000) }))).toEqual({
      ok: true,
      alteracao: { descricao: "x".repeat(2000) },
    });
  });

  it("🔴 prazo com ano pela metade recusa; prazo apagado vira null", () => {
    expect(validarEdicao(INICIAL, com({ prazo: "0002-09-10" }))).toEqual({
      ok: false,
      erro: "Prazo inválido. Use um ano entre 2000 e 2100.",
    });
    expect(validarEdicao(INICIAL, com({ prazo: "" }))).toEqual({
      ok: true,
      alteracao: { prazo: null },
    });
  });

  it("cliente, responsável e prioridade", () => {
    expect(
      validarEdicao(INICIAL, com({ clienteId: "", responsavelId: "user-2", prioridade: "alta" })),
    ).toEqual({
      ok: true,
      alteracao: { clienteId: null, responsavelId: "user-2", prioridade: "alta" },
    });
  });

  it("prazo novo e válido entra na alteração", () => {
    expect(validarEdicao(INICIAL, com({ prazo: "2026-10-15" }))).toEqual({
      ok: true,
      alteracao: { prazo: "2026-10-15" },
    });
  });

  it("categoria e tipo trocados juntos vão juntos", () => {
    expect(
      validarEdicao(INICIAL, com({ categoria: "Site · web", tipo: "Desenvolver site" })),
    ).toEqual({
      ok: true,
      alteracao: { categoria: "Site · web", tipo: "Desenvolver site" },
    });
  });

  it("responsável limpo vira null na alteração", () => {
    expect(validarEdicao(INICIAL, com({ responsavelId: "" }))).toEqual({
      ok: true,
      alteracao: { responsavelId: null },
    });
  });

  it("cliente trocado por outro entra na alteração", () => {
    expect(validarEdicao(INICIAL, com({ clienteId: "c2" }))).toEqual({
      ok: true,
      alteracao: { clienteId: "c2" },
    });
  });

  it("A1.3: recorrência trocada entra na alteração", () => {
    expect(validarEdicao(INICIAL, com({ recorrencia: "mensal" }))).toEqual({
      ok: true,
      alteracao: { recorrencia: "mensal" },
    });
  });

  it("A1.3: voltar para nenhuma também é escrita (para a corrente)", () => {
    const MENSAL = rascunhoDe({ ...TAREFA, recorrencia: "mensal" });
    expect(validarEdicao(MENSAL, { ...MENSAL, recorrencia: "nenhuma" })).toEqual({
      ok: true,
      alteracao: { recorrencia: "nenhuma" },
    });
  });

  it("A1.3: recorrência igual não entra", () => {
    expect(validarEdicao(INICIAL, com({ recorrencia: "nenhuma" }))).toEqual({
      ok: true,
      alteracao: {},
    });
  });
});

describe("validarEdicao não cobra o que a pessoa não tocou", () => {
  const LEGADA = rascunhoDe({ ...TAREFA, descricao: "x".repeat(2001) });
  const PRAZO_LEGADO = rascunhoDe({ ...TAREFA, prazo: "0002-09-10" });

  it("🔴 descrição antiga com 2001 caracteres, intacta: trocar o título salva só o título", () => {
    expect(validarEdicao(LEGADA, { ...LEGADA, titulo: "Novo" })).toEqual({
      ok: true,
      alteracao: { titulo: "Novo" },
    });
  });

  it("o negativo ao lado: mexer nessa descrição e deixá-la acima de 2000 recusa", () => {
    expect(validarEdicao(LEGADA, { ...LEGADA, descricao: "y".repeat(2002) })).toEqual({
      ok: false,
      erro: "Descrição com 2002 caracteres: o limite é 2000. Encurte para gravar.",
    });
  });

  it("🔴 prazo antigo fora do intervalo, intacto: trocar o título salva só o título", () => {
    expect(validarEdicao(PRAZO_LEGADO, { ...PRAZO_LEGADO, titulo: "Novo" })).toEqual({
      ok: true,
      alteracao: { titulo: "Novo" },
    });
  });

  it("o negativo ao lado: mexer nesse prazo e deixá-lo fora do intervalo recusa", () => {
    expect(validarEdicao(PRAZO_LEGADO, { ...PRAZO_LEGADO, prazo: "0003-09-10" })).toEqual({
      ok: false,
      erro: "Prazo inválido. Use um ano entre 2000 e 2100.",
    });
  });
});
