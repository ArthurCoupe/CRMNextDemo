import { describe, expect, it } from "vitest";

import type {
  EtapaDaJornada,
  ItemDaJornada,
  Jornada,
} from "@/modules/onboarding/domain/onboarding";
import { rotuloDoCanal } from "@/modules/pipeline/domain/channel";
import { formatDate, formatDateTime } from "@/shared/lib/date";
import { brl } from "@/shared/lib/format";

import {
  cortarTexto,
  FRASES,
  LIMITE_DE_EVENTOS,
  LIMITE_DE_REUNIOES_ANTERIORES,
  LIMITE_DE_TAREFAS,
  LIMITE_DE_TEXTO,
  montarFicha,
  type ClienteDaFicha,
  type ContextoDaFicha,
  type ContratoDaFicha,
  type DadosDaPreparacao,
  type EventoDaFicha,
  type OportunidadeDaFicha,
  type ReuniaoAnterior,
  type Secao,
  type TarefaDaFicha,
} from "./preparacao";

const OPP = "0a000000-0000-4000-8000-000000000001";
const CLI = "0b000000-0000-4000-8000-000000000001";
const JOR = "0c000000-0000-4000-8000-000000000001";

const OWNER: ContextoDaFicha = {
  papel: "owner",
  hoje: new Date("2026-09-30T15:00:00.000Z"),
  segundoFator: "ok",
};
const MANAGER: ContextoDaFicha = { ...OWNER, papel: "manager" };
const MEMBER: ContextoDaFicha = { ...OWNER, papel: "member" };

function dados(over: Partial<DadosDaPreparacao> = {}): DadosDaPreparacao {
  return {
    oportunidadeId: null,
    oportunidade: null,
    eventos: [],
    respostas: [],
    catalogo: null,
    clienteId: null,
    cliente: null,
    contratos: null,
    jornada: null,
    tarefas: [],
    reunioesAnteriores: [],
    ...over,
  };
}

function oportunidade(over: Partial<OportunidadeDaFicha> = {}): OportunidadeDaFicha {
  return {
    id: OPP,
    nome: "Academia Corpo",
    segmento: "Fitness",
    nicho: "Academia",
    estagioNome: "R1",
    responsavelNome: "Ana",
    contatoNome: "Rita",
    contatoEmail: "rita@exemplo.invalido",
    contatoTelefone: "11 98888-7777",
    origem: "Google",
    canal: "inbound",
    valorEstimado: 2500,
    proximoFollowUp: "2026-10-03",
    r1AgendadaEm: "2026-09-20T03:00:00.000Z",
    r1RealizadaEm: null,
    r2AgendadaEm: null,
    r2RealizadaEm: null,
    ...over,
  };
}

function cliente(over: Partial<ClienteDaFicha> = {}): ClienteDaFicha {
  return {
    id: CLI,
    nome: "Acme",
    status: "active",
    segmento: "Varejo",
    nicho: "Óptica",
    contatoNome: "Bia",
    contatoEmail: null,
    contatoTelefone: null,
    responsavelId: "0d000000-0000-4000-8000-000000000001",
    responsavelNome: "Ana",
    assinadoEm: "2026-08-01",
    confidencial: false,
    ...over,
  };
}

const MRR: ContratoDaFicha = {
  id: "0e000000-0000-4000-8000-000000000001",
  nome: "Tráfego mensal",
  tipo: "mrr",
  linhaDeNegocio: "demanda",
  valorMensal: 3500,
  valorTotal: null,
  mesesDeCobranca: null,
  inicio: "2026-08-01",
};

const TCV: ContratoDaFicha = {
  id: "0e000000-0000-4000-8000-000000000002",
  nome: "Sistema de agendamento",
  tipo: "tcv",
  linhaDeNegocio: "sistemas",
  valorMensal: null,
  valorTotal: 48000,
  mesesDeCobranca: 6,
  inicio: "2026-09-01",
};

const EVENTO: EventoDaFicha = {
  id: "0f000000-0000-4000-8000-000000000001",
  tipo: "call",
  conteudo: "Falou com a Rita",
  autorNome: "Ana",
  criadoEm: "2026-09-21T12:00:00.000Z",
};

const RESPOSTA = { questionKey: "orcamento", optionIndex: 0, points: 2, isKo: false };

const CATALOGO = {
  version: 1,
  questions: [
    {
      key: "orcamento",
      label: "Orçamento",
      prompt: "Qual?",
      options: [
        { label: "Acima de 5 mil", points: 2 },
        { label: "Sem verba", points: 0, ko: true },
      ],
    },
    { key: "decisor", label: "Decisor", prompt: "Quem?", options: [{ label: "Sócio", points: 2 }] },
  ],
};

const TAREFA: TarefaDaFicha = {
  id: "1a000000-0000-4000-8000-000000000001",
  titulo: "Relatório mensal",
  prazo: "2026-10-02",
  responsavelNome: "Ana",
};

const ANTERIOR: ReuniaoAnterior = {
  id: "1b000000-0000-4000-8000-000000000001",
  titulo: "Kickoff",
  tipo: "kickoff_cliente",
  startsAt: "2026-09-01T13:00:00.000Z",
  notas: "Combinou metas",
};

function item(id: string, concluido: boolean): ItemDaJornada {
  return {
    id,
    ordem: 1,
    titulo: "Item",
    papel: "CS",
    prazoEmDias: 1,
    tarefaId: null,
    concluidoEm: concluido ? "2026-09-20T12:00:00.000Z" : null,
  };
}

function etapa(
  id: string,
  ordem: number,
  nome: string,
  liberada: boolean,
  itens: ItemDaJornada[],
): EtapaDaJornada {
  return {
    id,
    ordem,
    nome,
    descricao: "",
    periodo: "",
    responsavel: "CS",
    liberadaEm: liberada ? "2026-09-10T12:00:00.000Z" : null,
    itens,
  };
}

function jornada(etapas: EtapaDaJornada[], concluidaEm: string | null = null): Jornada {
  return {
    id: JOR,
    clienteId: CLI,
    cliente: "Acme",
    versaoDoMetodo: 1,
    iniciadaEm: "2026-09-10T12:00:00.000Z",
    concluidaEm,
    etapas,
  };
}

function secao(secoes: readonly Secao[], chave: Secao["chave"]): Secao {
  const achada = secoes.find((s) => s.chave === chave);
  if (achada === undefined) throw new Error(`a ficha não tem a seção ${chave}`);
  return achada;
}

const textos = (s: Secao) => s.linhas.map((l) => l.texto);

const comCliente = (over: Partial<DadosDaPreparacao> = {}) =>
  dados({ clienteId: CLI, cliente: cliente(), contratos: [], ...over });

const comLead = (over: Partial<DadosDaPreparacao> = {}) =>
  dados({ oportunidadeId: OPP, oportunidade: oportunidade(), ...over });

describe("seções conforme o vínculo (critério 3)", () => {
  it("reunião com lead: Lead, Qualificação, Últimos toques e Reuniões anteriores", () => {
    expect(montarFicha(comLead(), OWNER).map((s) => s.chave)).toEqual([
      "lead",
      "qualificacao",
      "toques",
      "reunioes",
    ]);
  });

  it("reunião com cliente: Cliente, Contratos, Onboarding, Tarefas abertas e Reuniões anteriores", () => {
    expect(montarFicha(comCliente(), OWNER).map((s) => s.chave)).toEqual([
      "cliente",
      "contratos",
      "onboarding",
      "tarefas",
      "reunioes",
    ]);
  });

  it("com os dois: as oito, lead primeiro", () => {
    const ambos = dados({
      ...comLead(),
      clienteId: CLI,
      cliente: cliente(),
      contratos: [],
    });
    expect(montarFicha(ambos, OWNER).map((s) => s.chave)).toEqual([
      "lead",
      "qualificacao",
      "toques",
      "cliente",
      "contratos",
      "onboarding",
      "tarefas",
      "reunioes",
    ]);
  });

  it("sem vínculo nenhum: só Reuniões anteriores, sem lançar", () => {
    expect(montarFicha(dados(), OWNER).map((s) => s.chave)).toEqual(["reunioes"]);
  });
});

describe("lead ou cliente que não volta da leitura (critério 13)", () => {
  it("lead ausente: a seção diz, e Qualificação e Toques saem", () => {
    const secoes = montarFicha(dados({ oportunidadeId: OPP }), OWNER);
    expect(secoes.map((s) => s.chave)).toEqual(["lead", "reunioes"]);
    expect(secao(secoes, "lead")).toMatchObject({ linhas: [], vazio: FRASES.leadNaoEncontrado });
  });

  it("cliente ausente: a seção diz, e Contratos, Onboarding e Tarefas saem", () => {
    const secoes = montarFicha(dados({ clienteId: CLI }), OWNER);
    expect(secoes.map((s) => s.chave)).toEqual(["cliente", "reunioes"]);
    expect(secao(secoes, "cliente")).toMatchObject({
      linhas: [],
      vazio: FRASES.clienteNaoEncontrado,
    });
  });
});

describe("linhas do lead e do cliente", () => {
  it("lead: um dado por linha, valor em brl e datas em São Paulo", () => {
    const lead = secao(montarFicha(comLead(), OWNER), "lead");
    expect(lead.titulo).toBe("Lead · Academia Corpo");
    expect(textos(lead)).toEqual([
      "Contato: Rita · rita@exemplo.invalido · 11 98888-7777",
      "Etapa: R1",
      "Responsável: Ana",
      "Nicho e segmento: Academia · Fitness",
      `Origem e canal: Google · ${rotuloDoCanal("inbound")}`,
      `Valor estimado: ${brl(2500)}`,
      `Próximo follow-up: ${formatDate("2026-10-03")}`,
      "R1: marcada para 20/09/2026",
    ]);
  });

  it("lead: campo vazio não vira linha, e R1 feita ganha da marcada", () => {
    const lead = secao(
      montarFicha(
        comLead({
          oportunidade: oportunidade({
            contatoNome: null,
            contatoEmail: "  ",
            contatoTelefone: null,
            valorEstimado: null,
            r1RealizadaEm: "2026-09-21T03:00:00.000Z",
          }),
        }),
        OWNER,
      ),
      "lead",
    );
    expect(textos(lead).some((t) => t.startsWith("Contato"))).toBe(false);
    expect(textos(lead).some((t) => t.startsWith("Valor estimado"))).toBe(false);
    expect(textos(lead)).toContain("R1: feita em 21/09/2026");
    expect(textos(lead)).toContain("Etapa: R1");
  });

  it("cliente: status, contato, responsável, assinatura e nicho", () => {
    const c = secao(montarFicha(comCliente(), OWNER), "cliente");
    expect(c.titulo).toBe("Cliente · Acme");
    expect(textos(c)).toEqual([
      "Status: Ativo",
      "Contato: Bia",
      "Responsável: Ana",
      `Assinado em: ${formatDate("2026-08-01")}`,
      "Nicho e segmento: Óptica · Varejo",
    ]);
  });

  it("cliente confidencial em reunião só com cliente (o caso que a tela grava): o aviso abre a ficha", () => {
    const secoes = montarFicha(comCliente({ cliente: cliente({ confidencial: true }) }), OWNER);
    expect(secoes.map((s) => s.chave)).toEqual([
      "confidencial",
      "cliente",
      "contratos",
      "onboarding",
      "tarefas",
      "reunioes",
    ]);
    expect(secoes[0]?.linhas[0]?.texto).toBe(
      "Cliente confidencial: o caso pede cuidado extra. Veja a ficha do cliente antes de entrar em contato.",
    );
  });

  it("cliente confidencial com lead e cliente (só por escrita direta no banco): o aviso vem antes do contato do lead (D-043)", () => {
    const secoes = montarFicha(
      dados({
        ...comLead(),
        clienteId: CLI,
        cliente: cliente({ confidencial: true }),
        contratos: [],
      }),
      OWNER,
    );
    expect(secoes.map((s) => s.chave)).toEqual([
      "confidencial",
      "lead",
      "qualificacao",
      "toques",
      "cliente",
      "contratos",
      "onboarding",
      "tarefas",
      "reunioes",
    ]);
    expect(secoes[0]).toEqual({
      chave: "confidencial",
      titulo: "Cliente confidencial",
      linhas: [
        {
          id: `cliente:${CLI}:confidencial`,
          texto: FRASES.clienteConfidencial,
          detalhe: null,
          estado: "atencao",
        },
      ],
      aviso: null,
      vazio: "",
    });
    expect(textos(secao(secoes, "cliente"))).toEqual([
      "Status: Ativo",
      "Contato: Bia",
      "Responsável: Ana",
      `Assinado em: ${formatDate("2026-08-01")}`,
      "Nicho e segmento: Óptica · Varejo",
    ]);
    const ids = secoes.flatMap((s) => s.linhas.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("controle: cliente não confidencial não ganha a seção de aviso", () => {
    const chaves = montarFicha(comCliente(), OWNER).map((s) => s.chave);
    expect(chaves).not.toContain("confidencial");
    expect(chaves[0]).toBe("cliente");
  });
});

describe("id de cada linha (critério 4 e Review Focus 2)", () => {
  const FORMATO =
    /^(oportunidade|evento|resposta|cliente|contrato|jornada|tarefa|reuniao):[0-9a-f-]{36}(:[a-z0-9_-]+)?$/;

  const completa = () =>
    montarFicha(
      dados({
        ...comLead({ eventos: [EVENTO], respostas: [RESPOSTA], catalogo: CATALOGO }),
        clienteId: CLI,
        cliente: cliente(),
        contratos: [MRR, TCV],
        jornada: jornada([etapa("e1", 1, "Boas-vindas", true, [item("i1", false)])]),
        tarefas: [TAREFA],
        reunioesAnteriores: [ANTERIOR],
      }),
      OWNER,
    );

  const ids = () => completa().flatMap((s) => s.linhas.map((l) => l.id));

  it("todo id segue tipo:uuid, com :campo quando o registro rende mais de uma linha", () => {
    expect(ids().length).toBeGreaterThan(15);
    for (const id of ids()) expect(id).toMatch(FORMATO);
  });

  it("nenhum id se repete na ficha", () => {
    expect(new Set(ids()).size).toBe(ids().length);
  });

  it("resposta usa o par oportunidade e pergunta", () => {
    expect(secao(completa(), "qualificacao").linhas[0]?.id).toBe(`resposta:${OPP}:orcamento`);
  });
});

describe("contratos (critérios 5, 6 e 7)", () => {
  const contratos = (lista: readonly ContratoDaFicha[] | null, contexto = OWNER) =>
    secao(montarFicha(comCliente({ contratos: lista }), contexto), "contratos");

  it("não lidos (papel sem acesso): diz por quê, e não 'nenhum contrato'", () => {
    const s = contratos(null, MEMBER);
    expect(s.linhas).toEqual([]);
    expect(s.vazio).toBe(FRASES.contratosSemPermissao);
  });

  it("lidos e vazios com a sessão sem o código: pede o código", () => {
    const s = contratos([], { ...OWNER, segundoFator: "falta-codigo" });
    expect(s.vazio).toBe(FRASES.contratosSemCodigo);
  });

  it("controle: lidos e vazios com a sessão completa dizem 'Nenhum contrato ativo.'", () => {
    expect(contratos([]).vazio).toBe(FRASES.semContratos);
  });

  it("MRR por mês e TCV pelo total em billing_months", () => {
    const s = contratos([MRR, TCV]);
    expect(textos(s)).toEqual([
      `Tráfego mensal · MRR ${brl(3500)}/mês`,
      `Sistema de agendamento · TCV ${brl(48000)} em 6 meses`,
    ]);
    expect(s.linhas[0]?.detalhe).toBe(`Início ${formatDate("2026-08-01")} · Demanda`);
  });

  it("🔴 nenhum total e nenhum TCV dividido em lugar nenhum da ficha (§4.1)", () => {
    const tudo = montarFicha(comCliente({ contratos: [MRR, TCV] }), OWNER)
      .flatMap((s) => [
        s.titulo,
        s.aviso ?? "",
        ...s.linhas.flatMap((l) => [l.texto, l.detalhe ?? ""]),
      ])
      .join(" | ");
    expect(tudo).not.toContain(brl(8000));
    expect(tudo).not.toContain(brl(51500));
    expect(tudo).not.toContain(brl(11500));
    expect(tudo.toLowerCase()).not.toContain("total");
    expect(tudo).toContain(`${brl(3500)}/mês`);
    expect(tudo).toContain(`${brl(48000)} em 6 meses`);
  });

  it("TCV sem billing_months mostra só o total, sem inventar meses", () => {
    expect(textos(contratos([{ ...TCV, mesesDeCobranca: null }]))).toEqual([
      `Sistema de agendamento · TCV ${brl(48000)}`,
    ]);
  });
});

describe("qualificação (critério 8 e Review Focus 4)", () => {
  const qualificacao = (
    respostas: DadosDaPreparacao["respostas"],
    catalogo: DadosDaPreparacao["catalogo"] = CATALOGO,
  ) => secao(montarFicha(comLead({ respostas, catalogo }), OWNER), "qualificacao");

  it("título com o tier de calcularTier, rótulos do catálogo, na ordem do catálogo", () => {
    const s = qualificacao([
      { questionKey: "decisor", optionIndex: 0, points: 2, isKo: false },
      RESPOSTA,
    ]);
    expect(s.titulo).toBe("Qualificação · Tier B");
    expect(textos(s)).toEqual(["Orçamento: Acima de 5 mil · 2 pts", "Decisor: Sócio · 2 pts"]);
  });

  it("KO fica em atenção e o tier vira C", () => {
    const s = qualificacao([{ questionKey: "orcamento", optionIndex: 1, points: 0, isKo: true }]);
    expect(s.titulo).toBe("Qualificação · Tier C");
    expect(s.linhas[0]).toMatchObject({
      texto: "Orçamento: Sem verba · 0 pts · KO",
      estado: "atencao",
    });
  });

  it("controle: resposta sem KO fica normal", () => {
    expect(qualificacao([RESPOSTA]).linhas[0]?.estado).toBe("normal");
  });

  it("sem resposta: título sem tier e a frase de vazio", () => {
    const s = qualificacao([]);
    expect(s.titulo).toBe("Qualificação");
    expect(s.linhas).toEqual([]);
    expect(s.vazio).toBe(FRASES.semQualificacao);
  });

  it("🔴 chave que saiu do catálogo vira 'Pergunta removida', com os pontos, depois das conhecidas", () => {
    const s = qualificacao([
      { questionKey: "antiga", optionIndex: 0, points: 1, isKo: false },
      RESPOSTA,
    ]);
    expect(textos(s)).toEqual(["Orçamento: Acima de 5 mil · 2 pts", "Pergunta removida · 1 pt"]);
    expect(textos(s).join(" ")).not.toContain("antiga");
    expect(s.linhas[1]?.id).toBe(`resposta:${OPP}:antiga`);
  });

  it("🔴 pergunta removida segue contando no tier e a resposta KO dela fica em atenção", () => {
    const s = qualificacao([
      { questionKey: "antiga", optionIndex: 1, points: 0, isKo: true },
      { questionKey: "decisor", optionIndex: 0, points: 2, isKo: false },
      RESPOSTA,
    ]);
    expect(s.titulo).toBe("Qualificação · Tier C");
    expect(s.linhas[2]).toMatchObject({
      texto: "Pergunta removida · 0 pts · KO",
      estado: "atencao",
    });
  });

  it("opção que não existe mais na pergunta vira 'opção N', sem quebrar", () => {
    expect(
      textos(qualificacao([{ questionKey: "orcamento", optionIndex: 5, points: 2, isKo: false }])),
    ).toEqual(["Orçamento: opção 6 · 2 pts"]);
  });

  it("sem catálogo, as respostas aparecem pela chave", () => {
    expect(textos(qualificacao([RESPOSTA], null))).toEqual(["orcamento: opção 1 · 2 pts"]);
  });
});

describe("últimos toques (critério 9)", () => {
  const toques = (eventos: readonly EventoDaFicha[]) =>
    secao(montarFicha(comLead({ eventos }), OWNER), "toques");

  it("tipo com o rótulo da timeline; detalhe com data em São Paulo e autor", () => {
    expect(toques([EVENTO]).linhas[0]).toEqual({
      id: `evento:${EVENTO.id}`,
      texto: "Ligação: Falou com a Rita",
      detalhe: `${formatDateTime(EVENTO.criadoEm)} · Ana`,
      estado: "normal",
    });
  });

  it("o tipo recusa stage_change: mudança de estágio não é toque (D-033)", () => {
    // @ts-expect-error o repositório filtra stage_change e o tipo o exclui.
    const evento: EventoDaFicha = { ...EVENTO, tipo: "stage_change" };
    expect(evento.tipo).toBe("stage_change");
  });

  it("mantém a ordem recebida do repositório (mais recente primeiro)", () => {
    const s = toques([
      { ...EVENTO, id: "0f000000-0000-4000-8000-000000000002", conteudo: "segundo" },
      { ...EVENTO, conteudo: "primeiro" },
    ]);
    expect(textos(s)).toEqual(["Ligação: segundo", "Ligação: primeiro"]);
  });

  it("conteúdo de 301 caracteres corta em 300 e ganha '…'", () => {
    expect(textos(toques([{ ...EVENTO, conteudo: "a".repeat(301) }]))).toEqual([
      `Ligação: ${"a".repeat(300)}…`,
    ]);
  });

  it("controle: exatamente 300 não ganha '…'", () => {
    expect(textos(toques([{ ...EVENTO, conteudo: "a".repeat(300) }]))).toEqual([
      `Ligação: ${"a".repeat(300)}`,
    ]);
  });

  it("conta depois do trim", () => {
    expect(textos(toques([{ ...EVENTO, conteudo: `  ${"a".repeat(300)}  ` }]))).toEqual([
      `Ligação: ${"a".repeat(300)}`,
    ]);
  });

  it("conteúdo em branco mostra só o tipo", () => {
    expect(textos(toques([{ ...EVENTO, conteudo: "   " }]))).toEqual(["Ligação"]);
  });

  it("sem eventos: frase de vazio", () => {
    expect(toques([])).toMatchObject({ linhas: [], vazio: FRASES.semToques });
  });
});

describe("cortarTexto (Review Focus 1)", () => {
  it("emoji na fronteira não é partido ao meio", () => {
    const texto = `${"a".repeat(LIMITE_DE_TEXTO - 1)}😀b`;
    expect(cortarTexto(texto)).toBe(`${"a".repeat(LIMITE_DE_TEXTO - 1)}😀…`);
  });
});

describe("tarefas abertas (critério 10)", () => {
  const AS_23_30: ContextoDaFicha = { ...OWNER, hoje: new Date("2026-10-01T02:30:00.000Z") };
  const tarefas = (lista: readonly TarefaDaFicha[]) =>
    secao(montarFicha(comCliente({ tarefas: lista }), AS_23_30), "tarefas");

  it("às 23:30, prazo de hoje não está vencido; o de ontem está", () => {
    const s = tarefas([
      { ...TAREFA, prazo: "2026-09-30" },
      { ...TAREFA, id: "1a000000-0000-4000-8000-000000000002", prazo: "2026-09-29" },
    ]);
    expect(s.linhas.map((l) => l.estado)).toEqual(["normal", "atencao"]);
  });

  it("detalhe com prazo e responsável; sem prazo e sem responsável dizem isso", () => {
    const s = tarefas([
      TAREFA,
      {
        ...TAREFA,
        id: "1a000000-0000-4000-8000-000000000002",
        prazo: null,
        responsavelNome: null,
      },
    ]);
    expect(s.linhas.map((l) => l.detalhe)).toEqual([
      `Prazo ${formatDate("2026-10-02")} · Ana`,
      "Sem prazo · Sem responsável",
    ]);
    expect(s.linhas[1]?.estado).toBe("normal");
  });

  it("sem tarefas: frase de vazio", () => {
    expect(tarefas([])).toMatchObject({ linhas: [], vazio: FRASES.semTarefas });
  });
});

describe("aviso de visão parcial (critério 12)", () => {
  const ficha = (contexto: ContextoDaFicha) => montarFicha(comCliente(), contexto);

  it("member vê o aviso em Reuniões anteriores", () => {
    expect(secao(ficha(MEMBER), "reunioes").aviso).toBe(FRASES.reunioesParciais);
  });

  it.each([
    ["member", MEMBER],
    ["owner", OWNER],
    ["manager", MANAGER],
  ])("🔴 %s não recebe aviso de tarefas", (_papel, contexto) => {
    expect(secao(ficha(contexto), "tarefas").aviso).toBeNull();
    expect(FRASES).not.toHaveProperty("tarefasParciais");
  });

  it.each([
    ["owner", OWNER],
    ["manager", MANAGER],
  ])("%s não vê aviso de reuniões", (_papel, contexto) => {
    expect(secao(ficha(contexto), "reunioes").aviso).toBeNull();
  });
});

describe("lista cortada avisa (ficha pela metade sem aviso mentiria)", () => {
  const copias = <T extends { id: string }>(base: T, n: number): T[] =>
    Array.from({ length: n }, (_, i) => ({ ...base, id: `${base.id}-${i}` }));

  const casos = [
    {
      chave: "toques" as const,
      limite: LIMITE_DE_EVENTOS,
      frase: FRASES.toquesCortados,
      ficha: (n: number) => comLead({ eventos: copias(EVENTO, n) }),
    },
    {
      chave: "tarefas" as const,
      limite: LIMITE_DE_TAREFAS,
      frase: FRASES.tarefasCortadas,
      ficha: (n: number) => comCliente({ tarefas: copias(TAREFA, n) }),
    },
    {
      chave: "reunioes" as const,
      limite: LIMITE_DE_REUNIOES_ANTERIORES,
      frase: FRASES.reunioesCortadas,
      ficha: (n: number) => comCliente({ reunioesAnteriores: copias(ANTERIOR, n) }),
    },
  ];

  it("os tetos e as frases são os da spec (20 toques, 20 tarefas, 5 reuniões)", () => {
    expect([LIMITE_DE_EVENTOS, LIMITE_DE_TAREFAS, LIMITE_DE_REUNIOES_ANTERIORES]).toEqual([
      20, 20, 5,
    ]);
    expect(FRASES.toquesCortados).toBe(
      "Mostrando os 20 toques mais recentes. Os outros estão na timeline do lead, no Pipeline.",
    );
    expect(FRASES.tarefasCortadas).toBe(
      "Mostrando as 20 primeiras por prazo (vencidas primeiro, sem prazo por último). As outras estão em Tarefas Internas, com os filtros Cliente e Todas as pessoas.",
    );
    expect(FRASES.reunioesCortadas).toBe("Mostrando as 5 mais recentes.");
  });

  it.each(casos)("$chave: uma linha além do teto mostra o teto e avisa", (c) => {
    const s = secao(montarFicha(c.ficha(c.limite + 1), OWNER), c.chave);
    expect(s.linhas).toHaveLength(c.limite);
    expect(s.linhas.at(-1)?.id).toMatch(new RegExp(`-${c.limite - 1}$`));
    expect(s.aviso).toBe(c.frase);
  });

  it.each(casos)("$chave, controle: exatamente o teto mostra tudo e não avisa", (c) => {
    const s = secao(montarFicha(c.ficha(c.limite), OWNER), c.chave);
    expect(s.linhas).toHaveLength(c.limite);
    expect(s.aviso).toBeNull();
  });

  it("member com lista cortada: em Tarefas só o corte; em Reuniões, visão parcial primeiro", () => {
    const secoes = montarFicha(
      comCliente({
        tarefas: copias(TAREFA, LIMITE_DE_TAREFAS + 1),
        reunioesAnteriores: copias(ANTERIOR, LIMITE_DE_REUNIOES_ANTERIORES + 1),
      }),
      MEMBER,
    );
    expect(secao(secoes, "tarefas").aviso).toBe(FRASES.tarefasCortadas);
    expect(secao(secoes, "reunioes").aviso).toBe(
      `${FRASES.reunioesParciais} ${FRASES.reunioesCortadas}`,
    );
  });
});

describe("onboarding (Review Focus 5)", () => {
  const onboarding = (j: Jornada | null) =>
    secao(montarFicha(comCliente({ jornada: j }), OWNER), "onboarding");

  it("etapas concluídas por progressoDaJornada e a etapa atual com os itens dela", () => {
    const s = onboarding(
      jornada([
        etapa("e1", 1, "Boas-vindas", true, [item("i1", true)]),
        etapa("e2", 2, "Diagnóstico", true, [item("i2", true), item("i3", false)]),
        etapa("e3", 3, "Plano", false, [item("i4", false)]),
      ]),
    );
    expect(s.linhas.map((l) => [l.id, l.texto, l.detalhe])).toEqual([
      [
        `jornada:${JOR}:progresso`,
        "1 de 3 etapas concluídas",
        `Iniciada em ${formatDate("2026-09-10T12:00:00.000Z")}`,
      ],
      [`jornada:${JOR}:situacao`, "Etapa atual: Diagnóstico", "1 de 2 itens"],
    ]);
  });

  it("jornada fechada diz que concluiu, com a data", () => {
    const s = onboarding(
      jornada(
        [etapa("e1", 1, "Boas-vindas", true, [item("i1", true)])],
        "2026-09-25T12:00:00.000Z",
      ),
    );
    expect(s.linhas[1]).toMatchObject({
      texto: "Jornada concluída",
      detalhe: `Em ${formatDate("2026-09-25T12:00:00.000Z")}`,
    });
  });

  it("aberta e sem etapa pendente (ou sem etapas) não se declara concluída", () => {
    const s = onboarding(jornada([]));
    expect(s.linhas[1]?.texto).toBe("Nenhuma etapa pendente");
    expect(textos(s)).not.toContain("Jornada concluída");
  });

  it("sem jornada: frase de vazio", () => {
    expect(onboarding(null)).toMatchObject({ linhas: [], vazio: FRASES.semJornada });
  });
});

describe("reuniões anteriores (critério 11, parte da regra)", () => {
  it("título e tipo, notas cortadas, detalhe com data e hora em São Paulo", () => {
    const outra = { ...ANTERIOR, id: "1b000000-0000-4000-8000-000000000002", notas: null };
    const s = secao(
      montarFicha(comCliente({ reunioesAnteriores: [ANTERIOR, outra] }), OWNER),
      "reunioes",
    );
    expect(s.linhas.map((l) => [l.id, l.texto, l.detalhe])).toEqual([
      [
        `reuniao:${ANTERIOR.id}`,
        "Kickoff · Kickoff com cliente: Combinou metas",
        formatDateTime(ANTERIOR.startsAt),
      ],
      [`reuniao:${outra.id}`, "Kickoff · Kickoff com cliente", formatDateTime(ANTERIOR.startsAt)],
    ]);
  });

  it("notas longas cortam em 300", () => {
    const s = secao(
      montarFicha(
        comCliente({ reunioesAnteriores: [{ ...ANTERIOR, notas: "n".repeat(400) }] }),
        OWNER,
      ),
      "reunioes",
    );
    expect(s.linhas[0]?.texto).toBe(`Kickoff · Kickoff com cliente: ${"n".repeat(300)}…`);
  });

  it("sem reuniões: frase de vazio", () => {
    expect(secao(montarFicha(dados(), OWNER), "reunioes")).toMatchObject({
      linhas: [],
      vazio: FRASES.semReunioes,
    });
  });
});
