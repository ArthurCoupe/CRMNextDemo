import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { Database } from "@/shared/types/database.types";

import { supabaseV2 } from "@/integrations/supabase/client.v2";
import { extrairIdDaPasta } from "../domain/drive";
import type { VendaDeOrigem } from "@/modules/contracts/domain/venda-de-origem";

import type { GanhaSemContrato } from "../domain/vinculo";
import type { StatusDeCliente } from "../domain/health";

type LinhaDeNegocio = Database["public"]["Enums"]["business_unit"];
type TipoDeContrato = Database["public"]["Enums"]["contract_type"];
type PapelNoBanco = Database["public"]["Enums"]["app_role"];

const COLUNAS_DE_CLIENTE =
  "id, name, segment, nicho, status, contact_name, contact_email, contact_phone, " +
  "owner_id, drive_folder_id, confidencial, confidencial_nota, " +
  "signed_at, churned_at, paused_at, created_at, " +
  "profiles(full_name), " +
  "contracts(id, name, contract_type, business_unit, monthly_value, total_value, " +
  "billing_months, billing_active, is_firm, status, start_date, end_date, billing_ends_at)";

const EMBED_SO_PARA_FILTRAR = "filtro_bu:contracts!inner(id)";

export const TAMANHO_DA_PAGINA = 25;

export interface ContratoDoCliente {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly valorMensal: number | null;
  readonly valorTotal: number | null;
  readonly mesesDeCobranca: number | null;
  readonly cobrancaAtiva: boolean;
  readonly firme: boolean;
  readonly status: Database["public"]["Enums"]["contract_status"];
  readonly inicio: string;
  readonly fim: string | null;
  readonly fimDeCobranca: string | null;
}

export interface ClienteListado {
  readonly id: string;
  readonly nome: string;
  readonly segmento: string | null;
  readonly nicho: string | null;
  readonly status: StatusDeCliente;
  readonly contatoNome: string | null;
  readonly contatoEmail: string | null;
  readonly contatoTelefone: string | null;
  readonly responsavelId: string | null;
  readonly responsavelNome: string | null;
  readonly vendasDeOrigem: readonly VendaDeOrigem[];
  readonly pastaDoDrive: string | null;
  readonly confidencial: boolean;
  readonly confidencialNota: string | null;
  readonly assinadoEm: string | null;
  readonly encerradoEm: string | null;
  readonly pausadoEm: string | null;
  readonly criadoEm: string;
  readonly contratos: readonly ContratoDoCliente[];
  readonly ultimoEventoEm: string | null;
  readonly proximoFimDeCobranca: string | null;
  readonly contratosAtivosVisiveis: number;
}

export interface PaginaDeClientes {
  readonly clientes: readonly ClienteListado[];
  readonly total: number;
  readonly pagina: number;
  readonly totalDePaginas: number;
}

export interface FiltrosDeClientes {
  readonly busca?: string;
  readonly status?: StatusDeCliente | "todos";
  readonly linhaDeNegocio?: LinhaDeNegocio | "todas";
  readonly responsavelId?: string | "todos";
  readonly pagina?: number;
}

type LinhaCrua = Database["public"]["Tables"]["clients"]["Row"] & {
  profiles: { full_name: string } | null;
  contracts: ReadonlyArray<{
    id: string;
    name: string;
    contract_type: TipoDeContrato;
    business_unit: LinhaDeNegocio;
    monthly_value: number | null;
    total_value: number | null;
    billing_months: number | null;
    billing_active: boolean;
    is_firm: boolean;
    status: Database["public"]["Enums"]["contract_status"];
    start_date: string;
    end_date: string | null;
    billing_ends_at: string | null;
  }>;
};

interface LinhaDeSaude {
  client_id: string;
  ultimo_evento_em: string | null;
  proximo_fim_de_cobranca: string | null;
  contratos_ativos: number;
}

function escaparParaFiltro(termo: string): string {
  return termo.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const TETO_DE_ORIGENS = 500;

async function lerVendasDeOrigem(ids: readonly string[]): Promise<Map<string, VendaDeOrigem[]>> {
  const { data, error } = await supabaseV2.rpc("get_origens_dos_clientes");
  if (error !== null) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_DE_ORIGENS, "vendas de origem");

  const daPagina = new Set(ids);
  const porCliente = new Map<string, VendaDeOrigem[]>();
  for (const linha of linhas) {
    if (!daPagina.has(linha.client_id)) continue;
    const vendas = porCliente.get(linha.client_id) ?? [];
    vendas.push({ id: linha.opportunity_id, nome: linha.opportunity_name });
    porCliente.set(linha.client_id, vendas);
  }
  return porCliente;
}

export async function listarClientes(filtros: FiltrosDeClientes = {}): Promise<PaginaDeClientes> {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const de = (pagina - 1) * TAMANHO_DA_PAGINA;
  const ate = de + TAMANHO_DA_PAGINA - 1;

  const filtraPorBU = filtros.linhaDeNegocio !== undefined && filtros.linhaDeNegocio !== "todas";

  let consulta = supabaseV2
    .from("clients")
    .select(filtraPorBU ? `${COLUNAS_DE_CLIENTE}, ${EMBED_SO_PARA_FILTRAR}` : COLUNAS_DE_CLIENTE, {
      count: "exact",
    })
    .order("name")
    .range(de, ate);

  if (filtraPorBU) {
    consulta = consulta.eq("filtro_bu.business_unit", filtros.linhaDeNegocio as LinhaDeNegocio);
  }
  if (filtros.status !== undefined && filtros.status !== "todos") {
    consulta = consulta.eq("status", filtros.status);
  }
  if (filtros.responsavelId !== undefined && filtros.responsavelId !== "todos") {
    consulta =
      filtros.responsavelId === "sem-responsavel"
        ? consulta.is("owner_id", null)
        : consulta.eq("owner_id", filtros.responsavelId);
  }

  const busca = escaparParaFiltro((filtros.busca ?? "").trim());
  if (busca !== "") {
    consulta = consulta.or(`name.ilike."%${busca}%",contact_name.ilike."%${busca}%"`);
  }

  const { data, error, count } = await consulta;
  if (error) throw erroDoBanco(error);

  const linhas = (data ?? []) as unknown as LinhaCrua[];

  const ids = linhas.map((linha) => linha.id);
  const saudePorCliente = new Map<string, LinhaDeSaude>();
  let vendasPorCliente = new Map<string, VendaDeOrigem[]>();
  if (ids.length > 0) {
    const [{ data: saude, error: erroSaude }, vendas] = await Promise.all([
      supabaseV2
        .from("v_client_health")
        .select("client_id, ultimo_evento_em, proximo_fim_de_cobranca, contratos_ativos")
        .in("client_id", ids),
      lerVendasDeOrigem(ids),
    ]);
    if (erroSaude) throw erroDoBanco(erroSaude);
    for (const linha of (saude ?? []) as unknown as LinhaDeSaude[]) {
      saudePorCliente.set(linha.client_id, linha);
    }
    vendasPorCliente = vendas;
  }

  const total = count ?? linhas.length;

  return {
    clientes: linhas.map((linha) => {
      const saude = saudePorCliente.get(linha.id);
      return {
        id: linha.id,
        nome: linha.name,
        segmento: linha.segment,
        nicho: linha.nicho,
        status: linha.status,
        contatoNome: linha.contact_name,
        contatoEmail: linha.contact_email,
        contatoTelefone: linha.contact_phone,
        responsavelId: linha.owner_id,
        responsavelNome: linha.profiles?.full_name ?? null,
        vendasDeOrigem: vendasPorCliente.get(linha.id) ?? [],
        pastaDoDrive: linha.drive_folder_id,
        confidencial: linha.confidencial,
        confidencialNota: linha.confidencial_nota,
        assinadoEm: linha.signed_at,
        encerradoEm: linha.churned_at,
        pausadoEm: linha.paused_at,
        criadoEm: linha.created_at,
        contratos: linha.contracts.map((contrato) => ({
          id: contrato.id,
          nome: contrato.name,
          tipo: contrato.contract_type,
          linhaDeNegocio: contrato.business_unit,
          valorMensal: contrato.monthly_value,
          valorTotal: contrato.total_value,
          mesesDeCobranca: contrato.billing_months,
          cobrancaAtiva: contrato.billing_active,
          firme: contrato.is_firm,
          status: contrato.status,
          inicio: contrato.start_date,
          fim: contrato.end_date,
          fimDeCobranca: contrato.billing_ends_at,
        })),
        ultimoEventoEm: saude?.ultimo_evento_em ?? null,
        proximoFimDeCobranca: saude?.proximo_fim_de_cobranca ?? null,
        contratosAtivosVisiveis: saude?.contratos_ativos ?? 0,
      };
    }),
    total,
    pagina,
    totalDePaginas: Math.max(1, Math.ceil(total / TAMANHO_DA_PAGINA)),
  };
}

export interface ResponsavelDeCliente {
  readonly id: string;
  readonly nome: string;
  readonly papel: PapelNoBanco;
  readonly ativo: boolean;
}

const TETO_DE_RESPONSAVEIS = 100;

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n >= teto) {
    throw new Error(
      `A lista de ${oQue} veio no teto de ${teto} e pode estar incompleta. ` +
        `Escolher a partir de lista truncada esconde opção válida.`,
    );
  }
}

const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listarResponsaveisPossiveis(
  responsavelAtualId?: string | null,
): Promise<ResponsavelDeCliente[]> {
  const titular =
    typeof responsavelAtualId === "string" && FORMATO_DE_UUID.test(responsavelAtualId)
      ? responsavelAtualId
      : null;

  let consulta = supabaseV2.from("profiles").select("id, full_name, role, active");
  consulta =
    titular === null ? consulta.eq("active", true) : consulta.or(`active.eq.true,id.eq.${titular}`);

  const { data, error } = await consulta.order("full_name").limit(TETO_DE_RESPONSAVEIS);

  if (error) throw erroDoBanco(error);

  const todos = (data ?? []) as Array<{
    id: string;
    full_name: string;
    role: PapelNoBanco;
    active: boolean;
  }>;
  recusaSeTruncou(todos.length, TETO_DE_RESPONSAVEIS, "responsáveis");
  return todos
    .filter(
      (perfil) => perfil.role === "owner" || perfil.role === "manager" || perfil.id === titular,
    )
    .map((perfil) => ({
      id: perfil.id,
      nome: perfil.full_name,
      papel: perfil.role,
      ativo: perfil.active,
    }));
}

export async function definirResponsavel(
  clienteId: string,
  responsavelId: string | null,
): Promise<void> {
  const { data, error } = await supabaseV2
    .from("clients")
    .update({ owner_id: responsavelId })
    .eq("id", clienteId)
    .select("id");

  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "Nada foi gravado: seu papel não pode alterar o responsável deste cliente. " +
        "Manager edita apenas os clientes em que já é o responsável; os demais são do owner.",
    );
  }
}

export async function definirPastaDoDrive(clienteId: string, valor: string): Promise<void> {
  const bruto = valor.trim();
  const driveFolderId = extrairIdDaPasta(bruto);

  if (bruto !== "" && driveFolderId === null) {
    throw new Error(
      "Isso não parece um link nem um ID de pasta do Drive. Confira o valor colado e tente de novo.",
    );
  }

  const { data, error } = await supabaseV2
    .from("clients")
    .update({ drive_folder_id: driveFolderId })
    .eq("id", clienteId)
    .select("id");

  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "Nada foi gravado: seu papel não pode alterar a pasta do Drive deste cliente. " +
        "Manager edita apenas os clientes em que já é o responsável; os demais são do owner.",
    );
  }
}

export async function definirConfidencialidade(
  clienteId: string,
  confidencial: boolean,
  nota?: string | null,
): Promise<void> {
  const alteracao: { confidencial: boolean; confidencial_nota?: string | null } = { confidencial };
  if (nota !== undefined) alteracao.confidencial_nota = nota;

  const { data, error } = await supabaseV2
    .from("clients")
    .update(alteracao)
    .eq("id", clienteId)
    .select("id");

  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "Nada foi gravado: seu papel não pode alterar a confidencialidade deste cliente. " +
        "Manager edita apenas os clientes em que já é o responsável; os demais são do owner.",
    );
  }
}

export interface EntradaDeCliente {
  readonly nome: string;
  readonly segmento: string | null;
  readonly nicho: string | null;
  readonly contatoNome: string | null;
  readonly contatoEmail: string | null;
  readonly contatoTelefone: string | null;
  readonly responsavelId: string | null;
}

export async function criarCliente(entrada: EntradaDeCliente): Promise<string> {
  const { data, error } = await supabaseV2
    .from("clients")
    .insert({
      name: entrada.nome,
      segment: entrada.segmento,
      nicho: entrada.nicho,
      contact_name: entrada.contatoNome,
      contact_email: entrada.contatoEmail,
      contact_phone: entrada.contatoTelefone,
      owner_id: entrada.responsavelId,
    })
    .select("id")
    .single();

  if (error !== null) throw erroDoBanco(error);
  return data.id;
}

const TETO_DE_GANHAS_SEM_CONTRATO = 200;

export async function listarGanhasSemContrato(): Promise<readonly GanhaSemContrato[]> {
  const { data, error } = await supabaseV2.rpc("listar_ganhas_sem_contrato");
  if (error !== null) throw erroDoBanco(error);

  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, TETO_DE_GANHAS_SEM_CONTRATO, "ganhas sem contrato");
  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.name,
    contatoNome: linha.contact_name,
    contatoEmail: linha.contact_email,
    contatoTelefone: linha.contact_phone,
    segmento: linha.segment,
    nicho: linha.nicho,
    ganhaEm: linha.ganha_em,
  }));
}

export interface DadosEditaveisDoCliente {
  readonly nome?: string;
  readonly segmento?: string | null;
  readonly nicho?: string | null;
  readonly contatoNome?: string | null;
  readonly contatoEmail?: string | null;
  readonly contatoTelefone?: string | null;
}

export async function atualizarDadosDoCliente(
  id: string,
  campos: DadosEditaveisDoCliente,
): Promise<void> {
  const vazioVirandoNulo = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim();

  if (campos.nome !== undefined && campos.nome.trim() === "") {
    throw new Error("O nome do cliente não pode ficar em branco.");
  }

  const alteracao: Pick<
    Database["public"]["Tables"]["clients"]["Update"],
    "name" | "segment" | "nicho" | "contact_name" | "contact_email" | "contact_phone"
  > = {};
  if (campos.nome !== undefined) alteracao.name = campos.nome.trim();
  if (campos.segmento !== undefined) alteracao.segment = vazioVirandoNulo(campos.segmento) ?? null;
  if (campos.nicho !== undefined) alteracao.nicho = vazioVirandoNulo(campos.nicho) ?? null;
  if (campos.contatoNome !== undefined)
    alteracao.contact_name = vazioVirandoNulo(campos.contatoNome) ?? null;
  if (campos.contatoEmail !== undefined)
    alteracao.contact_email = vazioVirandoNulo(campos.contatoEmail) ?? null;
  if (campos.contatoTelefone !== undefined)
    alteracao.contact_phone = vazioVirandoNulo(campos.contatoTelefone) ?? null;

  if (Object.keys(alteracao).length === 0) return;

  const { data, error } = await supabaseV2
    .from("clients")
    .update(alteracao)
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Não foi possível salvar: você não tem permissão para editar este cliente.");
  }
}

export type { StatusDeCliente };

export async function definirStatusDoCliente(id: string, status: StatusDeCliente): Promise<void> {
  const { data, error } = await supabaseV2
    .from("clients")
    .update({ status })
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Não foi possível mudar o status: você não tem permissão para este cliente.");
  }
}

export async function definirAssinatura(id: string, data: string | null): Promise<void> {
  const { data: linhas, error } = await supabaseV2
    .from("clients")
    .update({ signed_at: data })
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((linhas ?? []).length === 0) {
    throw new Error("Você não pode editar a data de assinatura deste cliente.");
  }
}

export async function corrigirDataDoStatus(
  id: string,
  campo: "churned_at" | "paused_at",
  data: string,
): Promise<void> {
  const correcao: Database["public"]["Tables"]["clients"]["Update"] = {};
  if (campo === "paused_at") correcao.paused_at = data;
  else correcao.churned_at = data;

  const { data: linhas, error } = await supabaseV2
    .from("clients")
    .update(correcao)
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((linhas ?? []).length === 0) {
    throw new Error("Só o owner corrige a data de pausa ou de encerramento.");
  }
}

export interface CorrecaoDeData {
  readonly id: string;
  readonly campo: "paused_at" | "churned_at";
  readonly antes: string | null;
  readonly depois: string;
  readonly corrigidoEm: string;
  readonly autorNome: string | null;
}

function ehCampoDeData(valor: string): valor is CorrecaoDeData["campo"] {
  return valor === "paused_at" || valor === "churned_at";
}

const TETO_DE_CORRECOES = 50;

export async function listarCorrecoesDeData(clienteId: string): Promise<readonly CorrecaoDeData[]> {
  const { data, error } = await supabaseV2
    .from("correcoes_de_data_do_cliente")
    .select("id, campo, antes, depois, corrigido_em, profiles(full_name)")
    .eq("client_id", clienteId)
    .order("corrigido_em", { ascending: false })
    .limit(TETO_DE_CORRECOES);

  if (error !== null) throw erroDoBanco(error);
  return (data ?? []).flatMap((linha) =>
    ehCampoDeData(linha.campo)
      ? [
          {
            id: linha.id,
            campo: linha.campo,
            antes: linha.antes,
            depois: linha.depois,
            corrigidoEm: linha.corrigido_em,
            autorNome: linha.profiles?.full_name ?? null,
          },
        ]
      : [],
  );
}

const RECUSA_DO_APAGAR =
  "Apagar cliente é do owner. Se você cadastrou o app autenticador e entrou sem o código, saia e entre de novo digitando o código de 6 dígitos.";

export interface ResultadoDoApagarCliente {
  readonly contratosApagados: number;
  readonly jornadasApagadas: number;
  readonly postsApagados: number;
}

export async function apagarCliente(id: string): Promise<ResultadoDoApagarCliente> {
  const { data, error } = await supabaseV2.rpc("apagar_cliente", { p_client_id: id });

  if (error !== null) {
    throw erroDoBanco(
      error.message === "forbidden" ? { ...error, message: RECUSA_DO_APAGAR } : error,
    );
  }

  const linha = (data ?? [])[0];
  if (linha === undefined) {
    throw new Error("O cliente não foi apagado. Recarregue a página e confira o cliente.");
  }

  return {
    contratosApagados: linha.contratos_apagados,
    jornadasApagadas: linha.jornadas_apagadas,
    postsApagados: linha.posts_apagados,
  };
}

const RECUSA_DO_DESFAZER =
  "Desfazer um fechamento é do owner. Se você cadastrou o app autenticador e entrou sem o código, saia e entre de novo digitando o código de 6 dígitos.";

export interface ResultadoDoDesfazer {
  readonly contratosApagados: number;
  readonly estagioRestaurado: string | null;
}

export async function desfazerFechamento(
  vendaId: string,
  motivo: string,
): Promise<ResultadoDoDesfazer> {
  const { data, error } = await supabaseV2.rpc("desfazer_fechamento", {
    p_opportunity_id: vendaId,
    p_motivo: motivo,
  });

  if (error !== null) {
    throw erroDoBanco(
      error.message === "forbidden" ? { ...error, message: RECUSA_DO_DESFAZER } : error,
    );
  }

  const linha = (data ?? [])[0];
  if (linha === undefined) {
    throw new Error("O fechamento não foi desfeito. Recarregue a página e confira a venda.");
  }

  return {
    contratosApagados: linha.contratos_apagados,
    estagioRestaurado: linha.estagio_restaurado,
  };
}
