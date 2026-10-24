import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import type { Database } from "@/shared/types/database.types";

import { supabaseV2 } from "@/integrations/supabase/client.v2";
import type { LinhaDeNegocio } from "../domain/contract";
import {
  problemaNoLimiarDeAlerta,
  problemaNoPercentualDoPadrao,
  recusaDoTetoDoPadrao,
  type PadraoParaSoma,
  type Participacao,
  type TipoDeParticipacao,
} from "../domain/shares";

const LIMITE = 100;

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n >= teto) {
    throw new Error(
      `A lista de ${oQue} veio no teto de ${teto} e pode estar incompleta. ` +
        `Participação é caminho de dinheiro: lista truncada soma menos que o banco.`,
    );
  }
}

const COLUNAS_DE_PARTICIPACAO =
  "id, contract_id, profile_id, external_name, kind, share_pct, profiles(full_name, active)";

type LinhaDeParticipacao = Database["public"]["Tables"]["contract_shares"]["Row"] & {
  profiles: { full_name: string; active: boolean } | null;
};

export interface ParticipacaoGravada extends Participacao {
  readonly id: string;
  readonly contratoId: string;
  readonly beneficiario: string;
  readonly perfilDesativado: boolean;
}

function paraParticipacao(linha: LinhaDeParticipacao): ParticipacaoGravada {
  return {
    id: linha.id,
    contratoId: linha.contract_id,
    perfilId: linha.profile_id,
    nomeExterno: linha.external_name,
    tipo: linha.kind,
    percentual: linha.share_pct,
    beneficiario: linha.profiles?.full_name ?? linha.external_name ?? "(sem beneficiário)",
    perfilDesativado: linha.profiles?.active === false,
  };
}

export async function listarParticipacoes(contratoId: string): Promise<ParticipacaoGravada[]> {
  const { data, error } = await supabaseV2
    .from("contract_shares")
    .select(COLUNAS_DE_PARTICIPACAO)
    .eq("contract_id", contratoId)
    .order("kind")
    .order("share_pct", { ascending: false })
    .limit(LIMITE);

  if (error) throw erroDoBanco(error);
  const linhas = (data as LinhaDeParticipacao[] | null) ?? [];
  recusaSeTruncou(linhas.length, LIMITE, "participações deste contrato");
  return linhas.map(paraParticipacao);
}

export interface ParticipacaoAGravar extends Participacao {
  readonly id?: string;
}

export async function gravarParticipacoes(
  contratoId: string,
  linhas: readonly ParticipacaoAGravar[],
): Promise<void> {
  const { error } = await supabaseV2.rpc("save_contract_shares", {
    p_contract_id: contratoId,
    p_shares: linhas.map((linha) => ({
      ...(linha.id === undefined ? {} : { id: linha.id }),
      profile_id: linha.perfilId,
      external_name: linha.nomeExterno,
      kind: linha.tipo,
      share_pct: linha.percentual,
    })),
  });
  if (error) throw erroDoBanco(error);
}

export interface PadraoDaLinhaDeNegocio {
  readonly id: string;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly perfilId: string;
  readonly beneficiario: string;
  readonly tipo: TipoDeParticipacao;
  readonly percentual: number;
}

export async function listarPadroesDaLinhaDeNegocio(
  linhaDeNegocio: LinhaDeNegocio,
): Promise<PadraoDaLinhaDeNegocio[]> {
  const { data, error } = await supabaseV2
    .from("bu_default_shares")
    .select("id, business_unit, profile_id, kind, share_pct, profiles(full_name)")
    .eq("business_unit", linhaDeNegocio)
    .eq("active", true)
    .limit(LIMITE);

  if (error) throw erroDoBanco(error);

  type Linha = Database["public"]["Tables"]["bu_default_shares"]["Row"] & {
    profiles: { full_name: string } | null;
  };

  const linhas = (data as Linha[] | null) ?? [];
  recusaSeTruncou(linhas.length, LIMITE, "padrões desta linha de negócio");

  return linhas.map((d) => ({
    id: d.id,
    linhaDeNegocio: d.business_unit,
    perfilId: d.profile_id,
    beneficiario: d.profiles?.full_name ?? "(perfil removido)",
    tipo: d.kind,
    percentual: d.share_pct,
  }));
}

export async function listarTodosOsPadroes(): Promise<PadraoDaLinhaDeNegocio[]> {
  const { data, error } = await supabaseV2
    .from("bu_default_shares")
    .select("id, business_unit, profile_id, kind, share_pct, profiles(full_name)")
    .eq("active", true)
    .order("business_unit")
    .limit(LIMITE);

  if (error) throw erroDoBanco(error);

  type Linha = Database["public"]["Tables"]["bu_default_shares"]["Row"] & {
    profiles: { full_name: string } | null;
  };

  const linhas = (data as Linha[] | null) ?? [];
  recusaSeTruncou(linhas.length, LIMITE, "padrões configurados");

  return linhas.map((d) => ({
    id: d.id,
    linhaDeNegocio: d.business_unit,
    perfilId: d.profile_id,
    beneficiario: d.profiles?.full_name ?? "(perfil removido)",
    tipo: d.kind,
    percentual: d.share_pct,
  }));
}

export interface PadraoAGravar {
  readonly linhaDeNegocio: Exclude<LinhaDeNegocio, "compartilhado">;
  readonly perfilId: string;
  readonly tipo: TipoDeParticipacao;
  readonly percentual: number;
}

const RECUSA_DO_PADRAO =
  "Nada foi alterado: só o owner configura participação padrão. Se você cadastrou o app autenticador e entrou sem o código, saia e entre de novo digitando o código de 6 dígitos.";

const PADRAO_REPETIDO =
  "Esta pessoa já tem participação padrão deste tipo nesta linha de negócio. Se ela não aparece na lista, está desativada: use Adicionar participação padrão para trazê-la de volta.";

const PADRAO_NAO_SALVO =
  "O padrão não foi salvo: ele mudou em outra tela ou você não tem permissão. Recarregue a página e confira.";

function recusaSePercentualInvalido(percentual: number): void {
  const problema = problemaNoPercentualDoPadrao(percentual);
  if (problema !== null) throw new Error(problema);
}

async function lerProducaoAtivaDaBu(linhaDeNegocio: LinhaDeNegocio): Promise<PadraoParaSoma[]> {
  const { data, error } = await supabaseV2
    .from("bu_default_shares")
    .select("id, business_unit, profile_id, kind, share_pct")
    .eq("business_unit", linhaDeNegocio)
    .eq("kind", "producao")
    .eq("active", true)
    .limit(LIMITE);

  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, LIMITE, "padrões de produção desta linha de negócio");

  return linhas.map((d) => ({
    id: d.id,
    linhaDeNegocio: d.business_unit,
    perfilId: d.profile_id,
    tipo: d.kind,
    percentual: d.share_pct,
  }));
}

async function recusaSeExcedeOTeto(id: string | null, padrao: PadraoAGravar): Promise<void> {
  if (padrao.tipo !== "producao") return;

  const padroes = await lerProducaoAtivaDaBu(padrao.linhaDeNegocio);
  const recusa = recusaDoTetoDoPadrao(padroes, { id, ...padrao });
  if (recusa !== null) throw new Error(recusa);
}

export async function atualizarPadrao(
  id: string,
  anterior: PadraoAGravar,
  padrao: PadraoAGravar,
): Promise<void> {
  recusaSePercentualInvalido(padrao.percentual);
  await recusaSeExcedeOTeto(id, padrao);

  const { data, error } = await supabaseV2
    .from("bu_default_shares")
    .update({
      business_unit: padrao.linhaDeNegocio,
      profile_id: padrao.perfilId,
      kind: padrao.tipo,
      share_pct: padrao.percentual,
    })
    .eq("id", id)
    .eq("business_unit", anterior.linhaDeNegocio)
    .eq("profile_id", anterior.perfilId)
    .eq("kind", anterior.tipo)
    .eq("share_pct", anterior.percentual)
    .eq("active", true)
    .select("id");

  if (error?.code === "23505") {
    throw erroDoBanco({
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: PADRAO_REPETIDO,
    });
  }
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(PADRAO_NAO_SALVO);
  }
}

export async function adicionarPadrao(padrao: PadraoAGravar): Promise<void> {
  recusaSePercentualInvalido(padrao.percentual);
  await recusaSeExcedeOTeto(null, padrao);

  const { data: reativada, error: erroAoReativar } = await supabaseV2
    .from("bu_default_shares")
    .update({ active: true, share_pct: padrao.percentual })
    .eq("business_unit", padrao.linhaDeNegocio)
    .eq("profile_id", padrao.perfilId)
    .eq("kind", padrao.tipo)
    .eq("active", false)
    .select("id");
  if (erroAoReativar) throw erroDoBanco(erroAoReativar);
  if ((reativada ?? []).length > 0) return;

  const { error } = await supabaseV2.from("bu_default_shares").insert({
    business_unit: padrao.linhaDeNegocio,
    profile_id: padrao.perfilId,
    kind: padrao.tipo,
    share_pct: padrao.percentual,
  });
  if (error?.code === "23505") {
    throw erroDoBanco({
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: PADRAO_REPETIDO,
    });
  }
  if (error?.code === "42501") {
    throw erroDoBanco({
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: RECUSA_DO_PADRAO,
    });
  }
  if (error) throw erroDoBanco(error);
}

export async function desativarPadrao(id: string): Promise<void> {
  const { data, error } = await supabaseV2
    .from("bu_default_shares")
    .update({ active: false })
    .eq("id", id)
    .select("id");

  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(RECUSA_DO_PADRAO);
  }
}

export interface ContratoSemParticipacao {
  readonly id: string;
  readonly nome: string;
  readonly cliente: string;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly tipo: Database["public"]["Enums"]["contract_type"];
  readonly valorMensal: number | null;
  readonly valorTotal: number | null;
}

export const LIMITE_DE_BACKFILL = 200;

export async function listarContratosSemParticipacao(): Promise<{
  readonly contratos: ContratoSemParticipacao[];
  readonly truncado: boolean;
}> {
  const { data, error } = await supabaseV2
    .from("contracts")
    .select(
      "id, name, business_unit, contract_type, monthly_value, total_value, " +
        "clients(name), contract_shares(id)",
    )
    .neq("status", "cancelled")
    .eq("billing_active", true)
    .eq("is_commissionable", true)
    .order("created_at", { ascending: false })
    .limit(LIMITE_DE_BACKFILL);

  if (error) throw erroDoBanco(error);

  type Linha = {
    id: string;
    name: string;
    business_unit: LinhaDeNegocio;
    contract_type: Database["public"]["Enums"]["contract_type"];
    monthly_value: number | null;
    total_value: number | null;
    clients: { name: string } | null;
    contract_shares: ReadonlyArray<{ id: string }>;
  };

  const linhas = (data as unknown as Linha[] | null) ?? [];

  return {
    contratos: linhas
      .filter((linha) => linha.contract_shares.length === 0)
      .map((linha) => ({
        id: linha.id,
        nome: linha.name,
        cliente: linha.clients?.name ?? "(cliente removido)",
        linhaDeNegocio: linha.business_unit,
        tipo: linha.contract_type,
        valorMensal: linha.monthly_value,
        valorTotal: linha.total_value,
      })),
    truncado: linhas.length === LIMITE_DE_BACKFILL,
  };
}

const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PessoaParaParticipacao {
  readonly id: string;
  readonly nome: string;
  readonly ativo: boolean;
}

export async function listarPessoasParaParticipacao(
  perfisAPreservar?: readonly string[] | null,
): Promise<PessoaParaParticipacao[]> {
  const preservar = Array.from(
    new Set((perfisAPreservar ?? []).filter((id) => FORMATO_DE_UUID.test(id))),
  );

  let consulta = supabaseV2.from("profiles").select("id, full_name, active");
  consulta =
    preservar.length === 0
      ? consulta.eq("active", true)
      : consulta.or(`active.eq.true,id.in.(${preservar.join(",")})`);

  const { data, error } = await consulta.order("full_name").limit(LIMITE);

  if (error) throw erroDoBanco(error);
  const linhas = data ?? [];
  recusaSeTruncou(linhas.length, LIMITE, "pessoas");
  return linhas.map((p) => ({ id: p.id, nome: p.full_name, ativo: p.active }));
}

export interface LimiarDeAlerta {
  readonly percentual: number | null;
  readonly confirmado: boolean;
}

export async function lerLimiarDeAlerta(): Promise<LimiarDeAlerta> {
  const { data, error } = await supabaseV2
    .from("app_settings")
    .select("value")
    .eq("key", "share_warning_pct")
    .maybeSingle();

  if (error) throw erroDoBanco(error);
  if (data === null) return { percentual: null, confirmado: false };

  const valor: unknown = data.value;
  if (typeof valor !== "object" || valor === null) {
    return { percentual: null, confirmado: false };
  }

  const registro = valor as Record<string, unknown>;
  const pct = registro.pct;
  const confirmado = registro._confirmado;

  return {
    percentual: typeof pct === "number" ? pct : null,
    confirmado: confirmado === true,
  };
}

export async function salvarLimiarDeAlerta(limiar: {
  readonly percentual: number;
  readonly confirmado: boolean;
}): Promise<void> {
  const problema = problemaNoLimiarDeAlerta(limiar.percentual);
  if (problema !== null) throw new Error(problema);

  const { data, error } = await supabaseV2
    .from("app_settings")
    .update({ value: { pct: limiar.percentual, _confirmado: limiar.confirmado } })
    .eq("key", "share_warning_pct")
    .select("key");

  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner muda o aviso de participação.");
  }
}
