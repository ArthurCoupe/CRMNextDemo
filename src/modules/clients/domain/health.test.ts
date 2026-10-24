import { describe, expect, it } from "vitest";

import {
  LIMIAR_DE_PAUSA_DIAS,
  avaliarSaude,
  montarEntradaDeSaude,
  clientStatusLabel,
  saudeEhParcial,
  severidadeGeral,
  type EntradaDeSaude,
  type StatusDeCliente,
} from "./health";

function saudavel(over: Partial<EntradaDeSaude> = {}): EntradaDeSaude {
  return {
    status: "active",
    diasSemContato: 2,
    diasParaFimDeCobranca: 200,
    diasDesdeEntrada: 400,
    diasPausado: null,
    temResponsavel: true,
    cobrancaVisivel: true,
    contratosAtivos: 1,
    ...over,
  };
}

const chaves = (entrada: EntradaDeSaude) => avaliarSaude(entrada).map((sinal) => sinal.chave);

describe("avaliarSaude — cliente sem problema", () => {
  it("não inventa sinal verde: lista vazia é a ausência de alarme", () => {
    expect(avaliarSaude(saudavel())).toEqual([]);
    expect(severidadeGeral([])).toBeNull();
  });
});

describe("sem responsável", () => {
  it("é crítico e explica que esconde o contrato do gestor", () => {
    const sinais = avaliarSaude(saudavel({ temResponsavel: false }));
    expect(sinais).toHaveLength(1);
    expect(sinais[0]!.chave).toBe("sem-responsavel");
    expect(sinais[0]!.severidade).toBe("critico");
    expect(sinais[0]!.detalhe).toMatch(/gestor/i);
  });
});

describe("dias sem contato", () => {
  it("21 dias é crítico — o padrão de quem cancela", () => {
    const sinais = avaliarSaude(saudavel({ diasSemContato: 21 }));
    expect(sinais[0]!.severidade).toBe("critico");
    expect(sinais[0]!.rotulo).toBe("21 dias sem contato");
  });

  it("14 dias é atenção", () => {
    expect(avaliarSaude(saudavel({ diasSemContato: 14 }))[0]!.severidade).toBe("atencao");
  });

  it("13 dias ainda não é sinal", () => {
    expect(chaves(saudavel({ diasSemContato: 13 }))).toEqual([]);
  });

  it("sem timeline não gera sinal", () => {
    expect(chaves(saudavel({ diasSemContato: null }))).toEqual([]);
  });
});

describe("fim de cobrança", () => {
  it("30 dias é atenção, 7 é crítico", () => {
    expect(avaliarSaude(saudavel({ diasParaFimDeCobranca: 30 }))[0]!.severidade).toBe("atencao");
    expect(avaliarSaude(saudavel({ diasParaFimDeCobranca: 7 }))[0]!.severidade).toBe("critico");
  });

  it("31 dias ainda não é sinal", () => {
    expect(chaves(saudavel({ diasParaFimDeCobranca: 31 }))).toEqual([]);
  });

  it("acaba hoje diz 'hoje', não 'em 0 dias'", () => {
    expect(avaliarSaude(saudavel({ diasParaFimDeCobranca: 0 }))[0]!.rotulo).toBe(
      "Cobrança acaba hoje",
    );
  });

  it("cobrança já encerrada é crítico e diz há quantos dias", () => {
    const sinais = avaliarSaude(saudavel({ diasParaFimDeCobranca: -12 }));
    expect(sinais[0]!.chave).toBe("cobranca-encerrada");
    expect(sinais[0]!.severidade).toBe("critico");
    expect(sinais[0]!.rotulo).toBe("Cobrança encerrada há 12 dias");
  });

  it("sem contrato com fim definido não gera sinal", () => {
    expect(chaves(saudavel({ diasParaFimDeCobranca: null }))).toEqual([]);
  });
});

describe("onboarding longo", () => {
  it("45 dias é crítico, 30 é atenção", () => {
    const critico = avaliarSaude(saudavel({ status: "onboarding", diasDesdeEntrada: 45 }));
    const atencao = avaliarSaude(saudavel({ status: "onboarding", diasDesdeEntrada: 30 }));
    expect(critico.find((s) => s.chave === "onboarding-longo")!.severidade).toBe("critico");
    expect(atencao.find((s) => s.chave === "onboarding-longo")!.severidade).toBe("atencao");
  });

  it("só vale no status onboarding", () => {
    expect(chaves(saudavel({ status: "active", diasDesdeEntrada: 400 }))).toEqual([]);
  });
});

describe("cliente pausado", () => {
  it("o limiar é nomeado no domínio: 30 dias", () => {
    expect(LIMIAR_DE_PAUSA_DIAS).toBe(30);
  });

  it("pausado há 29 dias não gera sinal de pausa", () => {
    expect(chaves(saudavel({ status: "paused", diasPausado: 29 }))).not.toContain("pausado");
  });

  it("pausado há 30 dias é atenção e diz há quantos dias", () => {
    const sinais = avaliarSaude(saudavel({ status: "paused", diasPausado: 30 }));
    const sinal = sinais.find((s) => s.chave === "pausado");
    expect(sinal?.severidade).toBe("atencao");
    expect(sinal?.rotulo).toBe("Pausado há 30 dias");
  });

  it("pausado há 200 dias continua atenção — não sobe para crítico", () => {
    const sinal = avaliarSaude(saudavel({ status: "paused", diasPausado: 200 })).find(
      (s) => s.chave === "pausado",
    );
    expect(sinal?.severidade).toBe("atencao");
    expect(sinal?.rotulo).toBe("Pausado há 200 dias");
  });

  it("pausado sem data-base alarma com data desconhecida", () => {
    const sinal = avaliarSaude(saudavel({ status: "paused", diasPausado: null })).find(
      (s) => s.chave === "pausado",
    );
    expect(sinal?.severidade).toBe("atencao");
    expect(sinal?.rotulo).toMatch(/data desconhecida/i);
  });

  it("o sinal de pausa só vale no status paused", () => {
    expect(chaves(saudavel({ status: "active", diasPausado: 200 }))).toEqual([]);
    expect(chaves(saudavel({ status: "onboarding", diasPausado: 200 }))).not.toContain("pausado");
  });
});

describe("cliente encerrado", () => {
  it("churned sem contrato cobrando não gera sinal nenhum, nem o de sem responsável", () => {
    expect(
      avaliarSaude({
        status: "churned",
        diasSemContato: 999,
        diasParaFimDeCobranca: -300,
        diasDesdeEntrada: 999,
        diasPausado: null,
        temResponsavel: false,
        cobrancaVisivel: true,
        contratosAtivos: 0,
      }),
    ).toEqual([]);
  });

  it("churned COM contrato cobrando gera um único sinal crítico, e mais nenhum", () => {
    const sinais = avaliarSaude({
      status: "churned",
      diasSemContato: 999,
      diasParaFimDeCobranca: -300,
      diasDesdeEntrada: 999,
      diasPausado: null,
      temResponsavel: false,
      cobrancaVisivel: true,
      contratosAtivos: 1,
    });
    expect(sinais).toHaveLength(1);
    expect(sinais[0]!.chave).toBe("encerrado-cobrando");
    expect(sinais[0]!.rotulo).toBe("Encerrado com cobrança ativa");
    expect(sinais[0]!.severidade).toBe("critico");
    expect(severidadeGeral(sinais)).toBe("critico");
  });
});

describe("acúmulo e ordenação", () => {
  it("acumula sinais e põe os críticos primeiro", () => {
    const sinais = avaliarSaude({
      status: "onboarding",
      diasSemContato: 15,
      diasParaFimDeCobranca: 3,
      diasDesdeEntrada: 50,
      diasPausado: null,
      temResponsavel: false,
      cobrancaVisivel: true,
      contratosAtivos: 1,
    });

    expect(sinais).toHaveLength(4);
    const severidades = sinais.map((s) => s.severidade);
    expect(severidades.slice(0, 3)).toEqual(["critico", "critico", "critico"]);
    expect(severidades[3]).toBe("atencao");
    expect(severidadeGeral(sinais)).toBe("critico");
  });

  it("severidadeGeral devolve atenção quando não há crítico", () => {
    const sinais = avaliarSaude(saudavel({ diasSemContato: 15 }));
    expect(severidadeGeral(sinais)).toBe("atencao");
  });
});

describe("clientStatusLabel", () => {
  it("cobre os 4 status sem cair em vazio", () => {
    const todos: StatusDeCliente[] = ["onboarding", "active", "paused", "churned"];
    for (const status of todos) {
      expect(clientStatusLabel(status)).toMatch(/\S/);
    }
    expect(clientStatusLabel("churned")).toBe("Encerrado");
  });
});

describe("montarEntradaDeSaude", () => {
  const AGORA = new Date("2026-07-31T12:00:00Z");

  it("converte as datas em dias com o sinal certo", () => {
    const entrada = montarEntradaDeSaude(
      {
        status: "active",
        ultimoEventoEm: "2026-07-10T12:00:00Z",
        proximoFimDeCobranca: "2026-08-12",
        assinadoEm: "2026-06-01",
        criadoEm: "2026-05-01T12:00:00Z",
        pausadoEm: null,
        responsavelId: "abc",
        contratosAtivosVisiveis: 1,
        cobrancaVisivel: true,
      },
      AGORA,
    );

    expect(entrada.diasSemContato).toBe(21);
    expect(entrada.diasParaFimDeCobranca).toBe(12);
    expect(entrada.diasDesdeEntrada).toBe(60);
    expect(entrada.diasPausado).toBeNull();
    expect(entrada.temResponsavel).toBe(true);
  });

  it("converte paused_at em dias pausado", () => {
    const entrada = montarEntradaDeSaude(
      {
        status: "paused",
        ultimoEventoEm: null,
        proximoFimDeCobranca: null,
        assinadoEm: null,
        criadoEm: "2026-01-01T12:00:00Z",
        pausadoEm: "2026-07-01",
        responsavelId: "abc",
        contratosAtivosVisiveis: 1,
        cobrancaVisivel: true,
      },
      AGORA,
    );
    expect(entrada.diasPausado).toBe(30);
    expect(avaliarSaude(entrada).map((s) => s.chave)).toEqual(["pausado"]);
  });

  it("cai para a criação quando não há assinatura", () => {
    const entrada = montarEntradaDeSaude(
      {
        status: "onboarding",
        ultimoEventoEm: null,
        proximoFimDeCobranca: null,
        assinadoEm: null,
        criadoEm: "2026-06-01T12:00:00Z",
        pausadoEm: null,
        responsavelId: null,
        contratosAtivosVisiveis: 1,
        cobrancaVisivel: true,
      },
      AGORA,
    );

    expect(entrada.diasDesdeEntrada).toBe(60);
    expect(entrada.diasSemContato).toBeNull();
    expect(entrada.diasParaFimDeCobranca).toBeNull();
    expect(entrada.temResponsavel).toBe(false);
  });

  it("alimenta avaliarSaude ponta a ponta: 60 dias em onboarding sem dono", () => {
    const sinais = avaliarSaude(
      montarEntradaDeSaude(
        {
          status: "onboarding",
          ultimoEventoEm: null,
          proximoFimDeCobranca: null,
          assinadoEm: null,
          criadoEm: "2026-06-01T12:00:00Z",
          pausadoEm: null,
          responsavelId: null,
          contratosAtivosVisiveis: 1,
          cobrancaVisivel: true,
        },
        AGORA,
      ),
    );

    expect(sinais.map((s) => s.chave).sort()).toEqual(["onboarding-longo", "sem-responsavel"]);
    expect(severidadeGeral(sinais)).toBe("critico");
  });
});

describe("cobrança invisível — ausência de sinal não é ausência de risco", () => {
  const AGORA = new Date("2026-07-31T12:00:00Z");

  const cobrancaVencida = {
    status: "active" as const,
    ultimoEventoEm: "2026-07-30T12:00:00Z",
    proximoFimDeCobranca: "2026-06-21",
    assinadoEm: "2026-01-01",
    criadoEm: "2026-01-01T12:00:00Z",
    pausadoEm: null,
    responsavelId: "outro-dono",
    contratosAtivosVisiveis: 1,
  };

  it("quem VÊ o contrato recebe o alarme", () => {
    const entrada = montarEntradaDeSaude({ ...cobrancaVencida, cobrancaVisivel: true }, AGORA);
    expect(entrada.diasParaFimDeCobranca).toBe(-40);
    expect(chaves(entrada)).toContain("cobranca-encerrada");
    expect(saudeEhParcial(entrada)).toBe(false);
  });

  it("quem NÃO vê o contrato não recebe alarme — mas a avaliação se declara parcial", () => {
    const entrada = montarEntradaDeSaude({ ...cobrancaVencida, cobrancaVisivel: false }, AGORA);
    expect(entrada.diasParaFimDeCobranca).toBeNull();
    expect(chaves(entrada)).not.toContain("cobranca-encerrada");
    expect(saudeEhParcial(entrada)).toBe(true);
  });

  it("a lacuna não vira sinal de risco", () => {
    const entrada = montarEntradaDeSaude(
      { ...cobrancaVencida, proximoFimDeCobranca: null, cobrancaVisivel: false },
      AGORA,
    );
    expect(avaliarSaude(entrada)).toEqual([]);
    expect(severidadeGeral(avaliarSaude(entrada))).toBeNull();
    expect(saudeEhParcial(entrada)).toBe(true);
  });

  it("os sinais que não vêm de contrato continuam valendo sem permissão", () => {
    const entrada = montarEntradaDeSaude(
      {
        status: "onboarding",
        ultimoEventoEm: "2026-07-01T12:00:00Z",
        proximoFimDeCobranca: "2026-08-02",
        assinadoEm: null,
        criadoEm: "2026-05-01T12:00:00Z",
        pausadoEm: null,
        responsavelId: null,
        contratosAtivosVisiveis: 1,
        cobrancaVisivel: false,
      },
      AGORA,
    );
    expect(chaves(entrada).sort()).toEqual(["onboarding-longo", "sem-contato", "sem-responsavel"]);
    expect(chaves(entrada)).not.toContain("renovacao");
    expect(saudeEhParcial(entrada)).toBe(true);
  });

  it("churned não é parcial, porque churned não avalia", () => {
    const entrada = montarEntradaDeSaude(
      { ...cobrancaVencida, status: "churned", cobrancaVisivel: false, contratosAtivosVisiveis: 0 },
      AGORA,
    );
    expect(avaliarSaude(entrada)).toEqual([]);
    expect(saudeEhParcial(entrada)).toBe(false);
  });
});
