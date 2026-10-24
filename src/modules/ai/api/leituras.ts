import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ehStaff,
  type ClienteDoContexto,
  type FinanceiroDoContexto,
  type OnboardingDoContexto,
  type OportunidadeDoContexto,
  type Papel,
  type TarefaDoContexto,
} from "@/modules/ai/domain/contexto";
import { diasCivisDesde } from "@/shared/lib/date";
import type { Database } from "@/shared/types/database.types";

export type Cliente = SupabaseClient<Database>;

const LIMITE_DE_LEITURA = 200;

function recusaSeTruncou(n: number, oQue: string): void {
  if (n >= LIMITE_DE_LEITURA) {
    throw new Error(
      `${oQue}: a leitura veio no teto de ${LIMITE_DE_LEITURA} e está incompleta. ` +
        `Contexto truncado em silêncio faz o assistente afirmar meia verdade. ` +
        `Esta leitura precisa de recorte ou resumo antes de crescer.`,
    );
  }
}

const ESTAGIOS_ENCERRADOS = ["fechado", "perdido", "descartado"] as const;

export async function lerQuemPergunta(
  supabase: Cliente,
  userId: string,
): Promise<{ papel: Papel; nome: string }> {
  const [papelResp, perfilResp] = await Promise.all([
    supabase.rpc("current_app_role"),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);

  if (papelResp.error !== null) throw new Error(`current_app_role: ${papelResp.error.message}`);
  if (perfilResp.error !== null) throw new Error(`profiles: ${perfilResp.error.message}`);

  const papel = papelResp.data;
  if (papel === null) throw new Error("Sem papel: o token não resolveu para nenhum usuário");
  if (!ehStaff(papel)) throw new Error("O assistente é só para a equipe.");

  return { papel, nome: perfilResp.data?.full_name ?? "colega" };
}

export async function lerMinhasTarefas(
  supabase: Cliente,
  userId: string,
): Promise<readonly TarefaDoContexto[]> {
  const { data, error } = await supabase
    .from("internal_tasks")
    .select("title, due_date, col, clients(name)")
    .eq("assignee_id", userId)
    .neq("col", "done")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(LIMITE_DE_LEITURA);
  if (error !== null) throw new Error(`internal_tasks: ${error.message}`);
  recusaSeTruncou((data ?? []).length, "internal_tasks");

  return (data ?? []).map((t) => ({
    titulo: t.title,
    prazo: t.due_date,
    coluna: t.col,
    diasDeAtraso: t.due_date === null ? null : diasCivisDesde(t.due_date),
    cliente: t.clients?.name ?? null,
  }));
}

export async function lerPipeline(supabase: Cliente): Promise<readonly OportunidadeDoContexto[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "name, stage, estimated_value, next_followup_at, stage_changed_at, em_nutricao, nutrir_ate",
    )
    .not("stage", "in", `(${ESTAGIOS_ENCERRADOS.join(",")})`)
    .order("stage_changed_at", { ascending: true })
    .limit(LIMITE_DE_LEITURA);
  if (error !== null) throw new Error(`opportunities: ${error.message}`);
  recusaSeTruncou((data ?? []).length, "opportunities");

  return (data ?? []).map((o) => ({
    nome: o.name,
    estagio: o.stage,
    valorEstimado: o.estimated_value,
    proximoFollowup: o.next_followup_at,
    diasNoEstagio: o.stage_changed_at === null ? null : diasCivisDesde(o.stage_changed_at),
    emNutricao: o.em_nutricao,
    nutrirAte: o.nutrir_ate,
  }));
}

export async function lerClientes(supabase: Cliente): Promise<readonly ClienteDoContexto[]> {
  const [clientesResp, saudeResp] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, status, segment, nicho")
      .neq("status", "churned")
      .order("name")
      .limit(LIMITE_DE_LEITURA),
    supabase.from("v_client_health").select("client_id, ultimo_evento_em").limit(LIMITE_DE_LEITURA),
  ]);

  if (clientesResp.error !== null) throw new Error(`clients: ${clientesResp.error.message}`);
  if (saudeResp.error !== null) throw new Error(`v_client_health: ${saudeResp.error.message}`);
  recusaSeTruncou((clientesResp.data ?? []).length, "clients");
  recusaSeTruncou((saudeResp.data ?? []).length, "v_client_health");

  const ultimoEvento = new Map<string, string | null>();
  for (const s of saudeResp.data ?? []) {
    if (s.client_id !== null) ultimoEvento.set(s.client_id, s.ultimo_evento_em);
  }

  return (clientesResp.data ?? []).map((c) => {
    const visto = ultimoEvento.get(c.id) ?? null;
    return {
      nome: c.name,
      status: c.status,
      segmento: c.segment,
      nicho: c.nicho,
      diasSemContato: visto === null ? null : diasCivisDesde(visto),
    };
  });
}

export async function lerOnboarding(supabase: Cliente): Promise<readonly OnboardingDoContexto[]> {
  const { data, error } = await supabase
    .from("onboarding_journeys")
    .select("iniciada_em, clients(name), onboarding_phases(ordem, nome, liberada_em)")
    .is("concluida_em", null)
    .limit(LIMITE_DE_LEITURA);
  if (error !== null) throw new Error(`onboarding_journeys: ${error.message}`);
  recusaSeTruncou((data ?? []).length, "onboarding_journeys");

  return (data ?? []).map((j) => {
    const liberadas = (j.onboarding_phases ?? [])
      .filter((f) => f.liberada_em !== null)
      .sort((a, b) => a.ordem - b.ordem);
    const atual = liberadas.at(-1) ?? null;

    return {
      cliente: j.clients?.name ?? "(cliente sem nome)",
      etapaAtual: atual?.nome ?? null,
      ordem: atual?.ordem ?? null,
      diasDesdeInicio: j.iniciada_em === null ? null : diasCivisDesde(j.iniciada_em),
    };
  });
}

export async function lerFinanceiro(
  supabase: Cliente,
  primeiroDiaDoMes: string,
): Promise<FinanceiroDoContexto> {
  const [mrr, tcv, resultado] = await Promise.all([
    supabase.rpc("get_mrr_by_unit"),
    supabase.rpc("get_tcv_by_unit"),
    supabase.rpc("get_result_total", { p_ref_month: primeiroDiaDoMes }),
  ]);

  if (mrr.error !== null) throw new Error(`get_mrr_by_unit: ${mrr.error.message}`);
  if (tcv.error !== null) throw new Error(`get_tcv_by_unit: ${tcv.error.message}`);
  if (resultado.error !== null) throw new Error(`get_result_total: ${resultado.error.message}`);

  const r = resultado.data?.[0] ?? null;

  return {
    mrrPorBu: (mrr.data ?? []).map((m) => ({ bu: m.bu, total: Number(m.mrr_total) })),
    tcvPorBu: (tcv.data ?? []).map((t) => ({ bu: t.bu, total: Number(t.tcv_total) })),
    resultadoDoMes:
      r === null
        ? null
        : {
            receitaLiquida: Number(r.receita_liquida),
            custoTotal: Number(r.custo_total),
            resultado: Number(r.resultado),
            margemPct: r.margem_pct === null ? null : Number(r.margem_pct),
            congelado: r.congelado,
          },
  };
}
