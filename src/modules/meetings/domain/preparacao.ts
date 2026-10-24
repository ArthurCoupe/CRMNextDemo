import type { PapelDeAcesso } from "@/modules/clients/domain/access";
import { clientStatusLabel, type StatusDeCliente } from "@/modules/clients/domain/health";
import {
  linhaDeNegocioLabel,
  type LinhaDeNegocio,
  type TipoDeContrato,
} from "@/modules/contracts/domain/contract";
import {
  concluidosNaEtapa,
  etapaCorrente,
  progressoDaJornada,
  type Jornada,
} from "@/modules/onboarding/domain/onboarding";
import { rotuloDoCanal, type Canal } from "@/modules/pipeline/domain/channel";
import { rotuloDoTipoDeEvento, type TipoDeEvento } from "@/modules/pipeline/domain/event-type";
import {
  calcularTier,
  type CatalogoDeQualificacao,
  type RespostaCongelada,
} from "@/modules/pipeline/domain/qualification";
import { formatDate, formatDateTime, isOverdue } from "@/shared/lib/date";
import { brl } from "@/shared/lib/format";
import type { SituacaoDoSegundoFator } from "@/shared/lib/mfa";

import { rotuloDoTipo, type TipoDeReuniao } from "./meeting";

export interface LinhaDaFicha {
  readonly id: string;
  readonly texto: string;
  readonly detalhe: string | null;
  readonly estado: "normal" | "atencao";
}

export type ChaveDaSecao =
  | "confidencial"
  | "lead"
  | "qualificacao"
  | "toques"
  | "cliente"
  | "contratos"
  | "onboarding"
  | "tarefas"
  | "reunioes";

export interface Secao {
  readonly chave: ChaveDaSecao;
  readonly titulo: string;
  readonly linhas: readonly LinhaDaFicha[];
  readonly aviso: string | null;
  readonly vazio: string;
}

export interface OportunidadeDaFicha {
  readonly id: string;
  readonly nome: string;
  readonly segmento: string | null;
  readonly nicho: string | null;
  readonly estagioNome: string | null;
  readonly responsavelNome: string | null;
  readonly contatoNome: string | null;
  readonly contatoEmail: string | null;
  readonly contatoTelefone: string | null;
  readonly origem: string | null;
  readonly canal: Canal | null;
  readonly valorEstimado: number | null;
  readonly proximoFollowUp: string | null;
  readonly r1AgendadaEm: string | null;
  readonly r1RealizadaEm: string | null;
  readonly r2AgendadaEm: string | null;
  readonly r2RealizadaEm: string | null;
}

export interface EventoDaFicha {
  readonly id: string;
  readonly tipo: Exclude<TipoDeEvento, "stage_change">;
  readonly conteudo: string | null;
  readonly autorNome: string | null;
  readonly criadoEm: string;
}

export interface ClienteDaFicha {
  readonly id: string;
  readonly nome: string;
  readonly status: StatusDeCliente;
  readonly segmento: string | null;
  readonly nicho: string | null;
  readonly contatoNome: string | null;
  readonly contatoEmail: string | null;
  readonly contatoTelefone: string | null;
  readonly responsavelId: string | null;
  readonly responsavelNome: string | null;
  readonly assinadoEm: string | null;
  readonly confidencial: boolean;
}

export interface ContratoDaFicha {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly valorMensal: number | null;
  readonly valorTotal: number | null;
  readonly mesesDeCobranca: number | null;
  readonly inicio: string;
}

export interface TarefaDaFicha {
  readonly id: string;
  readonly titulo: string;
  readonly prazo: string | null;
  readonly responsavelNome: string | null;
}

export interface ReuniaoAnterior {
  readonly id: string;
  readonly titulo: string;
  readonly tipo: TipoDeReuniao;
  readonly startsAt: string;
  readonly notas: string | null;
}

export interface DadosDaPreparacao {
  readonly oportunidadeId: string | null;
  readonly oportunidade: OportunidadeDaFicha | null;
  readonly eventos: readonly EventoDaFicha[];
  readonly respostas: readonly RespostaCongelada[];
  readonly catalogo: CatalogoDeQualificacao | null;
  readonly clienteId: string | null;
  readonly cliente: ClienteDaFicha | null;
  readonly contratos: readonly ContratoDaFicha[] | null;
  readonly jornada: Jornada | null;
  readonly tarefas: readonly TarefaDaFicha[];
  readonly reunioesAnteriores: readonly ReuniaoAnterior[];
}

export interface ContextoDaFicha {
  readonly papel: PapelDeAcesso | null;
  readonly hoje: Date;
  readonly segundoFator: SituacaoDoSegundoFator;
}

export const LIMITE_DE_TEXTO = 300;
export const LIMITE_DE_EVENTOS = 20;
export const LIMITE_DE_TAREFAS = 20;
export const LIMITE_DE_REUNIOES_ANTERIORES = 5;

export const FRASES = {
  leadNaoEncontrado: "Lead não encontrado ou sem acesso.",
  clienteNaoEncontrado: "Cliente não encontrado ou sem acesso.",
  clienteConfidencial:
    "Cliente confidencial: o caso pede cuidado extra. Veja a ficha do cliente antes de entrar em contato.",
  semQualificacao: "Sem respostas de qualificação.",
  perguntaRemovida: "Pergunta removida",
  semToques: "Nenhum toque registrado.",
  toquesCortados: `Mostrando os ${LIMITE_DE_EVENTOS} toques mais recentes. Os outros estão na timeline do lead, no Pipeline.`,
  contratosSemPermissao:
    "Contratos visíveis só para owner e para o manager responsável pelo cliente.",
  contratosSemCodigo:
    "Esta sessão entrou sem o código do app autenticador, e os contratos só abrem com ele. Saia e entre de novo digitando o código.",
  semContratos: "Nenhum contrato ativo.",
  semJornada: "Sem jornada de onboarding.",
  semTarefas: "Nenhuma tarefa aberta.",
  tarefasCortadas: `Mostrando as ${LIMITE_DE_TAREFAS} primeiras por prazo (vencidas primeiro, sem prazo por último). As outras estão em Tarefas Internas, com os filtros Cliente e Todas as pessoas.`,
  semReunioes: "Nenhuma reunião anterior.",
  reunioesParciais: "Você vê só as reuniões que organizou ou de que participa.",
  reunioesCortadas: `Mostrando as ${LIMITE_DE_REUNIOES_ANTERIORES} mais recentes.`,
} as const;

function cortar<T>(lista: readonly T[], limite: number): { itens: readonly T[]; cortada: boolean } {
  return { itens: lista.slice(0, limite), cortada: lista.length > limite };
}

function avisos(...frases: ReadonlyArray<string | null>): string | null {
  const presentes = frases.filter((f): f is string => f !== null);
  return presentes.length === 0 ? null : presentes.join(" ");
}

export function cortarTexto(texto: string): string {
  const caracteres = Array.from(texto.trim());
  if (caracteres.length <= LIMITE_DE_TEXTO) return caracteres.join("");
  return `${caracteres.slice(0, LIMITE_DE_TEXTO).join("")}…`;
}

export function montarFicha(dados: DadosDaPreparacao, contexto: ContextoDaFicha): readonly Secao[] {
  const secoes: Secao[] = [];
  if (dados.cliente?.confidencial === true) secoes.push(secaoDeConfidencial(dados.cliente.id));
  if (dados.oportunidadeId !== null) secoes.push(...secoesDoLead(dados));
  if (dados.clienteId !== null) secoes.push(...secoesDoCliente(dados, contexto));
  secoes.push(secaoDeReunioes(dados.reunioesAnteriores, contexto));
  return secoes;
}

function linha(
  id: string,
  texto: string,
  detalhe: string | null = null,
  estado: LinhaDaFicha["estado"] = "normal",
): LinhaDaFicha {
  return { id, texto, detalhe, estado };
}

function juntar(partes: ReadonlyArray<string | null>): string | null {
  const preenchidas = partes.map((p) => p?.trim() ?? "").filter((p) => p !== "");
  return preenchidas.length === 0 ? null : preenchidas.join(" · ");
}

function campo(id: string, rotulo: string, valor: string | null): LinhaDaFicha | null {
  return valor === null ? null : linha(id, `${rotulo}: ${valor}`);
}

function presentes(linhas: ReadonlyArray<LinhaDaFicha | null>): LinhaDaFicha[] {
  return linhas.filter((l): l is LinhaDaFicha => l !== null);
}

function secoesDoLead(dados: DadosDaPreparacao): Secao[] {
  const o = dados.oportunidade;
  if (o === null) {
    return [
      { chave: "lead", titulo: "Lead", linhas: [], aviso: null, vazio: FRASES.leadNaoEncontrado },
    ];
  }
  return [
    secaoDoLead(o),
    secaoDeQualificacao(o.id, dados.respostas, dados.catalogo),
    secaoDeToques(dados.eventos),
  ];
}

function secaoDoLead(o: OportunidadeDaFicha): Secao {
  const id = (nome: string) => `oportunidade:${o.id}:${nome}`;
  return {
    chave: "lead",
    titulo: `Lead · ${o.nome}`,
    linhas: presentes([
      campo(id("contato"), "Contato", juntar([o.contatoNome, o.contatoEmail, o.contatoTelefone])),
      campo(id("etapa"), "Etapa", o.estagioNome),
      campo(id("responsavel"), "Responsável", o.responsavelNome),
      campo(id("nicho"), "Nicho e segmento", juntar([o.nicho, o.segmento])),
      campo(
        id("origem"),
        "Origem e canal",
        juntar([o.origem, o.canal === null ? null : rotuloDoCanal(o.canal)]),
      ),
      campo(id("valor"), "Valor estimado", o.valorEstimado === null ? null : brl(o.valorEstimado)),
      campo(
        id("follow-up"),
        "Próximo follow-up",
        o.proximoFollowUp === null ? null : formatDate(o.proximoFollowUp),
      ),
      campo(id("r1"), "R1", reuniaoDoFunil(o.r1AgendadaEm, o.r1RealizadaEm)),
      campo(id("r2"), "R2", reuniaoDoFunil(o.r2AgendadaEm, o.r2RealizadaEm)),
    ]),
    aviso: null,
    vazio: "Sem dados do lead.",
  };
}

function reuniaoDoFunil(agendadaEm: string | null, realizadaEm: string | null): string | null {
  if (realizadaEm !== null) return `feita em ${formatDate(realizadaEm)}`;
  if (agendadaEm !== null) return `marcada para ${formatDate(agendadaEm)}`;
  return null;
}

function secaoDeQualificacao(
  oportunidadeId: string,
  respostas: readonly RespostaCongelada[],
  catalogo: CatalogoDeQualificacao | null,
): Secao {
  const tier = calcularTier(respostas);
  const perguntas = catalogo?.questions ?? [];
  const posicao = (chave: string) => {
    const i = perguntas.findIndex((p) => p.key === chave);
    return i === -1 ? perguntas.length : i;
  };
  const ordenadas = [...respostas].sort(
    (a, b) =>
      posicao(a.questionKey) - posicao(b.questionKey) || a.questionKey.localeCompare(b.questionKey),
  );
  return {
    chave: "qualificacao",
    titulo: tier === null ? "Qualificação" : `Qualificação · Tier ${tier}`,
    linhas: ordenadas.map((r) => {
      const pergunta = perguntas.find((p) => p.key === r.questionKey);
      const pontos = `${r.points} ${r.points === 1 ? "pt" : "pts"}${r.isKo ? " · KO" : ""}`;
      const rotulo = pergunta?.label ?? (catalogo === null ? r.questionKey : null);
      const opcao = pergunta?.options[r.optionIndex]?.label ?? `opção ${r.optionIndex + 1}`;
      const texto =
        rotulo === null
          ? `${FRASES.perguntaRemovida} · ${pontos}`
          : `${rotulo}: ${opcao} · ${pontos}`;
      return linha(
        `resposta:${oportunidadeId}:${r.questionKey}`,
        texto,
        null,
        r.isKo ? "atencao" : "normal",
      );
    }),
    aviso: null,
    vazio: FRASES.semQualificacao,
  };
}

function secaoDeToques(eventos: readonly EventoDaFicha[]): Secao {
  const { itens, cortada } = cortar(eventos, LIMITE_DE_EVENTOS);
  return {
    chave: "toques",
    titulo: "Últimos toques",
    linhas: itens.map((e) =>
      linha(`evento:${e.id}`, textoDoEvento(e), juntar([formatDateTime(e.criadoEm), e.autorNome])),
    ),
    aviso: cortada ? FRASES.toquesCortados : null,
    vazio: FRASES.semToques,
  };
}

function textoDoEvento(e: EventoDaFicha): string {
  const conteudo = e.conteudo === null ? "" : cortarTexto(e.conteudo);
  const rotulo = rotuloDoTipoDeEvento(e.tipo);
  return conteudo === "" ? rotulo : `${rotulo}: ${conteudo}`;
}

function secoesDoCliente(dados: DadosDaPreparacao, contexto: ContextoDaFicha): Secao[] {
  const c = dados.cliente;
  if (c === null) {
    return [
      {
        chave: "cliente",
        titulo: "Cliente",
        linhas: [],
        aviso: null,
        vazio: FRASES.clienteNaoEncontrado,
      },
    ];
  }
  return [
    secaoDoCliente(c),
    secaoDeContratos(dados.contratos, contexto.segundoFator),
    secaoDeOnboarding(dados.jornada),
    secaoDeTarefas(dados.tarefas, contexto),
  ];
}

function secaoDeConfidencial(clienteId: string): Secao {
  return {
    chave: "confidencial",
    titulo: "Cliente confidencial",
    linhas: [
      linha(`cliente:${clienteId}:confidencial`, FRASES.clienteConfidencial, null, "atencao"),
    ],
    aviso: null,
    vazio: "",
  };
}

function secaoDoCliente(c: ClienteDaFicha): Secao {
  const id = (nome: string) => `cliente:${c.id}:${nome}`;
  return {
    chave: "cliente",
    titulo: `Cliente · ${c.nome}`,
    linhas: presentes([
      campo(id("status"), "Status", clientStatusLabel(c.status)),
      campo(id("contato"), "Contato", juntar([c.contatoNome, c.contatoEmail, c.contatoTelefone])),
      campo(id("responsavel"), "Responsável", c.responsavelNome),
      campo(
        id("assinatura"),
        "Assinado em",
        c.assinadoEm === null ? null : formatDate(c.assinadoEm),
      ),
      campo(id("nicho"), "Nicho e segmento", juntar([c.nicho, c.segmento])),
    ]),
    aviso: null,
    vazio: "Sem dados do cliente.",
  };
}

function secaoDeContratos(
  contratos: readonly ContratoDaFicha[] | null,
  segundoFator: SituacaoDoSegundoFator,
): Secao {
  if (contratos === null) {
    return {
      chave: "contratos",
      titulo: "Contratos",
      linhas: [],
      aviso: null,
      vazio: FRASES.contratosSemPermissao,
    };
  }
  return {
    chave: "contratos",
    titulo: "Contratos",
    linhas: contratos.map((k) =>
      linha(
        `contrato:${k.id}`,
        `${k.nome} · ${valorDoContrato(k)}`,
        `Início ${formatDate(k.inicio)} · ${linhaDeNegocioLabel(k.linhaDeNegocio)}`,
      ),
    ),
    aviso: null,
    vazio: segundoFator === "falta-codigo" ? FRASES.contratosSemCodigo : FRASES.semContratos,
  };
}

function valorDoContrato(k: ContratoDaFicha): string {
  if (k.tipo === "mrr") return `MRR ${brl(k.valorMensal)}/mês`;
  const meses = k.mesesDeCobranca;
  if (meses === null) return `TCV ${brl(k.valorTotal)}`;
  return `TCV ${brl(k.valorTotal)} em ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

function secaoDeOnboarding(j: Jornada | null): Secao {
  if (j === null) {
    return {
      chave: "onboarding",
      titulo: "Onboarding",
      linhas: [],
      aviso: null,
      vazio: FRASES.semJornada,
    };
  }
  const { concluidas, total } = progressoDaJornada(j);
  return {
    chave: "onboarding",
    titulo: "Onboarding",
    linhas: [
      linha(
        `jornada:${j.id}:progresso`,
        `${concluidas} de ${total} etapas concluídas`,
        `Iniciada em ${formatDate(j.iniciadaEm)}`,
      ),
      situacaoDaJornada(j),
    ],
    aviso: null,
    vazio: FRASES.semJornada,
  };
}

function situacaoDaJornada(j: Jornada): LinhaDaFicha {
  const id = `jornada:${j.id}:situacao`;
  if (j.concluidaEm !== null) {
    return linha(id, "Jornada concluída", `Em ${formatDate(j.concluidaEm)}`);
  }
  const atual = etapaCorrente(j);
  if (atual === null) return linha(id, "Nenhuma etapa pendente");
  return linha(
    id,
    `Etapa atual: ${atual.nome}`,
    `${concluidosNaEtapa(atual)} de ${atual.itens.length} itens`,
  );
}

function secaoDeTarefas(tarefas: readonly TarefaDaFicha[], contexto: ContextoDaFicha): Secao {
  const { itens, cortada } = cortar(tarefas, LIMITE_DE_TAREFAS);
  return {
    chave: "tarefas",
    titulo: "Tarefas abertas",
    linhas: itens.map((t) =>
      linha(
        `tarefa:${t.id}`,
        t.titulo,
        juntar([
          t.prazo === null ? "Sem prazo" : `Prazo ${formatDate(t.prazo)}`,
          t.responsavelNome ?? "Sem responsável",
        ]),
        t.prazo !== null && isOverdue(t.prazo, contexto.hoje) ? "atencao" : "normal",
      ),
    ),
    aviso: avisos(cortada ? FRASES.tarefasCortadas : null),
    vazio: FRASES.semTarefas,
  };
}

function secaoDeReunioes(reunioes: readonly ReuniaoAnterior[], contexto: ContextoDaFicha): Secao {
  const { itens, cortada } = cortar(reunioes, LIMITE_DE_REUNIOES_ANTERIORES);
  return {
    chave: "reunioes",
    titulo: "Reuniões anteriores",
    linhas: itens.map((r) => {
      const cabeca = `${r.titulo} · ${rotuloDoTipo(r.tipo)}`;
      const notas = r.notas === null ? "" : cortarTexto(r.notas);
      return linha(
        `reuniao:${r.id}`,
        notas === "" ? cabeca : `${cabeca}: ${notas}`,
        formatDateTime(r.startsAt),
      );
    }),
    aviso: avisos(
      contexto.papel === "member" ? FRASES.reunioesParciais : null,
      cortada ? FRASES.reunioesCortadas : null,
    ),
    vazio: FRASES.semReunioes,
  };
}
