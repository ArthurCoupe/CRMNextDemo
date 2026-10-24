import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { todaySP } from "@/shared/lib/date";
import { brl } from "@/shared/lib/format";
import { ehFaltaDePermissao, SEM_RETENTATIVA_EM_RECUSA } from "@/shared/lib/permissao";
import { toast } from "sonner";

import type { DataISO } from "../domain/mes-civil";
import {
  lerBreakEven,
  lerCustoPorBu,
  lerEncerramentos,
  lerHistorico,
  lerMetaDeMrr,
  lerResultadoConsolidado,
  lerResultadoPorBu,
  definirEntrega,
  regravarMes,
  reverterEncerramento,
} from "../api/result.repository";
import { chavesDoFinanceiro } from "./use-financial";
import { chavesFiscais } from "./use-fiscal";
import { chavesDeGastos } from "./use-expenses";

export const chavesDeResultado = {
  raiz: ["resultado"] as const,
  porBu: (mes: DataISO) => ["resultado", "por-bu", mes] as const,
  consolidado: (mes: DataISO) => ["resultado", "consolidado", mes] as const,
  custoPorBu: (mes: DataISO) => ["resultado", "custo-por-bu", mes] as const,
  historico: (meses: number) => ["resultado", "historico", meses] as const,
  breakEven: (mes: DataISO) => ["resultado", "break-even", mes] as const,
  meta: ["resultado", "meta"] as const,
  encerramentos: ["resultado", "encerramentos"] as const,
};

export function useResultadoPorBu(mes: DataISO | null) {
  return useQuery({
    queryKey: chavesDeResultado.porBu(mes ?? "sem-mes"),
    queryFn: () => lerResultadoPorBu(mes as DataISO),
    enabled: mes !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useResultadoConsolidado(mes: DataISO | null) {
  return useQuery({
    queryKey: chavesDeResultado.consolidado(mes ?? "sem-mes"),
    queryFn: () => lerResultadoConsolidado(mes as DataISO),
    enabled: mes !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useCustoPorBu(mes: DataISO | null) {
  return useQuery({
    queryKey: chavesDeResultado.custoPorBu(mes ?? "sem-mes"),
    queryFn: () => lerCustoPorBu(mes as DataISO),
    enabled: mes !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useHistoricoDeResultado(meses = 12) {
  return useQuery({
    queryKey: chavesDeResultado.historico(meses),
    queryFn: () => lerHistorico(meses),
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useBreakEven(mes: DataISO | null) {
  return useQuery({
    queryKey: chavesDeResultado.breakEven(mes ?? "sem-mes"),
    queryFn: () => lerBreakEven(mes as DataISO),
    enabled: mes !== null,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useMetaDeMrr() {
  return useQuery({
    queryKey: chavesDeResultado.meta,
    queryFn: lerMetaDeMrr,
    retry: SEM_RETENTATIVA_EM_RECUSA,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEncerramentosAutomaticos() {
  return useQuery({
    queryKey: chavesDeResultado.encerramentos,
    queryFn: lerEncerramentos,
    retry: SEM_RETENTATIVA_EM_RECUSA,
  });
}

export function useReverterEncerramento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: string) => reverterEncerramento(contractId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesDeResultado.raiz });
      void qc.invalidateQueries({ queryKey: chavesDoFinanceiro.raiz });
      void qc.invalidateQueries({ queryKey: chavesFiscais.raiz });
      void qc.invalidateQueries({ queryKey: chavesDeGastos.raiz });
      toast.success("Encerramento desfeito. O contrato voltou a faturar.");
    },
    onError: (erro: unknown) => {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível reverter.";
      toast.error(`O encerramento NÃO foi desfeito. ${mensagem}`);
    },
  });
}

export function useRegravarMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mes, motivo }: { mes: DataISO; motivo: string }) => regravarMes(mes, motivo),
    onSuccess: async (resultado) => {
      await qc.invalidateQueries({ queryKey: chavesDeResultado.raiz });
      if (!resultado.regravou) {
        toast.error("Este mês não tem snapshot para regravar.");
        return;
      }
      toast.success(
        `Mês regravado. Resultado de ${brl(resultado.antes)} para ${brl(resultado.depois)}.`,
      );
    },
    onError: (erro: unknown) => {
      void qc.invalidateQueries({ queryKey: chavesDeResultado.raiz });
      const motivo = ehFaltaDePermissao(erro)
        ? "Só o owner, com o segundo fator, regrava mês fechado."
        : erro instanceof Error
          ? erro.message
          : "Não foi possível regravar.";
      toast.error(`O mês NÃO foi regravado. ${motivo}`);
    },
  });
}

export function useDefinirEntrega() {
  const qc = useQueryClient();

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: chavesDeResultado.raiz });
    void qc.invalidateQueries({ queryKey: chavesDoFinanceiro.raiz });
  };

  return useMutation({
    mutationFn: ({ contractId, data }: { contractId: string; data?: string }) =>
      definirEntrega(contractId, data),
    onSuccess: (_resultado, variaveis) => {
      invalidar();

      if (variaveis.data === undefined) {
        toast.success("Entrega desmarcada. O projeto voltou para o alerta de atraso.");
        return;
      }

      toast.success("Entrega marcada. O projeto saiu do alerta de atraso.", {
        action: {
          label: "Desfazer",
          onClick: () => {
            definirEntrega(variaveis.contractId)
              .then(() => {
                invalidar();
                toast.success("Desfeito. O projeto voltou para o alerta.");
              })
              .catch((erro: unknown) => {
                const mensagem = erro instanceof Error ? erro.message : "tente pelo card.";
                toast.error(`Não foi possível desfazer. ${mensagem}`);
              });
          },
        },
      });
    },
    onError: (erro: unknown) => {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível gravar.";
      toast.error(`A entrega NÃO foi registrada. ${mensagem}`);
    },
  });
}

export function hojeParaEntrega(): string {
  return todaySP();
}
