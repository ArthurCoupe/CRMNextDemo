import { describe, expect, it } from "vitest";

import {
  CATEGORIA_DO_ONBOARDING,
  ehDeOnboarding,
  podeApagar,
  podeArrastar,
  podeEditar,
  podeGerirParticipantes,
  podeTrocarResponsavel,
} from "./permissoes";
import type { Tarefa } from "./task";

function tarefa(p: Partial<Tarefa> = {}): Tarefa {
  return {
    id: "t1",
    titulo: "t",
    descricao: null,
    categoria: "Comercial · vendas",
    tipo: "Fazer follow-up",
    responsavelId: "resp",
    responsavel: "Resp",
    clienteId: null,
    cliente: null,
    coluna: "todo",
    prioridade: "media",
    prazo: null,
    recorrencia: "nenhuma",
    raizRecorrente: null,
    criadoPor: "autor",
    participantes: [{ id: "part", nome: "Part", ativo: true }],
    links: [],
    pastaDoDriveDoCliente: null,
    ...p,
  };
}

describe("podeEditar espelha a policy 'edita quem responde'", () => {
  it.each([
    ["owner", "qualquer"],
    ["manager", "qualquer"],
    ["member", "resp"],
    ["member", "part"],
  ])("%s (%s) edita", (papel, meuId) => {
    expect(podeEditar(tarefa(), papel, meuId)).toBe(true);
  });

  it.each<[string, string | null, string | null]>([
    ["member que não responde nem participa", "member", "outro"],
    ["responsável desativado (papel null)", null, "resp"],
    ["participante desativado (papel null)", null, "part"],
    ["conta client", "client", "resp"],
  ])("%s não edita", (_caso, papel, meuId) => {
    expect(podeEditar(tarefa(), papel, meuId)).toBe(false);
  });

  it("tarefa sem responsável e member sem sessão: null não casa com null", () => {
    expect(podeEditar(tarefa({ responsavelId: null, participantes: [] }), "member", null)).toBe(
      false,
    );
  });

  it("arrastar segue a mesma regra", () => {
    expect(podeArrastar).toBe(podeEditar);
  });
});

describe("podeGerirParticipantes espelha pode_gerir_participantes", () => {
  it.each([
    ["owner", "qualquer"],
    ["manager", "qualquer"],
    ["member", "resp"],
    ["member", "part"],
    ["member", "autor"],
  ])("%s (%s) inclui e remove participantes", (papel, meuId) => {
    expect(podeGerirParticipantes(tarefa(), papel, meuId)).toBe(true);
  });

  it("quem criou e não edita gere participantes, mas não edita a tarefa", () => {
    expect(podeGerirParticipantes(tarefa(), "member", "autor")).toBe(true);
    expect(podeEditar(tarefa(), "member", "autor")).toBe(false);
  });

  it.each<[string, Partial<Tarefa>, string | null, string | null]>([
    ["member que não criou, não responde nem participa", {}, "member", "outro"],
    ["autor desativado (papel null)", {}, null, "autor"],
    ["conta client carimbada como autora", {}, "client", "autor"],
    ["tarefa sem autor e member sem sessão", { criadoPor: null }, "member", null],
  ])("%s não gere participantes", (_caso, p, papel, meuId) => {
    expect(podeGerirParticipantes(tarefa(p), papel, meuId)).toBe(false);
  });

  it("🔴 card de onboarding: quem criou e não edita não gere; o responsável gere (o positivo ao lado)", () => {
    const onboarding = tarefa({ categoria: "Onboarding · método" });
    expect(podeGerirParticipantes(onboarding, "member", "autor")).toBe(false);
    expect(podeGerirParticipantes(onboarding, "member", "resp")).toBe(true);
  });
});

describe("podeTrocarResponsavel: só owner e manager", () => {
  it.each<[string | null, boolean]>([
    ["owner", true],
    ["manager", true],
    ["member", false],
    ["client", false],
    [null, false],
  ])("%s → %s", (papel, esperado) => {
    expect(podeTrocarResponsavel(papel)).toBe(esperado);
  });
});

describe("podeApagar espelha 'owner, manager e quem criou apagam'", () => {
  it("owner apaga, inclusive card de onboarding", () => {
    expect(podeApagar(tarefa({ categoria: CATEGORIA_DO_ONBOARDING }), "owner", "outro")).toBe(true);
  });

  it("manager apaga a tarefa comum", () => {
    expect(podeApagar(tarefa(), "manager", "outro")).toBe(true);
  });

  it("manager vê Apagar no card de onboarding (o banco ainda recusa se o cliente for de outro manager)", () => {
    expect(podeApagar(tarefa({ categoria: CATEGORIA_DO_ONBOARDING }), "manager", "outro")).toBe(
      true,
    );
  });

  it("member apaga a tarefa que criou", () => {
    expect(podeApagar(tarefa(), "member", "autor")).toBe(true);
  });

  it.each<[string, Partial<Tarefa>, string | null, string | null]>([
    ["member que não criou", {}, "member", "resp"],
    [
      "member que criou o card de onboarding",
      { categoria: CATEGORIA_DO_ONBOARDING },
      "member",
      "autor",
    ],
    ["autor desativado (papel null)", {}, null, "autor"],
    ["tarefa sem autor e member sem sessão", { criadoPor: null }, "member", null],
  ])("%s não apaga", (_caso, p, papel, meuId) => {
    expect(podeApagar(tarefa(p), papel, meuId)).toBe(false);
  });
});

describe("ehDeOnboarding", () => {
  it("a categoria é a do catálogo do onboarding (F17)", () => {
    expect(CATEGORIA_DO_ONBOARDING).toBe("Onboarding · método");
    expect(ehDeOnboarding(tarefa({ categoria: "Onboarding · método" }))).toBe(true);
    expect(ehDeOnboarding(tarefa({ categoria: "Site · web" }))).toBe(false);
  });
});
