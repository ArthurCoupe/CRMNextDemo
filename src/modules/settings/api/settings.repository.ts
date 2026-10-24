import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { iniciais } from "@/shared/lib/iniciais";
import { supabaseV2 } from "@/integrations/supabase/client.v2";
import type { PapelDoUsuario } from "@/integrations/supabase/papel";

const TETO_DE_PERFIS = 200;

export interface MetasDeAtividade {
  readonly toquesSemana: number | null;
  readonly r1Semana: number | null;
  readonly confirmado: boolean;
}

export interface MetasFinanceiras {
  readonly mrrMensal: number | null;
  readonly tcvAlvo: number | null;
  readonly confirmado: boolean;
}

export const METAS_DE_ATIVIDADE_VAZIAS: MetasDeAtividade = {
  toquesSemana: null,
  r1Semana: null,
  confirmado: false,
};

export const METAS_FINANCEIRAS_VAZIAS: MetasFinanceiras = {
  mrrMensal: null,
  tcvAlvo: null,
  confirmado: false,
};

export async function lerMetasDeAtividade(): Promise<MetasDeAtividade> {
  const { data, error } = await supabaseV2.rpc("get_metas");
  if (error) throw erroDoBanco(error);
  const linha = (data ?? [])[0];
  if (linha === undefined) return METAS_DE_ATIVIDADE_VAZIAS;
  return {
    toquesSemana: linha.toques_semana,
    r1Semana: linha.r1_semana,
    confirmado: linha.confirmado,
  };
}

export async function lerMetasFinanceiras(): Promise<MetasFinanceiras> {
  const { data, error } = await supabaseV2.rpc("get_metas_financeiras");
  if (error) throw erroDoBanco(error);
  const linha = (data ?? [])[0];
  if (linha === undefined) return METAS_FINANCEIRAS_VAZIAS;
  return {
    mrrMensal: linha.mrr_mensal,
    tcvAlvo: linha.tcv_alvo,
    confirmado: linha.confirmado,
  };
}

export async function salvarMetas(metas: {
  readonly toquesSemana: number;
  readonly r1Semana: number;
  readonly mrrMensal: number;
  readonly tcvAlvo: number;
  readonly confirmado: boolean;
}): Promise<void> {
  const { data, error } = await supabaseV2
    .from("app_settings")
    .update({
      value: {
        toques_semana: metas.toquesSemana,
        r1_semana: metas.r1Semana,
        mrr_mensal: metas.mrrMensal,
        tcv_alvo: metas.tcvAlvo,
        _confirmado: metas.confirmado,
      },
    })
    .eq("key", "metas")
    .select("key");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Alterar metas é do owner.");
  }
}

export interface PessoaDoTime {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly iniciais: string;
  readonly papel: string;
  readonly ativo: boolean;
  readonly cargo: string | null;
}

export interface ListaDoTime {
  readonly pessoas: readonly PessoaDoTime[];
  readonly truncada: boolean;
}

export async function lerTime(): Promise<ListaDoTime> {
  const { data, error } = await supabaseV2
    .from("profiles")
    .select("id, full_name, email, role, active, job_title")
    .in("role", ["owner", "manager", "member"])
    .order("full_name")
    .limit(TETO_DE_PERFIS);
  if (error) throw erroDoBanco(error);
  const pessoas = (data ?? []).map((p) => ({
    id: p.id,
    nome: p.full_name,
    email: p.email,
    iniciais: iniciais(p.full_name),
    papel: p.role,
    ativo: p.active,
    cargo: p.job_title,
  }));
  return { pessoas, truncada: pessoas.length >= TETO_DE_PERFIS };
}

export async function definirSituacaoDaPessoa(id: string, ativo: boolean): Promise<void> {
  const { data, error } = await supabaseV2
    .from("profiles")
    .update({ active: ativo })
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nao foi possivel alterar a situacao: so um owner pode fazer isso.");
  }
}

export async function definirPapelDaPessoa(id: string, papel: PapelDoUsuario): Promise<void> {
  const { data, error } = await supabaseV2
    .from("profiles")
    .update({ role: papel })
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nao foi possivel trocar o papel: so um owner pode fazer isso.");
  }
}

export async function atualizarPerfil(
  id: string,
  dados: { nomeCompleto: string; cargo: string | null },
): Promise<void> {
  const nome = dados.nomeCompleto.trim();
  if (nome === "") throw new Error("O nome não pode ficar em branco.");
  const cargo = dados.cargo === null || dados.cargo.trim() === "" ? null : dados.cargo.trim();

  const { data, error } = await supabaseV2
    .from("profiles")
    .update({ full_name: nome, job_title: cargo })
    .eq("id", id)
    .select("id");

  if (error !== null) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error(
      "O perfil não foi salvo. Recarregue a página: o perfil pode ter mudado ou a sessão expirou.",
    );
  }
}
