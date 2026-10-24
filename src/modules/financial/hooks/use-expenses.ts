import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";
import { toast } from "sonner";

import {
  apagarDespesa,
  atualizarDespesa,
  criarDespesa,
  definirSituacaoDaDespesa,
  lerDespesasEfetivas,
  lerProjecaoDeCusto,
  lerQuedaDeCusto,
  listarAgrupadores,
  listarDespesasCadastradas,
  type DespesaParaGravar,
} from "../api/expenses.repository";

export const chavesDeGastos = {
  raiz: ["gastos"] as const,
  efetivas: ["gastos", "efetivas"] as const,
  projecao: ["gastos", "projecao"] as const,
  queda: ["gastos", "queda"] as const,
  cadastradas: (incluirInativas: boolean) => ["gastos", "cadastradas", incluirInativas] as const,
  agrupadores: (agrupadorAtualId: string | null) =>
    ["gastos", "agrupadores", agrupadorAtualId] as const,
};

export function useDespesasEfetivas({ habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: chavesDeGastos.efetivas,
    queryFn: lerDespesasEfetivas,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useProjecaoDeCusto({ habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: chavesDeGastos.projecao,
    queryFn: lerProjecaoDeCusto,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useQuedaDeCusto({ habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: chavesDeGastos.queda,
    queryFn: lerQuedaDeCusto,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useDespesasCadastradas({ incluirInativas = false } = {}) {
  return useQuery({
    queryKey: chavesDeGastos.cadastradas(incluirInativas),
    queryFn: () => listarDespesasCadastradas({ incluirInativas }),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useAgrupadores(agrupadorAtualId: string | null = null) {
  return useQuery({
    queryKey: chavesDeGastos.agrupadores(agrupadorAtualId),
    queryFn: () => listarAgrupadores(agrupadorAtualId),
    retry: SEM_RETENTATIVA_EM_RECUSA,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidarGastos() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: chavesDeGastos.raiz });
  };
}

function aoFalhar(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar.";
  toast.error(`A despesa NÃO foi salva. ${mensagem}`);
}

export function useCriarDespesa() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: (dados: DespesaParaGravar) => criarDespesa(dados),
    onSuccess: () => {
      invalidar();
      toast.success("Despesa cadastrada.");
    },
    onError: aoFalhar,
  });
}

export function useAtualizarDespesa() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: DespesaParaGravar }) =>
      atualizarDespesa(id, dados),
    onSuccess: () => {
      invalidar();
      toast.success("Despesa atualizada.");
    },
    onError: aoFalhar,
  });
}

export function useDefinirSituacaoDaDespesa() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      definirSituacaoDaDespesa(id, ativa),
    onSuccess: invalidar,
    onError: aoFalhar,
  });
}

export function useApagarDespesa() {
  const invalidar = useInvalidarGastos();
  return useMutation({
    mutationFn: (id: string) => apagarDespesa(id),
    onSuccess: () => {
      invalidar();
      toast.success("Despesa apagada.");
    },
    onError: (erro: unknown) => {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível apagar.";
      toast.error(`A despesa NÃO foi apagada. ${mensagem}`);
    },
  });
}
