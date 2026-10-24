import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";
import { toast } from "sonner";

import type { MeioDePagamento } from "@/modules/contracts/domain/contract";

import {
  definirAliquota,
  definirTaxaDeParcelamento,
  definirTaxasDoMeio,
  lerConfiguracaoFiscal,
  lerLiquidoPorContrato,
  lerLiquidoTotal,
  lerTabelaDeParcelamento,
  lerTaxasPorMeio,
} from "../api/fiscal.repository";
import { calcularLiquido, type BaseDoLiquido, type Liquido } from "../domain/fiscal";

export const chavesFiscais = {
  raiz: ["fiscal"] as const,
  configuracao: ["fiscal", "settings"] as const,
  parcelamento: ["fiscal", "gateway-fees"] as const,
  taxasPorMeio: ["fiscal", "payment-method-fees"] as const,
  liquidoPorContrato: ["fiscal", "net-revenue"] as const,
  liquidoTotal: ["fiscal", "net-revenue-total"] as const,
};

const CONFIGURACAO_MUDA_POUCO = { staleTime: 5 * 60 * 1000 };

export function useConfiguracaoFiscal() {
  return useQuery({
    queryKey: chavesFiscais.configuracao,
    queryFn: lerConfiguracaoFiscal,
    retry: SEM_RETENTATIVA_EM_RECUSA,
    ...CONFIGURACAO_MUDA_POUCO,
  });
}

export function useTabelaDeParcelamento() {
  return useQuery({
    queryKey: chavesFiscais.parcelamento,
    queryFn: lerTabelaDeParcelamento,
    retry: SEM_RETENTATIVA_EM_RECUSA,
    ...CONFIGURACAO_MUDA_POUCO,
  });
}

export function useTaxasPorMeio() {
  return useQuery({
    queryKey: chavesFiscais.taxasPorMeio,
    queryFn: lerTaxasPorMeio,
    retry: SEM_RETENTATIVA_EM_RECUSA,
    ...CONFIGURACAO_MUDA_POUCO,
  });
}

export function useLiquidoPorContrato({ habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: chavesFiscais.liquidoPorContrato,
    queryFn: lerLiquidoPorContrato,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useLiquidoTotal({ habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: chavesFiscais.liquidoTotal,
    queryFn: lerLiquidoTotal,
    enabled: habilitado,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useSimulacaoDeLiquido(base: BaseDoLiquido | null): {
  readonly liquido: Liquido | null;
  readonly carregando: boolean;
  readonly erro: boolean;
} {
  const config = useConfiguracaoFiscal();
  const tabela = useTabelaDeParcelamento();
  const taxas = useTaxasPorMeio();

  const carregando = config.isPending || tabela.isPending || taxas.isPending;
  const erro = config.isError || tabela.isError || taxas.isError;

  if (base === null || carregando || erro) {
    return { liquido: null, carregando, erro };
  }
  if (config.data == null || tabela.data == null || taxas.data == null) {
    return { liquido: null, carregando: false, erro: true };
  }

  const taxasDoMeio = taxas.data.get(base.meioDePagamento);
  if (taxasDoMeio === undefined) {
    return { liquido: null, carregando: false, erro: true };
  }

  return {
    liquido: calcularLiquido(base, config.data, taxasDoMeio, tabela.data),
    carregando: false,
    erro: false,
  };
}

function useInvalidarFiscal() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: chavesFiscais.raiz });
  };
}

function aoFalhar(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar.";
  toast.error(`A alteração NÃO foi salva. ${mensagem}`);
}

export function useDefinirAliquota() {
  const invalidar = useInvalidarFiscal();
  return useMutation({ mutationFn: definirAliquota, onSuccess: invalidar, onError: aoFalhar });
}

export function useDefinirTaxaDeParcelamento() {
  const invalidar = useInvalidarFiscal();
  return useMutation({
    mutationFn: ({ parcelas, percentual }: { parcelas: number; percentual: number }) =>
      definirTaxaDeParcelamento(parcelas, percentual),
    onSuccess: invalidar,
    onError: aoFalhar,
  });
}

export function useDefinirTaxasDoMeio() {
  const invalidar = useInvalidarFiscal();
  return useMutation({
    mutationFn: (dados: {
      meio: MeioDePagamento;
      taxaFixa?: number;
      percentualVariavel?: number;
      liquidacao?: string | null;
      parcelavel?: boolean;
    }) => definirTaxasDoMeio(dados),
    onSuccess: invalidar,
    onError: aoFalhar,
  });
}
