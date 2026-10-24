import { describe, expect, it } from "vitest";

import { COLUNAS_DE_TAREFA, ESTAGIOS, PAPEIS, STATUS_DE_CLIENTE, VOCABULARIO } from "./vocabulario";

describe("o vocabulário cita os quatro enums por inteiro", () => {
  it("os 8 estágios do pipeline", () => {
    expect(ESTAGIOS).toHaveLength(8);
    for (const estagio of ESTAGIOS) expect(VOCABULARIO).toContain(estagio);
  });

  it("os 8 estágios na ordem do funil", () => {
    expect(ESTAGIOS).toEqual([
      "prospeccao",
      "abordagem",
      "qualificacao",
      "r1",
      "r2",
      "fechado",
      "perdido",
      "descartado",
    ]);
  });

  it("os 4 papéis", () => {
    expect(PAPEIS).toHaveLength(4);
    for (const papel of PAPEIS) expect(VOCABULARIO).toContain(papel);
  });

  it("os 4 status de cliente", () => {
    expect(STATUS_DE_CLIENTE).toHaveLength(4);
    for (const status of STATUS_DE_CLIENTE) expect(VOCABULARIO).toContain(status);
  });

  it("as 4 colunas de tarefa", () => {
    expect(COLUNAS_DE_TAREFA).toHaveLength(4);
    for (const coluna of COLUNAS_DE_TAREFA) expect(VOCABULARIO).toContain(coluna);
  });
});

describe("as regras de negócio que o modelo não pode ignorar", () => {
  it("proíbe somar MRR com TCV num total geral", () => {
    expect(VOCABULARIO).toMatch(/mrr.*tcv.*nunca.*somad|nunca.*somad.*mrr.*tcv/is);
  });

  it("cita as 4 frentes com os números 01 a 04", () => {
    expect(VOCABULARIO).toContain("Frente 01 Posicionamento");
    expect(VOCABULARIO).toContain("Frente 02 Tráfego");
    expect(VOCABULARIO).toContain("Frente 03 Comercial");
    expect(VOCABULARIO).toContain("Frente 04 Sistemas");
  });

  it("instrui a não inventar número", () => {
    expect(VOCABULARIO).toMatch(/invente número/i);
  });
});

describe("o vocabulário carrega o significado, não só a lista", () => {
  it("cada estágio tem definição", () => {
    ESTAGIOS.forEach((estagio, i) => {
      expect(VOCABULARIO).toContain(`0${i + 1} ${estagio}: `);
    });
  });

  it("o prazo de primeiro contato que o CRM mede está escrito", () => {
    expect(VOCABULARIO).toContain(
      "O que o CRM mede no tempo até o primeiro contato: tráfego pago 5 min; indicação (parceria entra como indicação) e inbound 1h; outbound, lead sem canal e lead importado ficam sem prazo",
    );
  });

  it("perdido e descartado se distinguem pelo win rate", () => {
    expect(VOCABULARIO).toMatch(/perdido[\s\S]*ENTRA no cálculo de win rate/);
    expect(VOCABULARIO).toMatch(/descartado[\s\S]*NÃO entra no cálculo de win rate/);
  });

  it("diz qual frente é MRR e qual é TCV", () => {
    expect(VOCABULARIO).toContain("As frentes 01, 02 e 03 são MRR. A frente 04 é TCV de projeto.");
  });

  it("avisa que preço de tabela não é preço praticado", () => {
    expect(VOCABULARIO).toContain("preço de tabela não é preço praticado");
  });

  it('manda responder "não está definido" quando não houver fonte', () => {
    expect(VOCABULARIO).toContain('"não está definido"');
    expect(VOCABULARIO).toContain("NUNCA preencha com conhecimento genérico");
  });
});
