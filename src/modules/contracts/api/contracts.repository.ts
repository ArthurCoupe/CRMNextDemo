import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { Database } from "@/shared/types/database.types";

import { supabaseV2 } from "@/integrations/supabase/client.v2";
import type {
  Contrato,
  FrenteDeServico,
  ItemDeContrato,
  LinhaDeNegocio,
  MeioDePagamento,
  StatusDeContrato,
  TipoDeContrato,
} from "../domain/contract";
import { mensagemDeFrenteRepetida } from "../domain/items";
import type { OrigemDeContrato, VendaDeOrigem } from "../domain/venda-de-origem";

const CODIGO_DE_CHAVE_DUPLICADA = "23505";
const CONSTRAINT_DE_FRENTE_REPETIDA = "contract_items_contract_id_front_key";

const CODIGOS_DE_NUMERO_FORA_DO_LIMITE = ["22003", "22008"];
const FRASE_DE_NUMERO_FORA_DO_LIMITE =
  "Um número do contrato passou do limite que o banco aceita. Confira valores e meses.";

const COLUNAS_DE_CONTRATO =
  "id, client_id, name, contract_type, business_unit, monthly_value, total_value, " +
  "billing_months, duration_months, commitment_months, is_firm, billing_active, " +
  "billing_paused_at, pause_reason, start_date, end_date, status, notes, " +
  "payment_method, installments, is_commissionable, delivery_deadline, opportunity_id, " +
  "clients(name), contract_items(id, front, product_id, value)";

const LIMITE_DA_LISTA = 200;
const TETO_DE_SELECAO = 200;

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n >= teto) {
    throw new Error(
      `A lista de ${oQue} veio no teto de ${teto} e pode estar incompleta. ` +
        `Escolher a partir de lista truncada esconde opção válida.`,
    );
  }
}

type LinhaDeContrato = Database["public"]["Tables"]["contracts"]["Row"] & {
  clients: { name: string } | null;
  contract_items: ReadonlyArray<{
    id: string;
    front: FrenteDeServico;
    product_id: string | null;
    value: number;
  }>;
};

export interface ContratoListado extends Contrato {
  readonly nomeDoCliente: string;
  readonly meioDePagamento: MeioDePagamento;
  readonly parcelas: number | null;
  readonly comissionavel: boolean;
  readonly prazoDeEntrega: string | null;
  readonly observacoes: string | null;
  readonly itens: readonly ItemDeContrato[];
  readonly duracaoMeses: number | null;
  readonly mesesDeFidelidade: number | null;
  readonly motivoDaPausa: string | null;
  readonly oportunidadeId: string | null;
}

function paraContrato(linha: LinhaDeContrato): ContratoListado {
  return {
    id: linha.id,
    clienteId: linha.client_id,
    nome: linha.name,
    tipo: linha.contract_type,
    linhaDeNegocio: linha.business_unit,
    valorMensal: linha.monthly_value,
    valorTotal: linha.total_value,
    mesesDeCobranca: linha.billing_months,
    cobrancaAtiva: linha.billing_active,
    firme: linha.is_firm,
    status: linha.status,
    nomeDoCliente: linha.clients?.name ?? "-",
    inicio: linha.start_date,
    fim: linha.end_date,
    meioDePagamento: linha.payment_method,
    parcelas: linha.installments,
    comissionavel: linha.is_commissionable,
    prazoDeEntrega: linha.delivery_deadline,
    observacoes: linha.notes,
    duracaoMeses: linha.duration_months,
    mesesDeFidelidade: linha.commitment_months,
    motivoDaPausa: linha.pause_reason,
    oportunidadeId: linha.opportunity_id,
    itens: linha.contract_items.map((item) => ({
      frente: item.front,
      produtoId: item.product_id,
      valor: item.value,
    })),
  };
}

export interface PaginaDeContratos {
  readonly contratos: readonly ContratoListado[];
  readonly truncada: boolean;
}

export async function listarContratos(): Promise<PaginaDeContratos> {
  const { data, error } = await supabaseV2
    .from("contracts")
    .select(COLUNAS_DE_CONTRATO)
    .order("created_at", { ascending: false })
    .limit(LIMITE_DA_LISTA);

  if (error) throw erroDoBanco(error);
  const linhas = (data as unknown as LinhaDeContrato[] | null) ?? [];
  return { contratos: linhas.map(paraContrato), truncada: linhas.length >= LIMITE_DA_LISTA };
}

export interface ClienteParaSelecao {
  readonly id: string;
  readonly nome: string;
}

export async function listarClientesParaSelecao(): Promise<ClienteParaSelecao[]> {
  const { data, error } = await supabaseV2
    .from("clients")
    .select("id, name")
    .order("name")
    .limit(TETO_DE_SELECAO);

  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_DE_SELECAO, "clientes");
  return linhas.map((c) => ({ id: c.id, nome: c.name }));
}

export interface ContratoParaLigar {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly valorMensal: number | null;
  readonly valorTotal: number | null;
  readonly oportunidadeId: string | null;
}

export async function listarContratosDoCliente(clienteId: string): Promise<ContratoParaLigar[]> {
  const { data, error } = await supabaseV2
    .from("contracts")
    .select(
      "id, name, contract_type, business_unit, monthly_value, total_value, opportunity_id, proposal_items(id)",
    )
    .eq("client_id", clienteId)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(TETO_DE_SELECAO);

  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_DE_SELECAO, "contratos do cliente");
  return linhas
    .filter((c) => c.proposal_items.length === 0)
    .map((c) => ({
      id: c.id,
      nome: c.name,
      tipo: c.contract_type,
      linhaDeNegocio: c.business_unit,
      valorMensal: c.monthly_value,
      valorTotal: c.total_value,
      oportunidadeId: c.opportunity_id,
    }));
}

const TETO_DE_GANHAS = 200;
const TETO_DE_ORIGENS = 500;

export interface VendasParaContrato {
  readonly ganhas: readonly VendaDeOrigem[];
  readonly origens: readonly OrigemDeContrato[];
}

export async function listarVendasParaContrato(): Promise<VendasParaContrato> {
  const [ganhas, origens] = await Promise.all([
    supabaseV2.rpc("listar_ganhas_sem_contrato"),
    supabaseV2.rpc("get_origens_dos_clientes"),
  ]);
  if (ganhas.error) throw erroDoBanco(ganhas.error);
  if (origens.error) throw erroDoBanco(origens.error);

  const linhasDeGanhas = ganhas.data ?? [];
  const linhasDeOrigens = origens.data ?? [];
  recusaSeTruncou(linhasDeGanhas.length, TETO_DE_GANHAS, "ganhas sem contrato");
  recusaSeTruncou(linhasDeOrigens.length, TETO_DE_ORIGENS, "vendas de origem");
  return {
    ganhas: linhasDeGanhas.map((l) => ({ id: l.id, nome: l.name })),
    origens: linhasDeOrigens.map((l) => ({
      vendaId: l.opportunity_id,
      vendaNome: l.opportunity_name,
      clienteId: l.client_id,
    })),
  };
}

export interface ProdutoDoCatalogo {
  readonly id: string;
  readonly nome: string;
  readonly frente: FrenteDeServico;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly tipo: TipoDeContrato;
  readonly preco: number;
  readonly frentesDoCombo: readonly FrenteDeServico[] | null;
}

export async function listarProdutosAtivos(): Promise<ProdutoDoCatalogo[]> {
  const { data, error } = await supabaseV2
    .from("products")
    .select("id, name, front, business_unit, contract_type, price, combo_fronts")
    .eq("active", true)
    .order("sort_order")
    .limit(TETO_DE_SELECAO);

  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_DE_SELECAO, "produtos do catálogo");
  return linhas.map((p) => ({
    id: p.id,
    nome: p.name,
    frente: p.front,
    linhaDeNegocio: p.business_unit,
    tipo: p.contract_type,
    preco: p.price,
    frentesDoCombo: p.combo_fronts,
  }));
}

export interface DadosParaSalvarContrato {
  readonly contratoId?: string | null;
  readonly clienteId: string;
  readonly nome: string;
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly itens: readonly ItemDeContrato[];
  readonly inicio: string;
  readonly valorMensal?: number | null;
  readonly valorTotal?: number | null;
  readonly mesesDeCobranca?: number | null;
  readonly firme?: boolean;
  readonly cobrancaAtiva?: boolean | null;
  readonly motivoDaPausa?: string | null;
  readonly fim?: string | null;
  readonly prazoDeEntrega?: string | null;
  readonly meioDePagamento?: MeioDePagamento;
  readonly parcelas?: number | null;
  readonly comissionavel?: boolean;
  readonly status?: StatusDeContrato;
  readonly observacoes?: string | null;
  readonly duracaoMeses?: number | null;
  readonly mesesDeFidelidade?: number | null;
  readonly oportunidadeId: string | null;
}

export async function salvarContrato(dados: DadosParaSalvarContrato): Promise<string> {
  const { data, error } = await supabaseV2.rpc("save_contract", {
    p_contract_id: dados.contratoId ?? undefined,
    p_client_id: dados.clienteId,
    p_name: dados.nome,
    p_type: dados.tipo,
    p_bu: dados.linhaDeNegocio,
    p_items: dados.itens.map((item) => ({
      front: item.frente,
      product_id: item.produtoId ?? null,
      value: item.valor,
    })),
    p_start_date: dados.inicio,
    p_monthly: dados.valorMensal ?? undefined,
    p_total: dados.valorTotal ?? undefined,
    p_billing_months: dados.mesesDeCobranca ?? undefined,
    p_duration_months: dados.duracaoMeses ?? undefined,
    p_commitment_months: dados.mesesDeFidelidade ?? undefined,
    p_is_firm: dados.firme ?? true,
    p_billing_active: dados.cobrancaAtiva ?? undefined,
    p_pause_reason: dados.motivoDaPausa ?? undefined,
    p_end_date: dados.fim ?? undefined,
    p_delivery_deadline: dados.prazoDeEntrega ?? undefined,
    p_payment_method: dados.meioDePagamento ?? "transferencia",
    p_installments: dados.parcelas ?? undefined,
    p_is_commissionable: dados.comissionavel ?? true,
    p_status: dados.status ?? "active",
    p_notes: dados.observacoes ?? undefined,
    p_opportunity_id: dados.oportunidadeId ?? undefined,
  });

  if (error) {
    if (
      error.code === CODIGO_DE_CHAVE_DUPLICADA &&
      error.message.includes(CONSTRAINT_DE_FRENTE_REPETIDA)
    ) {
      throw erroDoBanco({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: mensagemDeFrenteRepetida(dados.itens),
      });
    }

    if (CODIGOS_DE_NUMERO_FORA_DO_LIMITE.includes(error.code)) {
      throw erroDoBanco({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: FRASE_DE_NUMERO_FORA_DO_LIMITE,
      });
    }

    throw erroDoBanco(error);
  }
  return data as string;
}

export async function apagarContrato(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("contracts").delete().eq("id", id).select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "Nada foi apagado: só o owner apaga contrato. Se você é o owner e cadastrou o app autenticador, saia e entre de novo digitando o código de 6 dígitos.",
    );
  }
}
