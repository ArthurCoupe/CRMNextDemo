import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { LinhaDeNegocio } from "../domain/contract";
import {
  adicionarPadrao,
  atualizarPadrao,
  desativarPadrao,
  gravarParticipacoes,
  lerLimiarDeAlerta,
  listarContratosSemParticipacao,
  listarPadroesDaLinhaDeNegocio,
  listarParticipacoes,
  listarPessoasParaParticipacao,
  listarTodosOsPadroes,
  salvarLimiarDeAlerta,
  type PadraoAGravar,
  type ParticipacaoAGravar,
} from "../api/shares.repository";

export const chavesDeParticipacoes = {
  raiz: ["contract-shares"] as const,
  doContrato: (contratoId: string) => ["contract-shares", contratoId] as const,
  padroes: (bu: LinhaDeNegocio) => ["bu-default-shares", bu] as const,
  pessoas: (perfisAPreservar: readonly string[] = []) =>
    ["profiles", "beneficiarios", [...perfisAPreservar].sort().join(",")] as const,
  limiar: ["app-settings", "share_warning_pct"] as const,
  todosOsPadroes: ["bu-default-shares", "todos"] as const,
  backfill: ["contracts", "sem-participacao"] as const,
};

export function useParticipacoes(contratoId: string | null) {
  return useQuery({
    queryKey: chavesDeParticipacoes.doContrato(contratoId ?? "nenhum"),
    queryFn: () => listarParticipacoes(contratoId as string),
    enabled: contratoId !== null,
  });
}

export function usePadroesDaLinhaDeNegocio(linhaDeNegocio: LinhaDeNegocio | null) {
  return useQuery({
    queryKey: chavesDeParticipacoes.padroes(linhaDeNegocio ?? "demanda"),
    queryFn: () => listarPadroesDaLinhaDeNegocio(linhaDeNegocio as LinhaDeNegocio),
    enabled: linhaDeNegocio !== null,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePessoasParaParticipacao(perfisAPreservar?: readonly string[] | null) {
  const preservar = [...new Set(perfisAPreservar ?? [])].sort();
  return useQuery({
    queryKey: chavesDeParticipacoes.pessoas(preservar),
    queryFn: () => listarPessoasParaParticipacao(preservar),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLimiarDeAlerta() {
  return useQuery({
    queryKey: chavesDeParticipacoes.limiar,
    queryFn: lerLimiarDeAlerta,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTodosOsPadroes() {
  return useQuery({
    queryKey: chavesDeParticipacoes.todosOsPadroes,
    queryFn: listarTodosOsPadroes,
  });
}

function useInvalidarPadroes() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: chavesDeParticipacoes.todosOsPadroes }),
      qc.invalidateQueries({ queryKey: ["bu-default-shares"] }),
    ]);
}

export function useAtualizarPadrao() {
  const invalidar = useInvalidarPadroes();
  return useMutation({
    mutationFn: ({
      id,
      anterior,
      padrao,
    }: {
      id: string;
      anterior: PadraoAGravar;
      padrao: PadraoAGravar;
    }) => atualizarPadrao(id, anterior, padrao),
    onSuccess: invalidar,
  });
}

export function useAdicionarPadrao() {
  const invalidar = useInvalidarPadroes();
  return useMutation({
    mutationFn: (padrao: PadraoAGravar) => adicionarPadrao(padrao),
    onSuccess: invalidar,
  });
}

export function useDesativarPadrao() {
  const invalidar = useInvalidarPadroes();
  return useMutation({
    mutationFn: (id: string) => desativarPadrao(id),
    onSuccess: invalidar,
  });
}

export function useSalvarLimiarDeAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (limiar: { percentual: number; confirmado: boolean }) =>
      salvarLimiarDeAlerta(limiar),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesDeParticipacoes.limiar }),
  });
}

export function useContratosSemParticipacao() {
  return useQuery({
    queryKey: chavesDeParticipacoes.backfill,
    queryFn: listarContratosSemParticipacao,
  });
}

function useInvalidarParticipacoes() {
  const qc = useQueryClient();
  return (contratoId: string) => {
    void qc.invalidateQueries({ queryKey: chavesDeParticipacoes.doContrato(contratoId) });
    void qc.invalidateQueries({ queryKey: ["contracts"] });
  };
}

export function useGravarParticipacoes() {
  const invalidar = useInvalidarParticipacoes();
  return useMutation({
    mutationFn: ({
      contratoId,
      linhas,
    }: {
      contratoId: string;
      linhas: readonly ParticipacaoAGravar[];
    }) => gravarParticipacoes(contratoId, linhas),
    onSuccess: (_dado, variaveis) => invalidar(variaveis.contratoId),
  });
}
