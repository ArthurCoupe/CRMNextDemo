import { describe, expect, it } from "vitest";

import { DEFINA_EM_CONFIGURACOES, PECA_AO_OWNER, saidaDoAvisoDePapel } from "./aviso-de-papel";

describe("saidaDoAvisoDePapel", () => {
  it("owner vê a instrução, porque ele PODE entrar em Configurações", () => {
    expect(saidaDoAvisoDePapel(true, true)).toBe(DEFINA_EM_CONFIGURACOES);
  });

  it("quem não é owner é mandado ao owner, não a uma rota que devolve /acesso-negado", () => {
    expect(saidaDoAvisoDePapel(true, false)).toBe(PECA_AO_OWNER);
  });

  it("🔴 perfil em voo: nenhuma instrução — nem a do owner, nem a do resto", () => {
    expect(saidaDoAvisoDePapel(false, false)).toBeNull();
  });

  it("🔴 e em voo NÃO é a mesma coisa que não-owner, mesmo com ehOwner falso nos dois", () => {
    expect(saidaDoAvisoDePapel(false, false)).toBeNull();
    expect(saidaDoAvisoDePapel(true, false)).toBe(PECA_AO_OWNER);
  });

  it("perfil em voo vence, mesmo se ehOwner vier verdadeiro", () => {
    expect(saidaDoAvisoDePapel(false, true)).toBeNull();
  });

  it("owner inativo chega como não-owner porque a rota deriva de `papel`, não de `perfil.role`", () => {
    const owner = { role: "owner", active: false } as const;
    const papel = owner.active ? owner.role : null;

    expect(saidaDoAvisoDePapel(true, papel === "owner")).toBe(PECA_AO_OWNER);
    expect(saidaDoAvisoDePapel(true, owner.role === "owner")).toBe(DEFINA_EM_CONFIGURACOES);
  });

  it("as duas frases são diferentes — se colidirem, o teste do componente vira vácuo", () => {
    expect(DEFINA_EM_CONFIGURACOES).not.toBe(PECA_AO_OWNER);
    expect(PECA_AO_OWNER).toContain("Peça a ele");
    expect(DEFINA_EM_CONFIGURACOES).not.toContain("Peça a ele");
  });
});
