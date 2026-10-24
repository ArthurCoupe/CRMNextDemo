import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { avisarErro } from "@/shared/lib/avisar-erro";
import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  definirPreferencia,
  lerDesligados,
  lerHistorico,
  lerUltimaPassada,
} from "../api/notifications.repository";
import type { TipoDeAviso } from "../domain/notificacoes";

export const chavesDeNotificacao = {
  raiz: ["notificacoes"] as const,
  historico: ["notificacoes", "historico"] as const,
  preferencias: ["notificacoes", "preferencias"] as const,
  ultimaPassada: ["notificacoes", "ultima-passada"] as const,
};

export function usePreferenciasDesligadas(profileId: string | null) {
  return useQuery({
    queryKey: [...chavesDeNotificacao.preferencias, profileId],
    queryFn: () => lerDesligados(profileId ?? ""),
    enabled: profileId !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useHistoricoDeAvisos() {
  return useQuery({
    queryKey: chavesDeNotificacao.historico,
    queryFn: lerHistorico,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useUltimaPassada() {
  return useQuery({
    queryKey: chavesDeNotificacao.ultimaPassada,
    queryFn: lerUltimaPassada,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useDefinirPreferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      tipo,
      ativo,
    }: {
      profileId: string;
      tipo: TipoDeAviso;
      ativo: boolean;
    }) => definirPreferencia(profileId, tipo, ativo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeNotificacao.preferencias });
    },
    onError: avisarErro("Não foi possível salvar a preferência."),
  });
}
