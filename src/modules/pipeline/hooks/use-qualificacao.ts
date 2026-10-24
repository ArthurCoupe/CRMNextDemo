import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  lerCatalogoParaEdicao,
  salvarCatalogoDeQualificacao,
  type CatalogoLidoParaEdicao,
} from "../api/qualificacao.repository";
import type { PerguntaDoCatalogo } from "../domain/qualification";
import { chavesDoPipeline } from "./use-pipeline";

export const chaveDoCatalogoEmEdicao = [...chavesDoPipeline.catalogo, "edicao"] as const;

export function useCatalogoParaEdicao() {
  return useQuery({
    queryKey: chaveDoCatalogoEmEdicao,
    queryFn: lerCatalogoParaEdicao,
    retry: SEM_RETENTATIVA_EM_RECUSA,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useSalvarCatalogoDeQualificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lido,
      perguntas,
    }: {
      lido: CatalogoLidoParaEdicao;
      perguntas: readonly PerguntaDoCatalogo[];
    }) => salvarCatalogoDeQualificacao(lido, perguntas),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chavesDoPipeline.catalogo });
      toast.success("Perguntas salvas. As respostas já dadas não mudam.");
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.catalogo });
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar as perguntas.");
    },
  });
}
