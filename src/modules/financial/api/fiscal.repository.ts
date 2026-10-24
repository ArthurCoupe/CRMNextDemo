import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";
export { ehFaltaDePermissao } from "@/shared/lib/permissao";
import type { MeioDePagamento, TipoDeContrato } from "@/modules/contracts/domain/contract";

import type { ConfiguracaoFiscal, TabelaDeParcelamento, TaxasDoMeio } from "../domain/fiscal";
import { hojeEmSaoPaulo, mesesDesde } from "../domain/mes-civil";

export async function lerConfiguracaoFiscal(): Promise<ConfiguracaoFiscal | null> {
  const { data, error } = await supabaseV2
    .from("fiscal_settings")
    .select("tax_pct, source, is_provisional")
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (data === null) return null;
  return {
    aliquotaPct: data.tax_pct,
    provisoria: data.is_provisional,
    fonte: data.source,
  };
}

export async function lerTabelaDeParcelamento(): Promise<TabelaDeParcelamento> {
  const { data, error } = await supabaseV2
    .from("gateway_fees")
    .select("installments, fee_pct")
    .order("installments")
    .limit(24);
  if (error) throw erroDoBanco(error);
  return new Map((data ?? []).map((linha) => [linha.installments, linha.fee_pct]));
}

export async function lerTaxasPorMeio(): Promise<ReadonlyMap<MeioDePagamento, TaxasDoMeio>> {
  const { data, error } = await supabaseV2
    .from("payment_method_fees")
    .select("method, fixed_fee, variable_pct, installable, settlement")
    .order("method")
    .limit(50);
  if (error) throw erroDoBanco(error);
  return new Map(
    (data ?? []).map((linha) => [
      linha.method,
      {
        meio: linha.method,
        taxaFixa: linha.fixed_fee,
        percentualVariavel: linha.variable_pct,
        parcelavel: linha.installable,
        liquidacao: linha.settlement,
      },
    ]),
  );
}

export interface LiquidoDoContrato {
  readonly contratoId: string;
  readonly clienteId: string;
  readonly cliente: string;
  readonly contrato: string;
  readonly meioDePagamento: MeioDePagamento;
  readonly parcelas: number;
  readonly bruto: number;
  readonly imposto: number;
  readonly taxaVariavel: number;
  readonly taxaFixa: number;
  readonly liquido: number;
  readonly taxaVariavelPct: number;
  readonly impostoPct: number;
  readonly provisoria: boolean;
  readonly tipo: TipoDeContrato;
  readonly faturaNoMes: boolean;
  readonly inicioFuturo: boolean;
}

export interface TotalDoLiquido {
  readonly bruto: number;
  readonly deducoes: number;
  readonly liquido: number;
  readonly contratos: number;
}

export async function lerLiquidoTotal(): Promise<TotalDoLiquido | null> {
  const { data, error } = await supabaseV2.rpc("get_net_revenue_total");
  if (error) throw erroDoBanco(error);
  const linha = (data ?? [])[0];
  if (linha === undefined) return null;
  return {
    bruto: linha.bruto,
    deducoes: linha.deducoes,
    liquido: linha.liquido,
    contratos: linha.contratos,
  };
}

export async function lerLiquidoPorContrato(): Promise<readonly LiquidoDoContrato[]> {
  const { data, error } = await supabaseV2.rpc("get_net_revenue");
  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  const inicioPorContrato = await lerInicioDosContratos(
    linhas.filter((l) => !l.fatura_no_mes).map((l) => l.contract_id),
  );
  const hoje = hojeEmSaoPaulo();
  return linhas.map((linha) => ({
    contratoId: linha.contract_id,
    clienteId: linha.client_id,
    cliente: linha.cliente,
    contrato: linha.contrato,
    meioDePagamento: linha.payment_method,
    parcelas: linha.parcelas,
    bruto: linha.bruto,
    imposto: linha.imposto,
    taxaVariavel: linha.taxa_variavel,
    taxaFixa: linha.taxa_fixa,
    liquido: linha.liquido,
    taxaVariavelPct: linha.taxa_variavel_pct,
    impostoPct: linha.imposto_pct,
    provisoria: linha.is_provisional,
    tipo: linha.contract_type,
    faturaNoMes: linha.fatura_no_mes,
    inicioFuturo: inicioFuturo(inicioPorContrato.get(linha.contract_id), hoje),
  }));
}

async function lerInicioDosContratos(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseV2.from("contracts").select("id, start_date").in("id", ids);
  if (error) throw erroDoBanco(error);
  return new Map((data ?? []).map((c) => [c.id, c.start_date]));
}

function inicioFuturo(inicio: string | undefined, hoje: string): boolean {
  if (inicio === undefined) return false;
  return (mesesDesde(inicio, hoje) ?? 0) < 0;
}

export async function definirAliquota(dados: {
  aliquotaPct: number;
  provisoria: boolean;
  fonte: string | null;
}): Promise<void> {
  const { data, error } = await supabaseV2
    .from("fiscal_settings")
    .update({
      tax_pct: dados.aliquotaPct,
      is_provisional: dados.provisoria,
      source: dados.fonte,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select("tax_pct");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita a configuração fiscal.");
  }
}

export async function definirTaxaDeParcelamento(
  parcelas: number,
  percentual: number,
): Promise<void> {
  const { data, error } = await supabaseV2
    .from("gateway_fees")
    .update({ fee_pct: percentual })
    .eq("installments", parcelas)
    .select("installments");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita a tabela de parcelamento.");
  }
}

export async function definirTaxasDoMeio(dados: {
  meio: MeioDePagamento;
  taxaFixa?: number;
  percentualVariavel?: number;
  liquidacao?: string | null;
  parcelavel?: boolean;
}): Promise<void> {
  const alteracao: {
    fixed_fee?: number;
    variable_pct?: number;
    settlement?: string | null;
    installable?: boolean;
  } = {};
  if (dados.taxaFixa !== undefined) alteracao.fixed_fee = dados.taxaFixa;
  if (dados.percentualVariavel !== undefined) alteracao.variable_pct = dados.percentualVariavel;
  if (dados.liquidacao !== undefined) {
    const limpo = (dados.liquidacao ?? "").trim();
    alteracao.settlement = limpo === "" ? null : limpo;
  }
  if (dados.parcelavel !== undefined) alteracao.installable = dados.parcelavel;
  if (Object.keys(alteracao).length === 0) return;

  const { data, error } = await supabaseV2
    .from("payment_method_fees")
    .update(alteracao)
    .eq("method", dados.meio)
    .select("method");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita as taxas por meio de pagamento.");
  }
}
