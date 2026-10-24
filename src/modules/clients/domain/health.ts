import { diasCivisAte, diasCivisDesde } from "@/shared/lib/date";
import type { Database } from "@/shared/types/database.types";

export type StatusDeCliente = Database["public"]["Enums"]["client_status"];

export type Severidade = "critico" | "atencao";

export interface SinalDeSaude {
  readonly chave: string;
  readonly rotulo: string;
  readonly severidade: Severidade;
  readonly detalhe: string;
}

export interface EntradaDeSaude {
  readonly status: StatusDeCliente;
  readonly diasSemContato: number | null;
  readonly diasParaFimDeCobranca: number | null;
  readonly diasDesdeEntrada: number | null;
  readonly diasPausado: number | null;
  readonly temResponsavel: boolean;
  readonly cobrancaVisivel: boolean;
  readonly contratosAtivos: number;
}

const DIAS_SEM_CONTATO_CRITICO = 21;
const DIAS_SEM_CONTATO_ATENCAO = 14;

const DIAS_PARA_RENOVACAO_ATENCAO = 30;
const DIAS_PARA_RENOVACAO_CRITICO = 7;

const DIAS_EM_ONBOARDING_CRITICO = 45;
const DIAS_EM_ONBOARDING_ATENCAO = 30;

export const LIMIAR_DE_PAUSA_DIAS = 30;

export function avaliarSaude(entrada: EntradaDeSaude): SinalDeSaude[] {
  if (entrada.status === "churned") {
    if (entrada.contratosAtivos <= 0) return [];
    return [
      {
        chave: "encerrado-cobrando",
        rotulo: "Encerrado com cobrança ativa",
        severidade: "critico",
        detalhe:
          "O status Encerrado não mexe em contrato: a cobrança deste cliente continua ativa e o MRR segue no Financeiro. Encerre a cobrança na ficha do contrato.",
      },
    ];
  }

  const sinais: SinalDeSaude[] = [];

  if (!entrada.temResponsavel) {
    sinais.push({
      chave: "sem-responsavel",
      rotulo: "Sem responsável",
      severidade: "critico",
      detalhe:
        "Sem responsável, o contrato deste cliente não aparece para o gestor: a permissão do papel manager filtra por esse campo.",
    });
  }

  if (entrada.diasSemContato !== null) {
    if (entrada.diasSemContato >= DIAS_SEM_CONTATO_CRITICO) {
      sinais.push({
        chave: "sem-contato",
        rotulo: `${entrada.diasSemContato} dias sem contato`,
        severidade: "critico",
        detalhe:
          "Agência não morre de churn anunciado, morre de churn silencioso. Três semanas em silêncio é o padrão de quem cancela.",
      });
    } else if (entrada.diasSemContato >= DIAS_SEM_CONTATO_ATENCAO) {
      sinais.push({
        chave: "sem-contato",
        rotulo: `${entrada.diasSemContato} dias sem contato`,
        severidade: "atencao",
        detalhe: "Duas semanas sem nenhum registro na timeline.",
      });
    }
  }

  if (entrada.diasParaFimDeCobranca !== null) {
    const dias = entrada.diasParaFimDeCobranca;
    if (dias < 0) {
      sinais.push({
        chave: "cobranca-encerrada",
        rotulo: `Cobrança encerrada há ${Math.abs(dias)} dias`,
        severidade: "critico",
        detalhe: "O período de cobrança acabou e o contrato segue ativo. Renovar ou encerrar.",
      });
    } else if (dias <= DIAS_PARA_RENOVACAO_CRITICO) {
      sinais.push({
        chave: "renovacao",
        rotulo: dias === 0 ? "Cobrança acaba hoje" : `Cobrança acaba em ${dias} dias`,
        severidade: "critico",
        detalhe: "Janela de renovação fechando. Conversa de renovação é agora, não depois.",
      });
    } else if (dias <= DIAS_PARA_RENOVACAO_ATENCAO) {
      sinais.push({
        chave: "renovacao",
        rotulo: `Cobrança acaba em ${dias} dias`,
        severidade: "atencao",
        detalhe: "Janela de renovação aberta.",
      });
    }
  }

  if (entrada.status === "onboarding" && entrada.diasDesdeEntrada !== null) {
    if (entrada.diasDesdeEntrada >= DIAS_EM_ONBOARDING_CRITICO) {
      sinais.push({
        chave: "onboarding-longo",
        rotulo: `Em onboarding há ${entrada.diasDesdeEntrada} dias`,
        severidade: "critico",
        detalhe:
          "Onboarding que não termina é entrega que não começou, e o cliente já está pagando.",
      });
    } else if (entrada.diasDesdeEntrada >= DIAS_EM_ONBOARDING_ATENCAO) {
      sinais.push({
        chave: "onboarding-longo",
        rotulo: `Em onboarding há ${entrada.diasDesdeEntrada} dias`,
        severidade: "atencao",
        detalhe: "Um mês de onboarding. Vale conferir onde travou.",
      });
    }
  }

  if (entrada.status === "paused") {
    if (entrada.diasPausado === null) {
      sinais.push({
        chave: "pausado",
        rotulo: "Pausado desde data desconhecida",
        severidade: "atencao",
        detalhe:
          "Este cliente foi pausado antes de o sistema registrar a data. Decida se volta ou encerra e, se seguir pausado, reaplique o status para datar a pausa.",
      });
    } else if (entrada.diasPausado >= LIMIAR_DE_PAUSA_DIAS) {
      sinais.push({
        chave: "pausado",
        rotulo: `Pausado há ${entrada.diasPausado} dias`,
        severidade: "atencao",
        detalhe: "Um mês pausado. Vale decidir: volta ou encerra?",
      });
    }
  }

  const ordem: Record<Severidade, number> = { critico: 0, atencao: 1 };
  return sinais.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}

export function saudeEhParcial(entrada: EntradaDeSaude): boolean {
  if (entrada.status === "churned") return false;
  return !entrada.cobrancaVisivel;
}

export function severidadeGeral(sinais: readonly SinalDeSaude[]): Severidade | null {
  if (sinais.some((sinal) => sinal.severidade === "critico")) return "critico";
  if (sinais.length > 0) return "atencao";
  return null;
}

export interface DatasDoCliente {
  readonly status: StatusDeCliente;
  readonly ultimoEventoEm: string | null;
  readonly proximoFimDeCobranca: string | null;
  readonly assinadoEm: string | null;
  readonly criadoEm: string;
  readonly pausadoEm: string | null;
  readonly responsavelId: string | null;
  readonly cobrancaVisivel: boolean;
  readonly contratosAtivosVisiveis: number;
}

export function montarEntradaDeSaude(
  datas: DatasDoCliente,
  agora: Date = new Date(),
): EntradaDeSaude {
  return {
    status: datas.status,
    diasSemContato:
      datas.ultimoEventoEm === null ? null : diasCivisDesde(datas.ultimoEventoEm, agora),
    diasParaFimDeCobranca:
      !datas.cobrancaVisivel || datas.proximoFimDeCobranca === null
        ? null
        : diasCivisAte(datas.proximoFimDeCobranca, agora),
    diasDesdeEntrada: diasCivisDesde(datas.assinadoEm ?? datas.criadoEm, agora),
    diasPausado: datas.pausadoEm === null ? null : diasCivisDesde(datas.pausadoEm, agora),
    temResponsavel: datas.responsavelId !== null,
    cobrancaVisivel: datas.cobrancaVisivel,
    contratosAtivos: datas.contratosAtivosVisiveis,
  };
}

const ROTULO_STATUS: Record<StatusDeCliente, string> = {
  onboarding: "Onboarding",
  active: "Ativo",
  paused: "Pausado",
  churned: "Encerrado",
};

export function clientStatusLabel(status: StatusDeCliente): string {
  return ROTULO_STATUS[status];
}
