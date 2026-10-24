import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  buscarSecoes,
  listarSecoes,
  salvarSecao,
  type AreaDoPlaybook,
  type DadosDaSecao,
} from "../api/playbook.repository";

export const chavesDoPlaybook = {
  raiz: ["playbook"] as const,
  secoes: (area: AreaDoPlaybook) => ["playbook", "secoes", area] as const,
  busca: (termo: string) => ["playbook", "busca", termo] as const,
};

export function usePlaybook(area: AreaDoPlaybook) {
  return useQuery({
    queryKey: chavesDoPlaybook.secoes(area),
    queryFn: () => listarSecoes(area),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useBuscaNoPlaybook(termo: string) {
  return useQuery({
    queryKey: chavesDoPlaybook.busca(termo),
    queryFn: () => buscarSecoes(termo),
    enabled: termo.trim() !== "",
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useSalvarSecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dados,
      updatedAt,
    }: {
      id: string;
      dados: DadosDaSecao;
      updatedAt: string;
    }) => salvarSecao(id, dados, updatedAt),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chavesDoPlaybook.raiz });
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDoPlaybook.raiz });
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a seção.");
    },
  });
}
