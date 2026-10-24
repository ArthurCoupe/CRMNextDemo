import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";
export { ehFaltaDePermissao } from "@/shared/lib/permissao";

import type {
  LinhaDeMrrPorUnidade,
  LinhaDeReceitaPorFrente,
  LinhaDeTcvPorUnidade,
  ProjetoAtrasado,
} from "../domain/receita";

export async function lerMrrPorUnidade(): Promise<readonly LinhaDeMrrPorUnidade[]> {
  const { data, error } = await supabaseV2.rpc("get_mrr_by_unit");
  if (error) throw erroDoBanco(error);
  return data ?? [];
}

export async function lerTcvPorUnidade(): Promise<readonly LinhaDeTcvPorUnidade[]> {
  const { data, error } = await supabaseV2.rpc("get_tcv_by_unit");
  if (error) throw erroDoBanco(error);
  return data ?? [];
}

export async function lerReceitaPorFrente(): Promise<readonly LinhaDeReceitaPorFrente[]> {
  const { data, error } = await supabaseV2.rpc("get_revenue_by_front");
  if (error) throw erroDoBanco(error);
  return data ?? [];
}

export async function lerProjetosAtrasados(): Promise<readonly ProjetoAtrasado[]> {
  const { data, error } = await supabaseV2.rpc("get_delayed_projects");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    id: linha.id,
    cliente: linha.cliente,
    projeto: linha.projeto,
    prazoDeEntrega: linha.delivery_deadline,
    diasDeAtraso: linha.dias_atraso,
    valorTotal: linha.total_value,
    parcelaMensal: linha.parcela_mensal,
    mesesExtra: linha.meses_extra,
  }));
}
