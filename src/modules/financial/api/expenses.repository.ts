import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";
export { ehFaltaDePermissao } from "@/shared/lib/permissao";

import type {
  CategoriaDeDespesa,
  DataISO,
  DespesaEfetiva,
  MesDeQueda,
  MesProjetado,
  RecorrenciaDeDespesa,
  UnidadeDeNegocio,
} from "../domain/expenses";

const TETO_DE_LINHAS = 500;

export async function lerDespesasEfetivas(): Promise<readonly DespesaEfetiva[]> {
  const { data, error } = await supabaseV2.rpc("get_expenses_effective");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    id: linha.expense_id,
    descricao: linha.descricao,
    valor: linha.valor,
    categoria: linha.categoria,
    bu: linha.bu,
    recorrencia: linha.recorrencia,
    fornecedor: linha.fornecedor,
    meioDePagamento: linha.meio_de_pagamento,
    agrupadorId: linha.agrupador_id,
    agrupador: linha.agrupador,
    totalDoAgrupador: linha.total_do_agrupador,
    parcelasTotal: linha.parcelas_total,
    parcelasPagas: linha.parcelas_pagas,
    parcelasRestantes: linha.parcelas_restantes,
    ultimaParcelaEm: linha.ultima_parcela_em,
    inicio: linha.inicio,
    fim: linha.fim,
    mesReferencia: linha.mes_referencia,
  }));
}

export async function lerProjecaoDeCusto(): Promise<readonly MesProjetado[]> {
  const { data, error } = await supabaseV2.rpc("get_cost_projection");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    mes: linha.mes,
    custoTotal: linha.custo_total,
    custoDemanda: linha.custo_demanda,
    custoSistemas: linha.custo_sistemas,
    custoCompartilhado: linha.custo_compartilhado,
    despesas: linha.despesas,
    custoGastos: linha.custo_gastos,
    custoFolha: linha.custo_folha,
    pessoasNaFolha: linha.pessoas_na_folha,
    folhaDemanda: linha.folha_demanda,
    folhaSistemas: linha.folha_sistemas,
    folhaCompartilhado: linha.folha_compartilhado,
  }));
}

export async function lerQuedaDeCusto(): Promise<readonly MesDeQueda[]> {
  const { data, error } = await supabaseV2.rpc("get_cost_drop");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    mesFim: linha.mes_fim,
    valorQueSai: linha.valor_que_sai,
    despesas: linha.despesas,
    custoNoMesDoFim: linha.custo_no_mes_do_fim,
    custoDepois: linha.custo_depois,
  }));
}

export interface DespesaCadastrada {
  readonly id: string;
  readonly descricao: string;
  readonly valor: number;
  readonly categoria: CategoriaDeDespesa;
  readonly bu: UnidadeDeNegocio;
  readonly recorrencia: RecorrenciaDeDespesa;
  readonly parcelasTotal: number | null;
  readonly parcelasPagas: number;
  readonly inicio: DataISO;
  readonly fim: DataISO | null;
  readonly fornecedor: string | null;
  readonly meioDePagamento: string | null;
  readonly agrupadorId: string | null;
  readonly ehAgrupador: boolean;
  readonly ativa: boolean;
  readonly saiuEm: string | null;
  readonly observacoes: string | null;
}

const COLUNAS_DA_DESPESA =
  "id, description, amount, category, business_unit, recurrence, installments_total, installments_paid, start_date, end_date, vendor, payment_method, parent_expense_id, is_group, active, deactivated_at, notes";

function paraDespesaCadastrada(linha: {
  id: string;
  description: string;
  amount: number;
  category: CategoriaDeDespesa;
  business_unit: UnidadeDeNegocio;
  recurrence: RecorrenciaDeDespesa;
  installments_total: number | null;
  installments_paid: number;
  start_date: string;
  end_date: string | null;
  vendor: string | null;
  payment_method: string | null;
  parent_expense_id: string | null;
  is_group: boolean;
  active: boolean;
  deactivated_at: string | null;
  notes: string | null;
}): DespesaCadastrada {
  return {
    id: linha.id,
    descricao: linha.description,
    valor: linha.amount,
    categoria: linha.category,
    bu: linha.business_unit,
    recorrencia: linha.recurrence,
    parcelasTotal: linha.installments_total,
    parcelasPagas: linha.installments_paid,
    inicio: linha.start_date,
    fim: linha.end_date,
    fornecedor: linha.vendor,
    meioDePagamento: linha.payment_method,
    agrupadorId: linha.parent_expense_id,
    ehAgrupador: linha.is_group,
    ativa: linha.active,
    saiuEm: linha.deactivated_at,
    observacoes: linha.notes,
  };
}

export interface Cadastro {
  readonly linhas: readonly DespesaCadastrada[];
  readonly truncada: boolean;
}

export async function listarDespesasCadastradas({
  incluirInativas = false,
}: { incluirInativas?: boolean } = {}): Promise<Cadastro> {
  let consulta = supabaseV2.from("expenses").select(COLUNAS_DA_DESPESA);
  if (!incluirInativas) consulta = consulta.eq("active", true);

  const { data, error } = await consulta
    .order("is_group", { ascending: false })
    .order("amount", { ascending: false })
    .limit(TETO_DE_LINHAS + 1);
  if (error) throw erroDoBanco(error);

  const todas = (data ?? []).map(paraDespesaCadastrada);
  return {
    linhas: todas.slice(0, TETO_DE_LINHAS),
    truncada: todas.length > TETO_DE_LINHAS,
  };
}

const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listarAgrupadores(
  agrupadorAtualId?: string | null,
): Promise<
  readonly { readonly id: string; readonly descricao: string; readonly ativo: boolean }[]
> {
  const atual =
    typeof agrupadorAtualId === "string" && FORMATO_DE_UUID.test(agrupadorAtualId)
      ? agrupadorAtualId
      : null;

  let consulta = supabaseV2.from("expenses").select("id, description, active").eq("is_group", true);
  consulta =
    atual === null ? consulta.eq("active", true) : consulta.or(`active.eq.true,id.eq.${atual}`);

  const { data, error } = await consulta.order("description").limit(TETO_DE_LINHAS);
  if (error) throw erroDoBanco(error);

  const linhas = data ?? [];
  if (linhas.length >= TETO_DE_LINHAS) {
    throw new Error(
      `A lista de agrupadores veio no teto de ${TETO_DE_LINHAS} e pode estar incompleta. ` +
        `Escolher a partir de lista truncada esconde agrupador válido, inclusive aquele ` +
        `em que esta despesa já está pendurada.`,
    );
  }
  return linhas.map((linha) => ({
    id: linha.id,
    descricao: linha.description,
    ativo: linha.active,
  }));
}

export interface DespesaParaGravar {
  readonly descricao: string;
  readonly valor: number;
  readonly categoria: CategoriaDeDespesa;
  readonly bu: UnidadeDeNegocio;
  readonly recorrencia: RecorrenciaDeDespesa;
  readonly parcelasTotal: number | null;
  readonly inicio: DataISO;
  readonly fim: DataISO | null;
  readonly fornecedor: string | null;
  readonly meioDePagamento: string | null;
  readonly agrupadorId: string | null;
  readonly ehAgrupador: boolean;
  readonly observacoes: string | null;
}

function paraLinha(dados: DespesaParaGravar) {
  return {
    description: dados.descricao,
    amount: dados.ehAgrupador ? 0 : dados.valor,
    category: dados.categoria,
    business_unit: dados.bu,
    recurrence: dados.recorrencia,
    installments_total: dados.ehAgrupador ? null : dados.parcelasTotal,
    start_date: dados.inicio,
    end_date: dados.recorrencia === "mensal" && !dados.ehAgrupador ? dados.fim : null,
    vendor: dados.fornecedor,
    payment_method: dados.meioDePagamento,
    parent_expense_id: dados.ehAgrupador ? null : dados.agrupadorId,
    is_group: dados.ehAgrupador,
    notes: dados.observacoes,
  };
}

export async function criarDespesa(dados: DespesaParaGravar): Promise<string> {
  const { data, error } = await supabaseV2
    .from("expenses")
    .insert(paraLinha(dados))
    .select("id")
    .single();
  if (error) throw erroDoBanco(error);
  return data.id;
}

export async function atualizarDespesa(id: string, dados: DespesaParaGravar): Promise<void> {
  const { data, error } = await supabaseV2
    .from("expenses")
    .update(paraLinha(dados))
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita despesas.");
  }
}

export async function definirSituacaoDaDespesa(id: string, ativa: boolean): Promise<void> {
  const { data, error } = await supabaseV2
    .from("expenses")
    .update({ active: ativa })
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita despesas.");
  }
}

export async function apagarDespesa(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("expenses").delete().eq("id", id).select("id");
  if (error?.code === "23503") {
    throw erroDoBanco({
      code: error.code,
      details: error.details,
      hint: error.hint,
      message:
        "Este agrupador ainda tem despesas penduradas, inclusive as tiradas do custo. Mova ou apague essas despesas primeiro.",
    });
  }
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "Só o owner apaga despesa. Se você usa app autenticador, saia e entre de novo com o código de 6 dígitos.",
    );
  }
}
