import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { chavesDeResultado } from "@/modules/financial/hooks/use-result";
import { chavesDeTarefa } from "@/modules/tasks/hooks/use-tasks";
import { avisarErro } from "@/shared/lib/avisar-erro";
import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";
import type { PapelDoUsuario } from "@/integrations/supabase/papel";

import {
  atualizarPerfil,
  definirPapelDaPessoa,
  definirSituacaoDaPessoa,
  lerMetasDeAtividade,
  lerMetasFinanceiras,
  lerTime,
  salvarMetas,
} from "../api/settings.repository";

export const chavesDeConfiguracoes = {
  raiz: ["configuracoes"] as const,
  metasDeAtividade: ["configuracoes", "metas", "atividade"] as const,
  metasFinanceiras: ["configuracoes", "metas", "financeiras"] as const,
  metas: ["configuracoes", "metas"] as const,
  time: ["configuracoes", "time"] as const,
};

export function useMetasDeAtividade() {
  return useQuery({
    queryKey: chavesDeConfiguracoes.metasDeAtividade,
    queryFn: lerMetasDeAtividade,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useMetasFinanceiras() {
  return useQuery({
    queryKey: chavesDeConfiguracoes.metasFinanceiras,
    queryFn: lerMetasFinanceiras,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useTime() {
  return useQuery({
    queryKey: chavesDeConfiguracoes.time,
    queryFn: lerTime,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useSalvarMetas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salvarMetas,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeConfiguracoes.metas });
      void qc.invalidateQueries({ queryKey: chavesDeResultado.raiz });
      toast.success("Metas salvas");
    },
    onError: avisarErro("Não foi possível salvar as metas."),
  });
}

export function useDefinirSituacaoDaPessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      definirSituacaoDaPessoa(id, ativo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeConfiguracoes.time });
      void qc.invalidateQueries({ queryKey: chavesDeTarefa.time });
    },
    onError: avisarErro("Não foi possível mudar a situação da pessoa."),
  });
}

export function useDefinirPapelDaPessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, papel }: { id: string; papel: PapelDoUsuario }) =>
      definirPapelDaPessoa(id, papel),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeConfiguracoes.time });
      void qc.invalidateQueries({ queryKey: chavesDeTarefa.time });
    },
    onError: avisarErro("Não foi possível mudar o papel da pessoa."),
  });
}

const CHAVE_DA_GRAVACAO_DO_PERFIL = ["configuracoes", "perfil", "gravar"] as const;

export function usePerfilEmGravacao(): boolean {
  return useIsMutating({ mutationKey: CHAVE_DA_GRAVACAO_DO_PERFIL }) > 0;
}

export function useAtualizarPerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CHAVE_DA_GRAVACAO_DO_PERFIL,
    mutationFn: ({
      id,
      dados,
    }: {
      id: string;
      dados: { nomeCompleto: string; cargo: string | null };
    }) => atualizarPerfil(id, dados),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: chavesDeConfiguracoes.time }),
        qc.invalidateQueries({ queryKey: chavesDeTarefa.time }),
        qc.invalidateQueries({ queryKey: ["profile"] }),
        qc.invalidateQueries({ queryKey: ["profiles", "beneficiarios"] }),
        qc.invalidateQueries({ queryKey: ["bu-default-shares"] }),
      ]),
    onError: avisarErro("Não foi possível salvar o perfil."),
  });
}
