import { describe, expect, it } from "vitest";

import { Constants } from "@/shared/types/database.types";

import {
  contractStatusLabel,
  exigeDecisaoAoReativar,
  exigeDecisaoDeCobranca,
  FRENTES_DE_SERVICO,
  frenteCombinaComLinhaDeNegocio,
  frenteLabel,
  linhaDeNegocioDaFrente,
  linhaDeNegocioLabel,
  problemaNasFrentesDoCombo,
  type FrenteDeServico,
  type LinhaDeNegocio,
  type StatusDeContrato,
} from "./contract";

describe("rótulos", () => {
  it("cobre os 4 status sem cair em vazio", () => {
    const todos: StatusDeContrato[] = ["active", "paused", "cancelled", "finished"];
    for (const status of todos) {
      expect(contractStatusLabel(status)).toMatch(/\S/);
    }
    expect(contractStatusLabel("paused")).toBe("Pausado");
  });

  it("cobre as 4 frentes", () => {
    const todas: FrenteDeServico[] = ["posicionamento", "trafego", "comercial", "sistemas"];
    for (const frente of todas) {
      expect(frenteLabel(frente)).toMatch(/\S/);
    }
    expect(frenteLabel("trafego")).toBe("Tráfego");
  });

  it("a lista das frentes tem as quatro, na ordem da tela, cada uma com rótulo", () => {
    expect(FRENTES_DE_SERVICO).toEqual(["posicionamento", "trafego", "comercial", "sistemas"]);
    expect(new Set(FRENTES_DE_SERVICO).size).toBe(FRENTES_DE_SERVICO.length);
    for (const frente of FRENTES_DE_SERVICO) {
      expect(frenteLabel(frente)).toMatch(/\S/);
    }
    expect(new Set(FRENTES_DE_SERVICO)).toEqual(new Set(Constants.public.Enums.service_front));
  });

  it("cobre as 3 linhas de negócio", () => {
    const todas: LinhaDeNegocio[] = ["demanda", "sistemas", "compartilhado"];
    for (const bu of todas) {
      expect(linhaDeNegocioLabel(bu)).toMatch(/\S/);
    }
  });
});

describe("coerência entre frente e linha de negócio", () => {
  it("as três frentes de Demanda pertencem a Demanda", () => {
    expect(linhaDeNegocioDaFrente("posicionamento")).toBe("demanda");
    expect(linhaDeNegocioDaFrente("trafego")).toBe("demanda");
    expect(linhaDeNegocioDaFrente("comercial")).toBe("demanda");
  });

  it("a frente de Sistemas pertence a Sistemas", () => {
    expect(linhaDeNegocioDaFrente("sistemas")).toBe("sistemas");
  });

  it("aceita a combinação correta", () => {
    expect(frenteCombinaComLinhaDeNegocio("trafego", "demanda")).toBe(true);
    expect(frenteCombinaComLinhaDeNegocio("sistemas", "sistemas")).toBe(true);
  });

  it("recusa o cruzamento que faz v_revenue_by_front mentir", () => {
    expect(frenteCombinaComLinhaDeNegocio("trafego", "sistemas")).toBe(false);
    expect(frenteCombinaComLinhaDeNegocio("sistemas", "demanda")).toBe(false);
  });

  it("nenhuma frente pertence a compartilhado", () => {
    const todas: FrenteDeServico[] = ["posicionamento", "trafego", "comercial", "sistemas"];
    for (const frente of todas) {
      expect(frenteCombinaComLinhaDeNegocio(frente, "compartilhado")).toBe(false);
    }
  });
});

describe("exigeDecisaoDeCobranca", () => {
  it("exige decisão ao pausar — é o addendum D4", () => {
    expect(exigeDecisaoDeCobranca("paused")).toBe(true);
  });

  it("exige decisão ao encerrar e ao cancelar", () => {
    expect(exigeDecisaoDeCobranca("finished")).toBe(true);
    expect(exigeDecisaoDeCobranca("cancelled")).toBe(true);
  });

  it("não exige em contrato ativo — o padrão é continuar cobrando", () => {
    expect(exigeDecisaoDeCobranca("active")).toBe(false);
  });

  it("pergunta, nunca decide — não existe status que implique cobrança encerrada", () => {
    const todos: StatusDeContrato[] = ["active", "paused", "cancelled", "finished"];
    for (const status of todos) {
      expect(typeof exigeDecisaoDeCobranca(status)).toBe("boolean");
    }
    expect(exigeDecisaoDeCobranca("finished")).not.toBe("false");
  });
});

describe("exigeDecisaoAoReativar", () => {
  it("exige decisão ao voltar para ativo com a cobrança original desligada", () => {
    expect(exigeDecisaoAoReativar("active", false)).toBe(true);
  });

  it("não exige quando a cobrança original já estava ligada", () => {
    expect(exigeDecisaoAoReativar("active", true)).toBe(false);
  });

  it("fora do status ativo não exige, mesmo com a cobrança original desligada", () => {
    expect(exigeDecisaoAoReativar("paused", false)).toBe(false);
    expect(exigeDecisaoAoReativar("finished", false)).toBe(false);
    expect(exigeDecisaoAoReativar("cancelled", false)).toBe(false);
  });
});

describe("problemaNasFrentesDoCombo", () => {
  it("as três frentes de Demanda num combo de Demanda passam", () => {
    expect(
      problemaNasFrentesDoCombo(["posicionamento", "trafego", "comercial"], "demanda"),
    ).toBeNull();
  });

  it("🔴 combo sem frente nenhuma não grava: viraria produto avulso em silêncio", () => {
    expect(problemaNasFrentesDoCombo([], "demanda")).toBe("Marque pelo menos uma frente do combo.");
  });

  it("🔴 frente de outra linha de negócio não grava", () => {
    expect(problemaNasFrentesDoCombo(["posicionamento", "sistemas"], "demanda")).toBe(
      "Sistemas não é da linha Demanda: o contrato recusaria o item.",
    );
  });

  it("duas frentes de fora: a frase fica no plural", () => {
    expect(problemaNasFrentesDoCombo(["trafego", "comercial"], "sistemas")).toBe(
      "Tráfego, Comercial não são da linha Sistemas: o contrato recusaria o item.",
    );
  });
});
