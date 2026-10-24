import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { chavesDeGastos } from "@/modules/financial/hooks/use-expenses";
import { chavesFiscais } from "@/modules/financial/hooks/use-fiscal";
import { chavesDoFinanceiro } from "@/modules/financial/hooks/use-financial";
import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";

import {
  apagarContrato,
  listarClientesParaSelecao,
  listarContratos,
  listarContratosDoCliente,
  listarProdutosAtivos,
  listarVendasParaContrato,
  salvarContrato,
  type DadosParaSalvarContrato,
} from "../api/contracts.repository";

export const chavesDeContratos = {
  lista: ["contracts"] as const,
  clientes: ["contracts", "clientes-para-selecao"] as const,
  produtos: ["contracts", "produtos-ativos"] as const,
  doCliente: (clienteId: string) => ["contracts", "do-cliente", clienteId] as const,
  vendasParaContrato: ["opportunities", "vendas-para-contrato"] as const,
};

export function useContracts() {
  return useQuery({
    queryKey: chavesDeContratos.lista,
    queryFn: listarContratos,
  });
}

export function useClientesParaSelecao() {
  return useQuery({
    queryKey: chavesDeContratos.clientes,
    queryFn: listarClientesParaSelecao,
  });
}

export function useContratosDoCliente(clienteId: string | null) {
  return useQuery({
    queryKey: chavesDeContratos.doCliente(clienteId ?? ""),
    queryFn: () => listarContratosDoCliente(clienteId ?? ""),
    enabled: clienteId !== null,
  });
}

export function useVendasParaContrato(habilitado: boolean) {
  return useQuery({
    queryKey: chavesDeContratos.vendasParaContrato,
    queryFn: listarVendasParaContrato,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useProdutosAtivos() {
  return useQuery({
    queryKey: chavesDeContratos.produtos,
    queryFn: listarProdutosAtivos,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveContract() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (dados: DadosParaSalvarContrato) => salvarContrato(dados),
    onSuccess: () => invalidarOQueOContratoMuda(qc),
  });
}

function invalidarOQueOContratoMuda(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: chavesDeContratos.lista });
  void qc.invalidateQueries({ queryKey: ["opportunities"] });
  void qc.invalidateQueries({ queryKey: chavesDoFinanceiro.raiz });
  void qc.invalidateQueries({ queryKey: chavesFiscais.raiz });
  void qc.invalidateQueries({ queryKey: chavesDeGastos.raiz });
  void qc.invalidateQueries({ queryKey: ["resultado"] });
  void qc.invalidateQueries({ queryKey: ["clients"] });
  void qc.invalidateQueries({ queryKey: ["proposals"] });
}

export function useApagarContrato() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apagarContrato(id),
    onSuccess: (_dado, contratoApagado) => {
      invalidarOQueOContratoMuda(qc);
      void qc.invalidateQueries({ queryKey: ["proposals", "a-criar"] });
      qc.setQueryData<Record<string, string>>(["ligacoes-pendentes-de-proposta"], (mapa) =>
        mapa === undefined
          ? mapa
          : Object.fromEntries(
              Object.entries(mapa).filter(([, contratoId]) => contratoId !== contratoApagado),
            ),
      );
      toast.success("Contrato apagado.");
    },
    onError: (erro: unknown) => {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível apagar o contrato.");
    },
  });
}
