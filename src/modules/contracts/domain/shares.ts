import type { Database } from "@/shared/types/database.types";

import { linhaDeNegocioLabel, type LinhaDeNegocio } from "./contract";

export type TipoDeParticipacao = Database["public"]["Enums"]["share_kind"];
export type TipoDeContrato = Database["public"]["Enums"]["contract_type"];
export type StatusDeContrato = Database["public"]["Enums"]["contract_status"];

export const TETO_DE_PARTICIPACAO = 100;

export interface Participacao {
  readonly perfilId: string | null;
  readonly nomeExterno: string | null;
  readonly tipo: TipoDeParticipacao;
  readonly percentual: number;
}

function somaEmCentesimos(participacoes: readonly Participacao[]): number {
  return participacoes.reduce((total, p) => total + Math.round(p.percentual * 100), 0);
}

export function somaDasParticipacoes(participacoes: readonly Participacao[]): number {
  return somaEmCentesimos(participacoes) / 100;
}

export function excedeOTeto(participacoes: readonly Participacao[]): boolean {
  return somaEmCentesimos(participacoes) > TETO_DE_PARTICIPACAO * 100;
}

export interface PadraoParaSoma {
  readonly id: string | null;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly perfilId: string;
  readonly tipo: TipoDeParticipacao;
  readonly percentual: number;
}

function producaoQueSeSoma(
  padroes: readonly PadraoParaSoma[],
  candidato: PadraoParaSoma,
): Participacao[] {
  const mesmaChave = (p: PadraoParaSoma) =>
    p.perfilId === candidato.perfilId &&
    p.linhaDeNegocio === candidato.linhaDeNegocio &&
    p.tipo === candidato.tipo;
  return [...padroes.filter((p) => p.id !== candidato.id && !mesmaChave(p)), candidato]
    .filter((p) => p.linhaDeNegocio === candidato.linhaDeNegocio && p.tipo === "producao")
    .map((p) => ({
      perfilId: p.perfilId,
      nomeExterno: null,
      tipo: p.tipo,
      percentual: p.percentual,
    }));
}

export function padroesExcedemOTeto(
  padroes: readonly PadraoParaSoma[],
  candidato: PadraoParaSoma,
): boolean {
  return candidato.tipo === "producao" && excedeOTeto(producaoQueSeSoma(padroes, candidato));
}

export function somaDaProducaoPadrao(
  padroes: readonly PadraoParaSoma[],
  candidato: PadraoParaSoma,
): number {
  return somaDasParticipacoes(producaoQueSeSoma(padroes, candidato));
}

export function recusaDoTetoDoPadrao(
  padroes: readonly PadraoParaSoma[],
  candidato: PadraoParaSoma,
): string | null {
  if (!padroesExcedemOTeto(padroes, candidato)) return null;
  const soma = somaDaProducaoPadrao(padroes, candidato).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
  return `A produção padrão de ${linhaDeNegocioLabel(candidato.linhaDeNegocio)} somaria ${soma}%. Acima de ${TETO_DE_PARTICIPACAO}%, todo contrato novo dessa linha seria recusado.`;
}

export function problemaNoPercentualDoPadrao(percentual: number): string | null {
  if (
    !Number.isFinite(percentual) ||
    percentual <= 0 ||
    percentual > TETO_DE_PARTICIPACAO ||
    Math.round(percentual * 100) / 100 !== percentual
  ) {
    return `O percentual precisa ser maior que 0 e no máximo ${TETO_DE_PARTICIPACAO}, com até duas casas.`;
  }
  return null;
}

export function problemaNoLimiarDeAlerta(percentual: number): string | null {
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual > TETO_DE_PARTICIPACAO) {
    return `O aviso precisa ser maior que 0 e no máximo ${TETO_DE_PARTICIPACAO}%.`;
  }
  return null;
}

export function atingiuOAlerta(
  participacoes: readonly Participacao[],
  limiarPct: number | null,
): boolean {
  if (limiarPct === null) return false;
  const soma = somaEmCentesimos(participacoes);
  return soma >= Math.round(limiarPct * 100) && soma <= TETO_DE_PARTICIPACAO * 100;
}

export interface BaseDeCusto {
  readonly tipo: TipoDeContrato;
  readonly valorMensal: number | null;
  readonly valorTotal: number | null;
  readonly mesesDeCobranca: number | null;
  readonly comissionavel: boolean;
  readonly status: StatusDeContrato;
  readonly cobrancaAtiva: boolean;
}

export function geraCustoAgora(base: BaseDeCusto): boolean {
  return base.status !== "cancelled" && base.cobrancaAtiva && base.comissionavel;
}

export function custoMensalDaParticipacao(base: BaseDeCusto, percentual: number): number | null {
  if (!geraCustoAgora(base)) return 0;

  let centavos: number;
  let meses: number;

  if (base.tipo === "mrr") {
    if (base.valorMensal === null) return null;
    centavos = Math.round(base.valorMensal * 100);
    meses = 1;
  } else {
    if (base.valorTotal === null) return null;
    if (base.mesesDeCobranca === null || base.mesesDeCobranca <= 0) return null;
    centavos = Math.round(base.valorTotal * 100);
    meses = base.mesesDeCobranca;
  }

  const numerador = centavos * Math.round(percentual * 100);
  const denominador = 10000 * meses;
  const quociente = Math.floor(numerador / denominador);
  const resto = numerador - quociente * denominador;
  return (resto * 2 >= denominador ? quociente + 1 : quociente) / 100;
}

export function custoMensalTotal(
  base: BaseDeCusto,
  participacoes: readonly Participacao[],
): number | null {
  let total = 0;
  for (const p of participacoes) {
    const custo = custoMensalDaParticipacao(base, p.percentual);
    if (custo === null) return null;
    total += custo;
  }
  return total;
}

export interface ProblemaDeParticipacao {
  readonly indice: number;
  readonly mensagem: string;
}

export function problemasDasParticipacoes(
  participacoes: readonly Participacao[],
): ProblemaDeParticipacao[] {
  const problemas: ProblemaDeParticipacao[] = [];
  const vistos = new Map<string, number>();

  participacoes.forEach((p, indice) => {
    const semBeneficiario =
      p.perfilId === null && (p.nomeExterno === null || p.nomeExterno.trim() === "");

    if (semBeneficiario) {
      problemas.push({
        indice,
        mensagem: "Escolha quem recebe, ou remova a linha.",
      });
    }

    if (p.percentual <= 0) {
      problemas.push({
        indice,
        mensagem: "Informe um percentual, ou remova a linha pela lixeira.",
      });
    } else if (p.percentual > TETO_DE_PARTICIPACAO) {
      problemas.push({
        indice,
        mensagem: `Uma linha sozinha não pode passar de ${TETO_DE_PARTICIPACAO}%.`,
      });
    }

    if (p.perfilId !== null) {
      const chave = `${p.perfilId}:${p.tipo}`;
      const anterior = vistos.get(chave);
      if (anterior !== undefined) {
        problemas.push({
          indice,
          mensagem:
            "Esta pessoa já tem participação deste tipo. Some os percentuais numa linha só.",
        });
      } else {
        vistos.set(chave, indice);
      }
    }
  });

  return problemas;
}

export function podeAplicarPadraoDaBu(estado: {
  readonly padroesResolvidos: boolean;
  readonly linhaDeNegocio: string;
  readonly jaAplicadoPara: string | null;
}): boolean {
  if (!estado.padroesResolvidos) return false;
  return estado.jaAplicadoPara !== estado.linhaDeNegocio;
}

const ROTULO_DE_TIPO: Record<TipoDeParticipacao, string> = {
  venda: "Venda",
  producao: "Produção",
  indicacao: "Indicação",
};

export function rotuloDoTipoDeParticipacao(tipo: TipoDeParticipacao): string {
  return ROTULO_DE_TIPO[tipo];
}

export function mensagemDeTetoExcedido(participacoes: readonly Participacao[]): string {
  const soma = somaDasParticipacoes(participacoes);
  return (
    `As participações deste contrato somariam ${soma.toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })}%. ` + `O teto é ${TETO_DE_PARTICIPACAO}% somando venda, produção e indicação.`
  );
}
