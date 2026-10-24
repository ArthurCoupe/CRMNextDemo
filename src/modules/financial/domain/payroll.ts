import type { Database } from "@/shared/types/database.types";

import { mesesDesde, type DataISO } from "./mes-civil";
import type { UnidadeDeNegocio } from "./expenses";

export type VinculoDeTrabalho = Database["public"]["Enums"]["work_kind"];

export const ROTULO_DO_VINCULO: Readonly<Record<VinculoDeTrabalho, string>> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  freela: "Freelancer",
  socio: "Sócio",
  comissionado: "Comissionado",
};

export function pessoaNaFolhaEm(
  inicio: DataISO,
  fim: DataISO | null,
  mesReferencia: DataISO,
): boolean | null {
  const desdeOInicio = mesesDesde(inicio, mesReferencia);
  if (desdeOInicio === null) return null;
  if (desdeOInicio < 0) return false;

  if (fim === null) return true;

  const desdeOFim = mesesDesde(fim, mesReferencia);
  if (desdeOFim === null) return null;
  return desdeOFim <= 0;
}

export type SituacaoNaFolha = "conta" | "ainda-nao" | "terminou";

export function situacaoNaFolhaEm(
  inicio: DataISO,
  fim: DataISO | null,
  mesReferencia: DataISO,
): SituacaoNaFolha | null {
  const desdeOInicio = mesesDesde(inicio, mesReferencia);
  if (desdeOInicio === null) return null;
  if (desdeOInicio < 0) return "ainda-nao";

  if (fim === null) return "conta";

  const desdeOFim = mesesDesde(fim, mesReferencia);
  if (desdeOFim === null) return null;
  return desdeOFim <= 0 ? "conta" : "terminou";
}

export interface PessoaNaEquipe {
  readonly id: string | null;
  readonly chave: string;
  readonly profileId: string | null;
  readonly pessoa: string;
  readonly cargo: string | null;
  readonly vinculo: VinculoDeTrabalho | null;
  readonly bu: UnidadeDeNegocio;
  readonly custoMensal: number;
  readonly beneficios: number;
  readonly custoFixo: number;
  readonly custoVariavel: number;
  readonly contratosComParticipacao: number;
  readonly custoTotal: number;
  readonly inicio: DataISO | null;
  readonly fim: DataISO | null;
  readonly ativa: boolean;
  readonly semLinhaDeFolha: boolean;
}

export function explicacaoDeParticipacaoSemLinha(pessoa: PessoaNaEquipe): string | null {
  if (!pessoa.semLinhaDeFolha) return null;
  return "Participação em contrato desta frente, de alguém sem linha de folha nela. O custo é real e conta; o que falta é o cadastro na folha desta linha de negócio.";
}

export interface CustoDeFolhaPorBu {
  readonly bu: UnidadeDeNegocio;
  readonly custoFixo: number;
  readonly pessoas: number;
  readonly mesReferencia: DataISO;
}

export interface GrupoDaEquipe {
  readonly bu: UnidadeDeNegocio;
  readonly pessoas: readonly PessoaNaEquipe[];
  readonly custoFixo: number | null;
  readonly pessoasNoCusto: number | null;
}

export function agruparPorBu(
  pessoas: readonly PessoaNaEquipe[],
  custoPorBu: readonly CustoDeFolhaPorBu[],
): readonly GrupoDaEquipe[] {
  const ordem: readonly UnidadeDeNegocio[] = ["demanda", "sistemas", "compartilhado"];
  const custo = new Map(custoPorBu.map((c) => [c.bu, c]));

  return ordem.map((bu) => {
    const doGrupo = custo.get(bu);
    return {
      bu,
      pessoas: pessoas.filter((p) => p.bu === bu),
      custoFixo: doGrupo?.custoFixo ?? null,
      pessoasNoCusto: doGrupo?.pessoas ?? null,
    };
  });
}

export function fatiaVariavel(pessoa: PessoaNaEquipe): number | null {
  if (pessoa.custoTotal <= 0) return null;
  return pessoa.custoVariavel / pessoa.custoTotal;
}

export function avisoDePercentualSugerido(vinculo: VinculoDeTrabalho): string | null {
  if (vinculo !== "comissionado") return null;
  return "O percentual sugerido só vale para contratos novos. Contratos existentes preservam o percentual da assinatura.";
}
