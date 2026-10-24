import { describe, expect, it } from "vitest";

import {
  filtroDeBUDisponivel,
  podeLerContratosDoCliente,
  podeTrocarResponsavel,
  type ContextoDeAcesso,
} from "./access";

const EU = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

const owner: ContextoDeAcesso = { papel: "owner", usuarioId: EU };
const manager: ContextoDeAcesso = { papel: "manager", usuarioId: EU };
const member: ContextoDeAcesso = { papel: "member", usuarioId: EU };
const carregando: ContextoDeAcesso = { papel: null, usuarioId: null };

describe("podeLerContratosDoCliente — espelha a RLS de contracts", () => {
  it("owner lê tudo", () => {
    expect(podeLerContratosDoCliente(owner, EU)).toBe(true);
    expect(podeLerContratosDoCliente(owner, OUTRO)).toBe(true);
    expect(podeLerContratosDoCliente(owner, null)).toBe(true);
  });

  it("manager lê só onde é o responsável", () => {
    expect(podeLerContratosDoCliente(manager, EU)).toBe(true);
    expect(podeLerContratosDoCliente(manager, OUTRO)).toBe(false);
  });

  it("cliente órfão não é lido por manager nenhum", () => {
    expect(podeLerContratosDoCliente(manager, null)).toBe(false);
  });

  it("member e sessão carregando não leem nada", () => {
    expect(podeLerContratosDoCliente(member, EU)).toBe(false);
    expect(podeLerContratosDoCliente(member, null)).toBe(false);
    expect(podeLerContratosDoCliente(carregando, EU)).toBe(false);
  });

  it("manager sem id de sessão não lê, mesmo com papel certo", () => {
    expect(podeLerContratosDoCliente({ papel: "manager", usuarioId: null }, EU)).toBe(false);
  });
});

describe("podeTrocarResponsavel — espelha a RLS de clients (migration 20260801052630)", () => {
  it("owner troca qualquer um", () => {
    expect(podeTrocarResponsavel(owner, EU).permitido).toBe(true);
    expect(podeTrocarResponsavel(owner, OUTRO).permitido).toBe(true);
    expect(podeTrocarResponsavel(owner, null).permitido).toBe(true);
  });

  it("manager troca o próprio cliente — entregar o bastão é permitido", () => {
    expect(podeTrocarResponsavel(manager, EU).permitido).toBe(true);
  });

  it("manager NÃO toma cliente de outro responsável", () => {
    const veredito = podeTrocarResponsavel(manager, OUTRO);
    expect(veredito.permitido).toBe(false);
    expect(veredito.permitido === false && veredito.motivo).toMatch(/outro responsável/i);
  });

  it("manager NÃO se atribui cliente órfão — isso concede leitura de contrato", () => {
    const veredito = podeTrocarResponsavel(manager, null);
    expect(veredito.permitido).toBe(false);
    expect(veredito.permitido === false && veredito.motivo).toMatch(/owner/i);
  });

  it("member nunca troca, e a recusa explica o porquê", () => {
    const veredito = podeTrocarResponsavel(member, EU);
    expect(veredito.permitido).toBe(false);
    expect(veredito.permitido === false && veredito.motivo.length).toBeGreaterThan(0);
  });

  it("sessão carregando não libera a escrita", () => {
    expect(podeTrocarResponsavel(carregando, EU).permitido).toBe(false);
    expect(podeTrocarResponsavel({ papel: "manager", usuarioId: null }, EU).permitido).toBe(false);
  });
});

describe("filtroDeBUDisponivel — BU é atributo do contrato, não do cliente", () => {
  it("owner filtra sem ressalva", () => {
    const d = filtroDeBUDisponivel(owner);
    expect(d.disponivel).toBe(true);
    expect(d.precisaDeAviso).toBe(false);
  });

  it("manager filtra, com aviso de que só enxerga a carteira dele", () => {
    const d = filtroDeBUDisponivel(manager);
    expect(d.disponivel).toBe(true);
    expect(d.precisaDeAviso).toBe(true);
    expect(d.motivo).not.toBeNull();
  });

  it("member não recebe o filtro, e sabe por quê", () => {
    const d = filtroDeBUDisponivel(member);
    expect(d.disponivel).toBe(false);
    expect(d.motivo).not.toBeNull();
  });

  it("sessão carregando não oferece o filtro", () => {
    expect(filtroDeBUDisponivel(carregando).disponivel).toBe(false);
  });
});
