import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";
export { ehFaltaDePermissao } from "@/shared/lib/permissao";

import type { CustoDeFolhaPorBu, PessoaNaEquipe, VinculoDeTrabalho } from "../domain/payroll";
import type { DataISO, UnidadeDeNegocio } from "../domain/expenses";

const TETO_DE_LINHAS = 500;

export async function lerCustoDeFolhaPorBu(): Promise<readonly CustoDeFolhaPorBu[]> {
  const { data, error } = await supabaseV2.rpc("get_payroll_cost");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    bu: linha.bu,
    custoFixo: linha.custo_fixo,
    pessoas: linha.pessoas,
    mesReferencia: linha.mes_referencia,
  }));
}

export async function lerVeFolha(): Promise<boolean> {
  const { data, error } = await supabaseV2.rpc("ve_folha");
  if (error) throw erroDoBanco(error);
  return data === true;
}

export async function lerEquipe(): Promise<readonly PessoaNaEquipe[]> {
  const { data, error } = await supabaseV2.rpc("get_team_cost");
  if (error) throw erroDoBanco(error);
  return (data ?? []).map((linha) => ({
    id: linha.payroll_id,
    chave: linha.chave,
    profileId: linha.profile_id,
    pessoa: linha.pessoa,
    cargo: linha.cargo,
    vinculo: linha.vinculo,
    bu: linha.bu,
    custoMensal: linha.custo_mensal,
    beneficios: linha.beneficios,
    custoFixo: linha.custo_fixo,
    custoVariavel: linha.custo_variavel,
    contratosComParticipacao: linha.contratos_com_participacao,
    custoTotal: linha.custo_total,
    inicio: linha.inicio,
    fim: linha.fim,
    ativa: linha.ativa,
    semLinhaDeFolha: linha.participacao_sem_linha,
  }));
}

export interface PessoaCadastrada {
  readonly id: string;
  readonly profileId: string | null;
  readonly pessoa: string;
  readonly cargo: string | null;
  readonly vinculo: VinculoDeTrabalho;
  readonly bu: UnidadeDeNegocio;
  readonly custoMensal: number;
  readonly beneficios: number;
  readonly percentualSugerido: number | null;
  readonly inicio: DataISO;
  readonly fim: DataISO | null;
  readonly ativa: boolean;
}

const COLUNAS =
  "id, profile_id, person_name, job_title, work_kind, monthly_cost, benefits, commission_pct, business_unit, start_date, end_date, active";

export interface CadastroDaFolha {
  readonly linhas: readonly PessoaCadastrada[];
  readonly truncada: boolean;
}

export async function listarPessoas({
  incluirInativas = false,
}: { incluirInativas?: boolean } = {}): Promise<CadastroDaFolha> {
  let consulta = supabaseV2.from("payroll").select(COLUNAS);
  if (!incluirInativas) consulta = consulta.eq("active", true);

  const { data, error } = await consulta
    .order("active", { ascending: false })
    .order("monthly_cost", { ascending: false })
    .limit(TETO_DE_LINHAS);
  if (error) throw erroDoBanco(error);

  const linhas = (data ?? []).map((l) => ({
    id: l.id,
    profileId: l.profile_id,
    pessoa: l.person_name,
    cargo: l.job_title,
    vinculo: l.work_kind,
    bu: l.business_unit,
    custoMensal: l.monthly_cost,
    beneficios: l.benefits,
    percentualSugerido: l.commission_pct,
    inicio: l.start_date,
    fim: l.end_date,
    ativa: l.active,
  }));

  return { linhas, truncada: linhas.length === TETO_DE_LINHAS };
}

const FORMATO_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listarPerfis(
  perfilAtualId?: string | null,
): Promise<readonly { readonly id: string; readonly nome: string; readonly ativo: boolean }[]> {
  const vinculado =
    typeof perfilAtualId === "string" && FORMATO_DE_UUID.test(perfilAtualId) ? perfilAtualId : null;

  let consulta = supabaseV2.from("profiles").select("id, full_name, active");
  consulta =
    vinculado === null
      ? consulta.eq("active", true)
      : consulta.or(`active.eq.true,id.eq.${vinculado}`);

  const { data, error } = await consulta.order("full_name").limit(TETO_DE_LINHAS);
  if (error) throw erroDoBanco(error);

  const linhas = data ?? [];
  if (linhas.length >= TETO_DE_LINHAS) {
    throw new Error(
      `A lista de contas veio no teto de ${TETO_DE_LINHAS} e pode estar incompleta. ` +
        `Escolher a partir de lista truncada esconde conta válida, inclusive a que já ` +
        `está vinculada a esta pessoa.`,
    );
  }
  return linhas.map((p) => ({ id: p.id, nome: p.full_name, ativo: p.active }));
}

export interface PessoaParaGravar {
  readonly profileId: string | null;
  readonly pessoa: string;
  readonly cargo: string | null;
  readonly vinculo: VinculoDeTrabalho;
  readonly bu: UnidadeDeNegocio;
  readonly custoMensal: number;
  readonly beneficios: number;
  readonly percentualSugerido: number | null;
  readonly inicio: DataISO;
  readonly fim: DataISO | null;
}

function paraLinha(dados: PessoaParaGravar) {
  return {
    profile_id: dados.profileId,
    person_name: dados.pessoa,
    job_title: dados.cargo,
    work_kind: dados.vinculo,
    monthly_cost: dados.custoMensal,
    benefits: dados.beneficios,
    commission_pct: dados.vinculo === "comissionado" ? dados.percentualSugerido : null,
    business_unit: dados.bu,
    start_date: dados.inicio,
    end_date: dados.fim,
  };
}

export async function criarPessoa(dados: PessoaParaGravar): Promise<string> {
  const { data, error } = await supabaseV2
    .from("payroll")
    .insert(paraLinha(dados))
    .select("id")
    .single();
  if (error) throw erroDoBanco(error);
  return data.id;
}

export async function atualizarPessoa(id: string, dados: PessoaParaGravar): Promise<void> {
  const { data, error } = await supabaseV2
    .from("payroll")
    .update(paraLinha(dados))
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita a folha.");
  }
}

export async function definirSituacaoDaPessoa(id: string, ativa: boolean): Promise<void> {
  const { data, error } = await supabaseV2
    .from("payroll")
    .update({ active: ativa })
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita a folha.");
  }
}

export async function apagarPessoaDaFolha(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("payroll").delete().eq("id", id).select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "Só o owner apaga pessoa da folha. Se você usa app autenticador, saia e entre de novo com o código de 6 dígitos.",
    );
  }
}
