import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";
import { toast } from "sonner";

import { chavesDeGastos } from "./use-expenses";
import {
  apagarPessoaDaFolha,
  atualizarPessoa,
  criarPessoa,
  definirSituacaoDaPessoa,
  lerCustoDeFolhaPorBu,
  lerEquipe,
  lerVeFolha,
  listarPerfis,
  listarPessoas,
  type PessoaParaGravar,
} from "../api/payroll.repository";

export const chavesDeFolha = {
  raiz: ["folha"] as const,
  custoPorBu: ["folha", "custo-por-bu"] as const,
  equipe: ["folha", "equipe"] as const,
  veFolha: ["folha", "ve-folha"] as const,
  cadastro: (incluirInativas: boolean) => ["folha", "cadastro", incluirInativas] as const,
  perfis: (perfilAtualId: string | null) => ["folha", "perfis", perfilAtualId] as const,
};

export function useCustoDeFolhaPorBu({ habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: chavesDeFolha.custoPorBu,
    queryFn: lerCustoDeFolhaPorBu,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useEquipe({ habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: chavesDeFolha.equipe,
    queryFn: lerEquipe,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useVeFolha() {
  return useQuery({
    queryKey: chavesDeFolha.veFolha,
    queryFn: lerVeFolha,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function usePessoasCadastradas({ incluirInativas = false } = {}) {
  return useQuery({
    queryKey: chavesDeFolha.cadastro(incluirInativas),
    queryFn: () => listarPessoas({ incluirInativas }),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function usePerfisParaVincular(perfilAtualId: string | null = null) {
  return useQuery({
    queryKey: chavesDeFolha.perfis(perfilAtualId),
    queryFn: () => listarPerfis(perfilAtualId),
    retry: SEM_RETENTATIVA_EM_RECUSA,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidarFolha() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: chavesDeFolha.raiz });
    void qc.invalidateQueries({ queryKey: chavesDeGastos.raiz });
  };
}

function aoFalhar(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar.";
  toast.error(`A folha NÃO foi salva. ${mensagem}`);
}

export function useCriarPessoa() {
  const invalidar = useInvalidarFolha();
  return useMutation({
    mutationFn: (dados: PessoaParaGravar) => criarPessoa(dados),
    onSuccess: () => {
      invalidar();
      toast.success("Pessoa cadastrada. O custo dela já está no painel.");
    },
    onError: aoFalhar,
  });
}

export function useAtualizarPessoa() {
  const invalidar = useInvalidarFolha();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: PessoaParaGravar }) =>
      atualizarPessoa(id, dados),
    onSuccess: () => {
      invalidar();
      toast.success("Folha atualizada.");
    },
    onError: aoFalhar,
  });
}

export function useDefinirSituacaoDaPessoa() {
  const invalidar = useInvalidarFolha();
  return useMutation({
    mutationFn: ({ id, ativa }: { id: string; ativa: boolean }) =>
      definirSituacaoDaPessoa(id, ativa),
    onSuccess: invalidar,
    onError: aoFalhar,
  });
}

export function useApagarPessoaDaFolha() {
  const invalidar = useInvalidarFolha();
  return useMutation({
    mutationFn: (id: string) => apagarPessoaDaFolha(id),
    onSuccess: () => {
      invalidar();
      toast.success("Pessoa apagada da folha.");
    },
    onError: (erro: unknown) => {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível apagar.";
      toast.error(`A pessoa NÃO foi apagada da folha. ${mensagem}`);
    },
  });
}
