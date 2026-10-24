import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { avisarErro } from "@/shared/lib/avisar-erro";

import { apagarConversa, renomearConversa } from "../api/conversas.repository";

export const chavesDeConversas = {
  lista: ["ai-conversas"] as const,
};

export function useApagarConversa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apagarConversa(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeConversas.lista });
      toast.success("Conversa apagada.");
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDeConversas.lista });
      avisarErro("Não foi possível apagar a conversa.")(erro);
    },
  });
}

export function useRenomearConversa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, titulo }: { id: string; titulo: string }) => renomearConversa(id, titulo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeConversas.lista });
      toast.success("Conversa renomeada.");
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDeConversas.lista });
      avisarErro("Não foi possível renomear a conversa.")(erro);
    },
  });
}
