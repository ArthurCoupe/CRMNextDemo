import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";
export { ehFaltaDePermissao } from "@/shared/lib/permissao";

import type { DataISO } from "../domain/mes-civil";
import type { ResultadoDaBu } from "../domain/result";

export interface MatrizDoMes {
  readonly linhas: readonly ResultadoDaBu[];
  readonly congelado: boolean;
}

export async function lerResultadoPorBu(mes: DataISO): Promise<MatrizDoMes> {
  const { data, error } = await supabaseV2.rpc("get_result_by_unit", { p_ref_month: mes });
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []).map((linha) => ({
    bu: linha.bu,
    receitaBruta: linha.receita_bruta,
    imposto: linha.imposto,
    taxas: linha.taxas,
    receitaLiquida: linha.receita_liquida,
    custoGastos: linha.custo_gastos,
    custoFolha: linha.custo_folha,
    custoParticipacao: linha.custo_participacao,
    custoDireto: linha.custo_direto,
    custoRateado: linha.custo_rateado,
    resultado: linha.resultado,
    margemPct: linha.margem_pct,
    proporcaoPct: linha.proporcao_pct,
  }));
  return { linhas, congelado: (data ?? [])[0]?.congelado ?? false };
}

export interface ResultadoConsolidado {
  readonly receitaBruta: number;
  readonly imposto: number;
  readonly taxas: number;
  readonly receitaLiquida: number;
  readonly custoDireto: number;
  readonly custoRateado: number;
  readonly custoCompartilhadoNaoRateado: number;
  readonly custoTotal: number;
  readonly resultado: number;
  readonly margemPct: number | null;
  readonly congelado: boolean;
}

export async function lerResultadoConsolidado(mes: DataISO): Promise<ResultadoConsolidado | null> {
  const { data, error } = await supabaseV2.rpc("get_result_total", { p_ref_month: mes });
  if (error) throw erroDoBanco(error);
  const linha = (data ?? [])[0];
  if (linha === undefined) return null;
  return {
    receitaBruta: linha.receita_bruta,
    imposto: linha.imposto,
    taxas: linha.taxas,
    receitaLiquida: linha.receita_liquida,
    custoDireto: linha.custo_direto,
    custoRateado: linha.custo_rateado,
    custoCompartilhadoNaoRateado: linha.custo_compartilhado_nao_rateado,
    custoTotal: linha.custo_total,
    resultado: linha.resultado,
    margemPct: linha.margem_pct,
    congelado: linha.congelado,
  };
}

export interface CustoDaBu {
  readonly bu: string;
  readonly custoGastos: number;
  readonly custoFolha: number;
  readonly custoTotal: number;
}

export async function lerCustoPorBu(mes: DataISO): Promise<readonly CustoDaBu[]> {
  const { data, error } = await supabaseV2.rpc("get_cost_by_unit", { p_ref_month: mes });
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    bu: linha.bu,
    custoGastos: linha.custo_gastos,
    custoFolha: linha.custo_folha,
    custoTotal: linha.custo_total,
  }));
}

export interface MesDoHistorico {
  readonly mes: DataISO;
  readonly receitaLiquida: number;
  readonly custoTotal: number;
  readonly resultado: number;
  readonly congelado: boolean;
  readonly parcial: boolean;
}

export async function lerHistorico(meses = 12): Promise<readonly MesDoHistorico[]> {
  const { data, error } = await supabaseV2.rpc("get_result_history", { p_meses: meses });
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    mes: linha.mes,
    receitaLiquida: linha.receita_liquida,
    custoTotal: linha.custo_total,
    resultado: linha.resultado,
    congelado: linha.congelado,
    parcial: linha.parcial,
  }));
}

export interface BreakEven {
  readonly custoFixoTotal: number;
  readonly ticketMedioMrr: number;
  readonly ticketMedioBruto: number;
  readonly clientesParaPagar: number | null;
  readonly contratosMrr: number;
  readonly mrrFirmeTotal: number;
}

export async function lerBreakEven(mes: DataISO): Promise<BreakEven | null> {
  const { data, error } = await supabaseV2.rpc("get_break_even", { p_ref_month: mes });
  if (error) throw erroDoBanco(error);
  const linha = (data ?? [])[0];
  if (linha === undefined) return null;
  return {
    custoFixoTotal: linha.custo_fixo_total,
    ticketMedioMrr: linha.ticket_medio_mrr,
    ticketMedioBruto: linha.ticket_medio_bruto,
    clientesParaPagar: linha.clientes_para_pagar,
    contratosMrr: linha.contratos_mrr,
    mrrFirmeTotal: linha.mrr_firme_total,
  };
}

export interface MetaDeMrr {
  readonly valor: number | null;
  readonly confirmada: boolean;
}

export async function lerMetaDeMrr(): Promise<MetaDeMrr> {
  const { data, error } = await supabaseV2.rpc("get_metas_financeiras");
  if (error) throw erroDoBanco(error);

  const linha = (data ?? [])[0];
  if (linha === undefined) return { valor: null, confirmada: false };

  const mrr = linha.mrr_mensal;
  return {
    valor: mrr !== null && Number.isFinite(mrr) && mrr > 0 ? mrr : null,
    confirmada: linha.confirmado,
  };
}

export interface EncerramentoAutomatico {
  readonly contractId: string;
  readonly contrato: string;
  readonly cliente: string;
  readonly bu: string;
  readonly valorTotal: number | null;
  readonly fechadoEm: DataISO;
  readonly motivo: string;
}

export async function lerEncerramentos(): Promise<readonly EncerramentoAutomatico[]> {
  const { data, error } = await supabaseV2.rpc("get_contract_closings");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    contractId: linha.contract_id,
    contrato: linha.contrato,
    cliente: linha.cliente,
    bu: linha.business_unit,
    valorTotal: linha.total_value,
    fechadoEm: linha.fechado_em,
    motivo: linha.motivo,
  }));
}

export async function reverterEncerramento(contractId: string): Promise<void> {
  const { error } = await supabaseV2.rpc("reverter_encerramento", { p_contract_id: contractId });
  if (error) throw erroDoBanco(error);
}

export type RegravacaoDoMes =
  | { readonly regravou: false }
  | { readonly regravou: true; readonly antes: number; readonly depois: number };

export async function regravarMes(mes: DataISO, motivo: string): Promise<RegravacaoDoMes> {
  const { data, error } = await supabaseV2.rpc("regravar_snapshot", {
    p_ref_month: mes,
    p_motivo: motivo,
  });
  if (error) throw erroDoBanco(error);
  const linha = (data ?? [])[0];
  if (linha === undefined) {
    throw new Error("Resposta inesperada de regravar_snapshot: nenhuma linha.");
  }
  return linha.regravou
    ? { regravou: true, antes: linha.resultado_antes, depois: linha.resultado_depois }
    : { regravou: false };
}

export async function definirEntrega(contractId: string, data?: string): Promise<void> {
  const { error } = await supabaseV2.rpc(
    "definir_entrega",
    data === undefined
      ? { p_contract_id: contractId }
      : { p_contract_id: contractId, p_data: data },
  );
  if (error) throw erroDoBanco(error);
}
