import { supabaseV2 } from "@/integrations/supabase/client.v2";
import type {
  LinhaDeNegocio,
  MeioDePagamento,
  TipoDeContrato,
} from "@/modules/contracts/domain/contract";
import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { ehFaltaDePermissao } from "@/shared/lib/permissao";
import type { Database } from "@/shared/types/database.types";

import { NOME_DO_ITEM_EM_BRANCO, PROPOSTA_CONGELADA, type StatusDaProposta } from "../domain/ciclo";
import type { ItemDaProposta } from "../domain/grupos";
import type { MudancaDeOrdem } from "../domain/ordem";

export interface PropostaListada {
  readonly id: string;
  readonly numero: number;
  readonly versao: number;
  readonly status: StatusDaProposta;
  readonly validaAte: string;
  readonly escopo: string | null;
  readonly prazoEntregaDias: number | null;
  readonly formaPagamento: MeioDePagamento;
  readonly parcelasProjeto: number | null;
  readonly fidelidadeMeses: number | null;
  readonly enviadaEm: string | null;
  readonly aceitaEm: string | null;
  readonly recusadaEm: string | null;
  readonly criadaEm: string;
  readonly totalMensal: number;
  readonly totalProjeto: number;
  readonly vencida: boolean;
  readonly ultima: boolean;
  readonly clienteId: string | null;
}

export interface CamposDaProposta {
  readonly validaAte?: string;
  readonly escopo?: string | null;
  readonly prazoEntregaDias?: number | null;
  readonly formaPagamento?: MeioDePagamento;
  readonly parcelasProjeto?: number | null;
  readonly fidelidadeMeses?: number | null;
}

export interface ContratoACriar {
  readonly propostaId: string;
  readonly numero: number;
  readonly versao: number;
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly valor: number;
  readonly formaPagamento: MeioDePagamento;
  readonly prazoEntregaDias: number | null;
  readonly parcelasProjeto: number | null;
  readonly fidelidadeMeses: number | null;
  readonly oportunidadeId: string;
}

export interface PropostaParaImpressao {
  readonly proposta: PropostaListada;
  readonly oportunidade: {
    readonly nome: string;
    readonly contatoNome: string | null;
    readonly contatoEmail: string | null;
    readonly contatoTelefone: string | null;
  };
  readonly itens: ItemDaProposta[];
}

const COLUNAS_DO_ITEM =
  "id, product_id, nome, descricao, front, combo_fronts, business_unit, contract_type, preco_catalogo, valor, ordem, contract_id";

type LinhaDaRpc =
  Database["public"]["Functions"]["get_propostas_da_oportunidade"]["Returns"][number];

function paraProposta(l: LinhaDaRpc): PropostaListada {
  return {
    id: l.id,
    numero: l.numero,
    versao: l.versao,
    status: l.status,
    validaAte: l.valida_ate,
    escopo: l.escopo,
    prazoEntregaDias: l.prazo_entrega_dias,
    formaPagamento: l.forma_pagamento,
    parcelasProjeto: l.parcelas_projeto,
    fidelidadeMeses: l.fidelidade_meses,
    enviadaEm: l.enviada_em,
    aceitaEm: l.aceita_em,
    recusadaEm: l.recusada_em,
    criadaEm: l.created_at,
    totalMensal: Number(l.total_mensal),
    totalProjeto: Number(l.total_projeto),
    vencida: l.vencida,
    ultima: l.ultima,
    clienteId: l.cliente_id,
  };
}

export async function listarPropostas(oportunidadeId: string): Promise<PropostaListada[]> {
  const { data, error } = await supabaseV2.rpc("get_propostas_da_oportunidade", {
    p_opportunity_id: oportunidadeId,
  });
  if (error) throw erroDoBanco(error);
  return (data ?? []).map(paraProposta);
}

export async function podeVerPropostas(oportunidadeId: string): Promise<boolean> {
  const { data, error } = await supabaseV2.rpc("pode_ver_propostas", {
    p_opportunity_id: oportunidadeId,
  });
  if (error) throw erroDoBanco(error);
  return data;
}

export async function listarItens(propostaId: string): Promise<ItemDaProposta[]> {
  const { data, error } = await supabaseV2
    .from("proposal_items")
    .select(COLUNAS_DO_ITEM)
    .eq("proposal_id", propostaId)
    .order("ordem")
    .order("created_at")
    .limit(200);
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((l) => ({
    id: l.id,
    produtoId: l.product_id,
    nome: l.nome,
    descricao: l.descricao,
    frente: l.front,
    frentesDoCombo: l.combo_fronts,
    linhaDeNegocio: l.business_unit,
    tipo: l.contract_type,
    precoCatalogo: Number(l.preco_catalogo),
    valor: Number(l.valor),
    ordem: l.ordem,
    contratoId: l.contract_id,
  }));
}

export async function criarProposta(oportunidadeId: string): Promise<string> {
  const { data, error } = await supabaseV2
    .from("proposals")
    .insert({ opportunity_id: oportunidadeId })
    .select("id")
    .single();
  if (error) throw erroDoBanco(error);
  return data.id;
}

export async function editarProposta(id: string, campos: CamposDaProposta): Promise<void> {
  const mudancaDaProposta: Database["public"]["Tables"]["proposals"]["Update"] = {};
  if (campos.validaAte !== undefined) mudancaDaProposta.valida_ate = campos.validaAte;
  if (campos.escopo !== undefined) mudancaDaProposta.escopo = campos.escopo;
  if (campos.prazoEntregaDias !== undefined)
    mudancaDaProposta.prazo_entrega_dias = campos.prazoEntregaDias;
  if (campos.formaPagamento !== undefined)
    mudancaDaProposta.forma_pagamento = campos.formaPagamento;
  if (campos.parcelasProjeto !== undefined)
    mudancaDaProposta.parcelas_projeto = campos.parcelasProjeto;
  if (campos.fidelidadeMeses !== undefined)
    mudancaDaProposta.fidelidade_meses = campos.fidelidadeMeses;

  const { data, error } = await supabaseV2
    .from("proposals")
    .update(mudancaDaProposta)
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(PROPOSTA_CONGELADA);
}

export async function excluirRascunho(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("proposals").delete().eq("id", id).select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(PROPOSTA_CONGELADA);
}

export async function adicionarItem(
  propostaId: string,
  produtoId: string,
  ordem: number,
): Promise<void> {
  const { error } = await supabaseV2
    .from("proposal_items")
    .insert({ proposal_id: propostaId, product_id: produtoId, ordem })
    .select("id")
    .single();
  if (error && ehFaltaDePermissao(error)) throw new Error(PROPOSTA_CONGELADA);
  if (error) throw erroDoBanco(error);
}

export interface CamposDoItem {
  readonly descricao?: string | null;
  readonly valor?: number;
  readonly nome?: string;
  readonly ordem?: number;
}

export async function editarItem(id: string, campos: CamposDoItem): Promise<void> {
  const mudancaDoItem: Database["public"]["Tables"]["proposal_items"]["Update"] = {};
  if (campos.descricao !== undefined) mudancaDoItem.descricao = campos.descricao;
  if (campos.valor !== undefined) mudancaDoItem.valor = campos.valor;
  if (campos.nome !== undefined) {
    const nome = campos.nome.trim();
    const tamanho = [...nome].length;
    if (tamanho === 0) throw new Error(NOME_DO_ITEM_EM_BRANCO);
    if (tamanho > 200) {
      throw new Error(`O nome do item tem ${tamanho} caracteres; o máximo é 200.`);
    }
    mudancaDoItem.nome = nome;
  }
  if (campos.ordem !== undefined) mudancaDoItem.ordem = campos.ordem;

  const { data, error } = await supabaseV2
    .from("proposal_items")
    .update(mudancaDoItem)
    .eq("id", id)
    .select("id");
  if (error && ehFaltaDePermissao(error)) throw new Error(PROPOSTA_CONGELADA);
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(PROPOSTA_CONGELADA);
}

export async function reordenarItens(mudancas: readonly MudancaDeOrdem[]): Promise<void> {
  for (const m of mudancas) await editarItem(m.id, { ordem: m.ordem });
}

export async function removerItem(id: string): Promise<void> {
  const { data, error } = await supabaseV2
    .from("proposal_items")
    .delete()
    .eq("id", id)
    .select("id");
  if (error && ehFaltaDePermissao(error)) throw new Error(PROPOSTA_CONGELADA);
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) throw new Error(PROPOSTA_CONGELADA);
}

export async function enviarProposta(id: string): Promise<void> {
  const { error } = await supabaseV2.rpc("enviar_proposta", { p_id: id });
  if (error) throw erroDoBanco(error);
}

export async function recusarProposta(id: string): Promise<void> {
  const { error } = await supabaseV2.rpc("recusar_proposta", { p_id: id });
  if (error) throw erroDoBanco(error);
}

export async function novaVersao(id: string): Promise<string> {
  const { data, error } = await supabaseV2.rpc("nova_versao_proposta", { p_id: id });
  if (error) throw erroDoBanco(error);
  return data;
}

export async function registrarContratoDaProposta(
  propostaId: string,
  contratoId: string,
): Promise<void> {
  const { error } = await supabaseV2.rpc("registrar_contrato_da_proposta", {
    p_id: propostaId,
    p_contract_id: contratoId,
  });
  if (error) throw erroDoBanco(error);
}

export async function listarContratosACriar(clienteId: string): Promise<ContratoACriar[]> {
  const { data, error } = await supabaseV2.rpc("get_contratos_a_criar", { p_client_id: clienteId });
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((l) => ({
    propostaId: l.proposta_id,
    numero: l.numero,
    versao: l.versao,
    tipo: l.contract_type,
    linhaDeNegocio: l.business_unit,
    valor: Number(l.valor),
    formaPagamento: l.forma_pagamento,
    prazoEntregaDias: l.prazo_entrega_dias,
    parcelasProjeto: l.parcelas_projeto,
    fidelidadeMeses: l.fidelidade_meses,
    oportunidadeId: l.opportunity_id,
  }));
}

export async function lerPropostaParaImpressao(id: string): Promise<PropostaParaImpressao> {
  const { data, error } = await supabaseV2
    .from("proposals")
    .select("opportunity_id, opportunities(name, contact_name, contact_email, contact_phone)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (data === null || data.opportunities === null) throw new Error("Proposta não encontrada.");

  const lista = await listarPropostas(data.opportunity_id);
  const proposta = lista.find((p) => p.id === id);
  if (proposta === undefined) throw new Error("Proposta não encontrada.");
  const itens = await listarItens(id);

  return {
    proposta,
    oportunidade: {
      nome: data.opportunities.name,
      contatoNome: data.opportunities.contact_name,
      contatoEmail: data.opportunities.contact_email,
      contatoTelefone: data.opportunities.contact_phone,
    },
    itens,
  };
}
