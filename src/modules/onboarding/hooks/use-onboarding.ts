import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { avisarEInvalidar, avisarErro } from "@/shared/lib/avisar-erro";
import { chavesDeTarefa } from "@/modules/tasks/hooks/use-tasks";

import {
  apagarJornada,
  definirPapel,
  editarEtapaDaJornada,
  editarItemDaJornada,
  iniciarJornada,
  lerClientesComJornada,
  lerJornada,
  lerPapeis,
  lerPapeisExigidosPeloMetodo,
  liberarEtapa,
  marcarItem,
  type ClienteParaJornada,
} from "../api/onboarding.repository";
import type { EdicaoDaEtapa, EdicaoDoItem } from "../domain/onboarding";

export const chavesDoOnboarding = {
  raiz: ["onboarding"] as const,
  clientes: ["onboarding", "clientes"] as const,
  jornada: (id: string) => ["onboarding", "jornada", id] as const,
  papeis: ["onboarding", "papeis"] as const,
  papeisDoMetodo: ["onboarding", "papeis-do-metodo"] as const,
};

export function useClientesComJornada() {
  return useQuery({
    queryKey: chavesDoOnboarding.clientes,
    queryFn: lerClientesComJornada,
    staleTime: 60 * 1000,
  });
}

export function useJornada(jornadaId: string | null) {
  return useQuery({
    queryKey: chavesDoOnboarding.jornada(jornadaId ?? "sem-jornada"),
    queryFn: () => lerJornada(jornadaId as string),
    enabled: jornadaId !== null,
  });
}

export function usePapeis() {
  return useQuery({
    queryKey: chavesDoOnboarding.papeis,
    queryFn: lerPapeis,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePapeisExigidosPeloMetodo() {
  return useQuery({
    queryKey: chavesDoOnboarding.papeisDoMetodo,
    queryFn: lerPapeisExigidosPeloMetodo,
    staleTime: Infinity,
  });
}

export function useDefinirPapel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { papel: string; pessoaId: string | null }) =>
      definirPapel(v.papel, v.pessoaId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
      toast.success("Papel atualizado");
    },
    onError: avisarErro("Não foi possível salvar o papel."),
  });
}

export function useIniciarJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clienteId: string) => iniciarJornada(clienteId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
      toast.success("Jornada aberta. O método foi copiado para ela");
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.clientes });
      avisarErro("Não foi possível abrir a jornada.")(erro);
    },
  });
}

export function useLiberarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { etapaId: string; forcar?: boolean }) =>
      liberarEtapa(v.etapaId, v.forcar ?? false),
    onSuccess: (quantas) => {
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz });
      toast.success(
        quantas === 1 ? "1 tarefa criada no quadro" : `${quantas} tarefas criadas no quadro`,
      );
    },
    onError: avisarErro("Não foi possível liberar a etapa."),
  });
}

export function useMarcarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; concluido: boolean }) => marcarItem(v.itemId, v.concluido),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz });
    },
    onError: avisarErro("Não foi possível marcar o item."),
  });
}

export function useApagarJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jornadaId: string) => apagarJornada(jornadaId),
    onSuccess: (cartoes, jornadaId) => {
      qc.setQueryData<readonly ClienteParaJornada[]>(chavesDoOnboarding.clientes, (lista) =>
        lista?.map((c) =>
          c.jornadaId === jornadaId ? { ...c, jornadaId: null, jornadaConcluida: false } : c,
        ),
      );
      qc.removeQueries({ queryKey: chavesDoOnboarding.jornada(jornadaId), exact: true });
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz });
      toast.success(
        cartoes === 0
          ? "Jornada apagada."
          : cartoes === 1
            ? "Jornada apagada, com 1 cartão do quadro."
            : `Jornada apagada, com ${cartoes} cartões do quadro.`,
      );
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
      avisarErro("Não foi possível apagar a jornada.")(erro);
    },
  });
}

export function useEditarItemDaJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; campos: EdicaoDoItem }) =>
      editarItemDaJornada(v.itemId, v.campos),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz }),
        qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz }),
      ]);
      toast.success("Item atualizado");
    },
    onError: avisarEInvalidar(qc, chavesDoOnboarding.raiz, "Não foi possível salvar o item."),
  });
}

export function useEditarEtapaDaJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { etapaId: string; campos: EdicaoDaEtapa }) =>
      editarEtapaDaJornada(v.etapaId, v.campos),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
      toast.success("Etapa atualizada");
    },
    onError: avisarEInvalidar(qc, chavesDoOnboarding.raiz, "Não foi possível salvar a etapa."),
  });
}
