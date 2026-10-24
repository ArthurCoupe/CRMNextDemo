import { useQuery } from "@tanstack/react-query";

import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  lerMrrPorUnidade,
  lerProjetosAtrasados,
  lerReceitaPorFrente,
  lerTcvPorUnidade,
} from "../api/financial.repository";
import {
  celulasDeMrr,
  celulasDeTcv,
  linhasDeFaturamento,
  linhasForaDaMatriz,
  totalDeCaixa,
} from "../domain/receita";

export const chavesDoFinanceiro = {
  raiz: ["financial"] as const,
  mrrPorUnidade: ["financial", "mrr-by-unit"] as const,
  tcvPorUnidade: ["financial", "tcv-by-unit"] as const,
  receitaPorFrente: ["financial", "revenue-by-front"] as const,
  projetosAtrasados: ["financial", "delayed-projects"] as const,
};

interface OpcoesDeConsulta {
  readonly habilitado?: boolean;
}

export function useMrrPorUnidade({ habilitado = true }: OpcoesDeConsulta = {}) {
  return useQuery({
    queryKey: chavesDoFinanceiro.mrrPorUnidade,
    queryFn: lerMrrPorUnidade,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
    select: (linhas) => ({
      celulas: celulasDeMrr(linhas),
      foraDaMatriz: linhasForaDaMatriz(linhas),
    }),
  });
}

export function useTcvPorUnidade() {
  return useQuery({
    queryKey: chavesDoFinanceiro.tcvPorUnidade,
    queryFn: lerTcvPorUnidade,
    retry: SEM_RETENTATIVA_EM_RECUSA,
    select: (linhas) => ({
      celulas: celulasDeTcv(linhas),
      foraDaMatriz: linhasForaDaMatriz(linhas),
    }),
  });
}

export function useReceitaPorFrente() {
  return useQuery({
    queryKey: chavesDoFinanceiro.receitaPorFrente,
    queryFn: lerReceitaPorFrente,
    retry: SEM_RETENTATIVA_EM_RECUSA,
    select: (linhas) => {
      const deFrente = linhasDeFaturamento(linhas);
      return { linhas: deFrente, totalDeCaixaDoMes: totalDeCaixa(deFrente) };
    },
  });
}

export function useProjetosAtrasados() {
  return useQuery({
    queryKey: chavesDoFinanceiro.projetosAtrasados,
    queryFn: lerProjetosAtrasados,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}
