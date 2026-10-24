import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { avisarEInvalidar, avisarErro } from "@/shared/lib/avisar-erro";
import { todaySP } from "@/shared/lib/date";

import {
  adicionarLink,
  adicionarParticipantes,
  apagarTarefa,
  atualizarLink,
  atualizarTarefa,
  criarTarefa,
  lerCatalogo,
  lerClientesParaSelecao,
  lerPessoasDoTime,
  lerTarefas,
  moverTarefa,
  removerLink,
  removerParticipante,
  type FiltrosDeTarefa,
  type NovaTarefa,
} from "../api/tasks.repository";
import type { AlteracaoDaTarefa } from "../domain/edicao";
import type { ColunaDaTarefa } from "../domain/task";

export const chavesDeTarefa = {
  raiz: ["tasks"] as const,
  lista: (f: FiltrosDeTarefa, hojeSP: string) => ["tasks", "lista", f, hojeSP] as const,
  catalogo: ["tasks", "catalog"] as const,
  time: ["tasks", "time"] as const,
  clientes: ["tasks", "clientes-para-selecao"] as const,
};

export function useTarefas(filtros: FiltrosDeTarefa, habilitado: boolean) {
  const hojeSP = todaySP();
  return useQuery({
    queryKey: chavesDeTarefa.lista(filtros, hojeSP),
    queryFn: () => lerTarefas(filtros, hojeSP),
    enabled: habilitado,
  });
}

export function useCatalogoDeTarefas() {
  return useQuery({
    queryKey: chavesDeTarefa.catalogo,
    queryFn: lerCatalogo,
    staleTime: Infinity,
  });
}

export function usePessoasDoTime() {
  return useQuery({
    queryKey: chavesDeTarefa.time,
    queryFn: lerPessoasDoTime,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientesParaSelecao() {
  return useQuery({
    queryKey: chavesDeTarefa.clientes,
    queryFn: lerClientesParaSelecao,
    staleTime: 5 * 60 * 1000,
  });
}

export const PARTICIPANTES_NAO_SALVOS =
  "Tarefa criada, mas os participantes não foram salvos. Abra a tarefa e adicione por lá.";

export function useCriarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nova: NovaTarefa): Promise<{ participantesSalvos: boolean }> => {
      const id = await criarTarefa(nova);
      if (nova.participantes.length === 0) return { participantesSalvos: true };
      try {
        await adicionarParticipantes(id, nova.participantes);
        return { participantesSalvos: true };
      } catch {
        return { participantesSalvos: false };
      }
    },
    onSuccess: ({ participantesSalvos }) => {
      void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz });
      if (participantesSalvos) toast.success("Tarefa criada");
      else toast.error(PARTICIPANTES_NAO_SALVOS);
    },
    onError: avisarErro("Não foi possível criar a tarefa."),
  });
}

export function useMoverTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; coluna: ColunaDaTarefa }) => moverTarefa(v.id, v.coluna),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz }),
    onError: avisarErro("Não foi possível mover a tarefa."),
  });
}

export function useAtualizarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; campos: AlteracaoDaTarefa }) => atualizarTarefa(v.id, v.campos),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz }),
    onError: avisarErro("Não foi possível salvar a tarefa."),
  });
}

export function useApagarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apagarTarefa(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz });
      toast.success("Tarefa apagada");
    },
    onError: avisarErro("Não foi possível apagar a tarefa."),
  });
}

export function useAdicionarParticipantes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; profileIds: readonly string[] }) =>
      adicionarParticipantes(v.taskId, v.profileIds),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz }),
    onError: avisarEInvalidar(qc, chavesDeTarefa.raiz, "Não foi possível incluir o participante."),
  });
}

export function useRemoverParticipante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; profileId: string }) =>
      removerParticipante(v.taskId, v.profileId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz }),
    onError: avisarEInvalidar(qc, chavesDeTarefa.raiz, "Não foi possível remover o participante."),
  });
}

export function useAdicionarLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; rotulo: string; url: string }) =>
      adicionarLink(v.taskId, v.rotulo, v.url),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz }),
    onError: avisarEInvalidar(qc, chavesDeTarefa.raiz, "Não foi possível incluir o link."),
  });
}

export function useRemoverLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removerLink(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz }),
    onError: avisarEInvalidar(qc, chavesDeTarefa.raiz, "Não foi possível remover o link."),
  });
}

export function useAtualizarLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; rotulo: string; url: string }) =>
      atualizarLink(v.id, v.rotulo, v.url),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz });
    },
    onError: avisarEInvalidar(qc, chavesDeTarefa.raiz, "Não foi possível salvar o link."),
  });
}
