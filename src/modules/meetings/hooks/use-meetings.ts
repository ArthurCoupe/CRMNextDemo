import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useProfile } from "@/hooks/use-profile";
import { lerSituacaoDoSegundoFator } from "@/modules/seguranca/api/mfa.repository";
import type { SituacaoDoSegundoFator } from "@/shared/lib/mfa";
import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  apagarReuniao,
  atualizarReuniao,
  buscarOportunidadesParaSelecao,
  cancelarReuniao,
  consultarConflitos,
  criarReuniao,
  desfazerCancelamento,
  listarClientesParaSelecao,
  listarReunioes,
  listarStaffParaSelecao,
  type AlteracaoDeReuniao,
  type DadosDeReuniao,
  type Reuniao,
} from "../api/meetings.repository";
import { lerPreparacao } from "../api/preparacao.repository";
import {
  duracaoValida,
  ReuniaoCriadaSemParticipantes,
  termoDaBuscaDeOportunidade,
} from "../domain/meeting";
import { montarFicha } from "../domain/preparacao";

type FiltrosDeReuniao = Parameters<typeof listarReunioes>[0];

export const chavesDeReunioes = {
  raiz: ["reunioes"] as const,
  listas: ["reunioes", "lista"] as const,
  lista: (filtros: FiltrosDeReuniao) => ["reunioes", "lista", filtros] as const,
  conflitos: (
    participantes: readonly string[],
    inicio: string,
    duracaoMinutos: number,
    excluirReuniaoId: string | null,
  ) => ["reunioes", "conflitos", participantes, inicio, duracaoMinutos, excluirReuniaoId] as const,
  clientesParaSelecao: ["reunioes", "clientes-para-selecao"] as const,
  buscaDeOportunidades: (termo: string) => ["reunioes", "busca-de-oportunidades", termo] as const,
  staffParaSelecao: ["reunioes", "staff-para-selecao"] as const,
  preparacao: (reuniaoId: string | null, papel: string | null, usuarioId: string | null) =>
    ["reunioes", "preparacao", reuniaoId, papel, usuarioId] as const,
};

function aoFalhar(erro: unknown) {
  toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a reunião.");
}

export function useReunioes(filtros: FiltrosDeReuniao) {
  return useQuery({
    queryKey: chavesDeReunioes.lista(filtros),
    queryFn: () => listarReunioes(filtros),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useConflitos(
  participantes: readonly string[],
  inicio: string,
  duracaoMinutos: number,
  excluirReuniaoId: string | null = null,
) {
  return useQuery({
    queryKey: chavesDeReunioes.conflitos(participantes, inicio, duracaoMinutos, excluirReuniaoId),
    queryFn: () => consultarConflitos(participantes, inicio, duracaoMinutos, excluirReuniaoId),
    enabled: participantes.length > 0 && inicio !== "" && duracaoValida(duracaoMinutos),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useClientesParaSelecao() {
  return useQuery({
    queryKey: chavesDeReunioes.clientesParaSelecao,
    queryFn: listarClientesParaSelecao,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBuscaDeOportunidades(digitado: string) {
  const termo = termoDaBuscaDeOportunidade(digitado);
  return useQuery({
    queryKey: chavesDeReunioes.buscaDeOportunidades(termo ?? ""),
    queryFn: () => buscarOportunidadesParaSelecao(termo ?? ""),
    enabled: termo !== null,
    placeholderData: keepPreviousData,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useStaffParaSelecao() {
  return useQuery({
    queryKey: chavesDeReunioes.staffParaSelecao,
    queryFn: listarStaffParaSelecao,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePreparacao(reuniao: Reuniao | null) {
  const { papel, meuId } = useProfile();
  return useQuery({
    queryKey: chavesDeReunioes.preparacao(reuniao?.id ?? null, papel, meuId),
    queryFn: async () => {
      if (reuniao === null) return [];
      const precisaDoFator =
        reuniao.clienteId !== null && (papel === "owner" || papel === "manager");
      const [dados, segundoFator] = await Promise.all([
        lerPreparacao(reuniao, { papel, usuarioId: meuId }),
        precisaDoFator
          ? lerSituacaoDoSegundoFator()
          : Promise.resolve<SituacaoDoSegundoFator>("ok"),
      ]);
      return montarFicha(dados, { papel, hoje: new Date(), segundoFator });
    },
    enabled: reuniao !== null && papel !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useCriarReuniao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosDeReuniao) => criarReuniao(dados),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
      toast.success("Reunião criada.");
    },
    onError: (erro: unknown) => {
      if (erro instanceof ReuniaoCriadaSemParticipantes) {
        void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
        toast.error("Reunião criada sem participantes. Edite para adicionar");
        return;
      }
      aoFalhar(erro);
    },
  });
}

export function useAtualizarReuniao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: AlteracaoDeReuniao }) =>
      atualizarReuniao(id, dados),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
      toast.success("Reunião salva.");
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
      aoFalhar(erro);
    },
  });
}

export function useCancelarReuniao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => cancelarReuniao(id, motivo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
      toast.success("Reunião cancelada.");
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
      aoFalhar(erro);
    },
  });
}

export function useDesfazerCancelamento() {
  const qc = useQueryClient();
  const reler = () => {
    void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
    return qc.invalidateQueries({ queryKey: chavesDeReunioes.listas }, { cancelRefetch: false });
  };
  return useMutation({
    mutationFn: ({ id, canceladaEm }: { id: string; canceladaEm: string }) =>
      desfazerCancelamento(id, canceladaEm),
    onSuccess: async () => {
      toast.success("Cancelamento desfeito. A reunião voltou à agenda.");
      await reler();
    },
    onError: async (erro: unknown) => {
      aoFalhar(erro);
      await reler();
    },
  });
}

export function useApagarReuniao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apagarReuniao(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
      toast.success("Reunião apagada.");
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
      aoFalhar(erro);
    },
  });
}
