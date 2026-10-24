import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { avisarEInvalidar } from "@/shared/lib/avisar-erro";
import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";
import { chavesDoConteudo } from "@/modules/content/hooks/use-content";
import { chavesDeContratos } from "@/modules/contracts/hooks/use-contracts";
import { chavesDeReunioes } from "@/modules/meetings/hooks/use-meetings";
import { chavesDoOnboarding } from "@/modules/onboarding/hooks/use-onboarding";
import { chavesDeResultado } from "@/modules/financial/hooks/use-result";
import { chavesDoPipeline } from "@/modules/pipeline/hooks/use-pipeline";
import { chavesDeTarefa } from "@/modules/tasks/hooks/use-tasks";
import { rotuloDoEstagio, type Estagio } from "@/modules/pipeline/domain/stage";

import {
  apagarCliente,
  atualizarDadosDoCliente,
  corrigirDataDoStatus,
  criarCliente,
  definirConfidencialidade,
  definirPastaDoDrive,
  definirResponsavel,
  definirAssinatura,
  definirStatusDoCliente,
  desfazerFechamento,
  listarClientes,
  listarCorrecoesDeData,
  listarGanhasSemContrato,
  listarResponsaveisPossiveis,
  type DadosEditaveisDoCliente,
  type FiltrosDeClientes,
  type StatusDeCliente,
} from "../api/clients.repository";

export const chavesDeClientes = {
  raiz: ["clients"] as const,
  lista: (filtros: FiltrosDeClientes) => ["clients", "lista", filtros] as const,
  responsaveis: (atual: string | null) => ["clients", "responsaveis", atual] as const,
  ganhasSemContrato: ["clients", "ganhas-sem-contrato"] as const,
  correcoes: (clienteId: string) => ["clients", "correcoes", clienteId] as const,
};

export function useClients(filtros: FiltrosDeClientes) {
  return useQuery({
    queryKey: chavesDeClientes.lista(filtros),
    queryFn: () => listarClientes(filtros),
    placeholderData: keepPreviousData,
  });
}

export function useResponsaveisPossiveis(responsavelAtualId: string | null) {
  return useQuery({
    queryKey: chavesDeClientes.responsaveis(responsavelAtualId),
    queryFn: () => listarResponsaveisPossiveis(responsavelAtualId),
    staleTime: 5 * 60 * 1000,
  });
}

function aoFalhar(erro: unknown) {
  toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar.");
}

export function useDefinirResponsavel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      clienteId,
      responsavelId,
    }: {
      clienteId: string;
      responsavelId: string | null;
    }) => definirResponsavel(clienteId, responsavelId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
      toast.success("Responsável atualizado.");
    },
    onError: aoFalhar,
  });
}

export function useDefinirPastaDoDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, valor }: { clienteId: string; valor: string }) =>
      definirPastaDoDrive(clienteId, valor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
      toast.success("Pasta do Drive atualizada.");
    },
    onError: aoFalhar,
  });
}

export function useDefinirConfidencialidade(clienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    scope: { id: `cliente-confidencial:${clienteId}` },
    mutationFn: ({
      clienteId,
      confidencial,
      nota,
    }: {
      clienteId: string;
      confidencial: boolean;
      nota?: string | null;
    }) => definirConfidencialidade(clienteId, confidencial, nota),
    onSuccess: (_vazio, { confidencial, nota }) => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
      if (nota !== undefined) {
        toast.success("Nota salva.");
        return;
      }
      toast.success(
        confidencial
          ? "Cliente marcado como confidencial."
          : "Marca de confidencialidade removida.",
      );
    },
    onError: aoFalhar,
  });
}

export function useCriarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: criarCliente,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeContratos.clientes });
    },
  });
}

export function useGanhasSemContrato(habilitado: boolean) {
  return useQuery({
    queryKey: chavesDeClientes.ganhasSemContrato,
    queryFn: listarGanhasSemContrato,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useAtualizarDadosDoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, campos }: { id: string; campos: DadosEditaveisDoCliente }) =>
      atualizarDadosDoCliente(id, campos),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
    },
    onError: avisarEInvalidar(qc, chavesDeClientes.raiz, "Não foi possível salvar."),
  });
}

export function useDefinirAssinatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: string | null }) => definirAssinatura(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
    },
    onError: avisarEInvalidar(qc, chavesDeClientes.raiz, "Não foi possível salvar a data."),
  });
}

export function useCorrecoesDeData(clienteId: string | null) {
  return useQuery({
    queryKey: chavesDeClientes.correcoes(clienteId ?? ""),
    queryFn: () => listarCorrecoesDeData(clienteId ?? ""),
    enabled: clienteId !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useCorrigirDataDoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      campo,
      data,
    }: {
      id: string;
      campo: "churned_at" | "paused_at";
      data: string;
    }) => corrigirDataDoStatus(id, campo, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
    },
    onError: avisarEInvalidar(qc, chavesDeClientes.raiz, "Não foi possível corrigir a data."),
  });
}

export function useDefinirStatusDoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusDeCliente }) =>
      definirStatusDoCliente(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
    },
    onError: avisarEInvalidar(qc, chavesDeClientes.raiz, "Não foi possível mudar o status."),
  });
}

export function useApagarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apagarCliente(id),
    onSuccess: (resultado) => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeContratos.lista });
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeResultado.raiz });
      void qc.invalidateQueries({ queryKey: chavesDoOnboarding.raiz });
      void qc.invalidateQueries({ queryKey: chavesDoConteudo.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeTarefa.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeReunioes.raiz });
      void qc.invalidateQueries({ queryKey: ["financial"] });
      void qc.invalidateQueries({ queryKey: ["fiscal"] });
      void qc.invalidateQueries({ queryKey: ["gastos"] });

      const n = resultado.contratosApagados;
      toast.success(
        n === 0
          ? "Cliente apagado."
          : `Cliente apagado, com ${n === 1 ? "1 contrato" : `${n} contratos`}.`,
      );
    },
    onError: aoFalhar,
  });
}

export function useDesfazerFechamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vendaId, motivo }: { vendaId: string; motivo: string }) =>
      desfazerFechamento(vendaId, motivo),
    onSuccess: (resultado) => {
      void qc.invalidateQueries({ queryKey: chavesDeClientes.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeContratos.lista });
      void qc.invalidateQueries({ queryKey: chavesDoPipeline.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeResultado.raiz });
      void qc.invalidateQueries({ queryKey: ["proposals"] });

      const contratos =
        resultado.contratosApagados === 1
          ? "1 contrato apagado"
          : `${resultado.contratosApagados} contratos apagados`;

      toast.success(
        resultado.estagioRestaurado === null
          ? `Fechamento desfeito (${contratos}). A venda continua em "Fechado". Mova o card para a etapa certa à mão.`
          : `Fechamento desfeito: ${contratos} e a venda voltou para "${rotuloDoEstagio(resultado.estagioRestaurado as Estagio)}".`,
      );
    },
    onError: aoFalhar,
  });
}
