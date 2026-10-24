import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";

import type {
  EdicaoDaEtapa,
  EdicaoDoItem,
  EtapaDaJornada,
  ItemDaJornada,
  Jornada,
} from "../domain/onboarding";

const TETO_CLIENTES = 200;
const TETO_PAPEIS = 50;

function recusaSeTruncou(n: number, teto: number, oQue: string): void {
  if (n >= teto) {
    throw new Error(
      `A lista de ${oQue} veio no teto de ${teto} e pode estar incompleta. ` +
        `Escolher a partir de lista truncada esconde opção válida.`,
    );
  }
}

export interface ClienteParaJornada {
  readonly id: string;
  readonly nome: string;
  readonly jornadaId: string | null;
  readonly jornadaConcluida: boolean;
  readonly donoId: string | null;
}

export async function lerClientesComJornada(): Promise<readonly ClienteParaJornada[]> {
  const { data, error } = await supabaseV2
    .from("clients")
    .select("id, name, owner_id, onboarding_journeys!left ( id, concluida_em, iniciada_em )")
    .order("name")
    .limit(TETO_CLIENTES);
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as unknown as {
    id: string;
    name: string;
    owner_id: string | null;
    onboarding_journeys: { id: string; concluida_em: string | null; iniciada_em: string }[] | null;
  }[];
  recusaSeTruncou(linhas.length, TETO_CLIENTES, "clientes");
  return linhas.map((c) => {
    const jornadas = c.onboarding_journeys ?? [];
    const aberta = jornadas.find((j) => j.concluida_em === null) ?? null;
    const ultimaFechada = jornadas
      .filter((j) => j.concluida_em !== null)
      .sort((a, b) => (a.iniciada_em < b.iniciada_em ? 1 : -1))[0];
    const escolhida = aberta ?? ultimaFechada ?? null;
    return {
      id: c.id,
      nome: c.name,
      jornadaId: escolhida?.id ?? null,
      jornadaConcluida: escolhida !== null && escolhida.concluida_em !== null,
      donoId: c.owner_id,
    };
  });
}

const COLUNAS_DA_JORNADA = `
  id, client_id, template_versao, iniciada_em, concluida_em,
  cliente:clients ( name ),
  onboarding_phases (
    id, ordem, nome, descricao, periodo, responsavel, liberada_em,
    onboarding_tasks ( id, ordem, titulo, papel, deadline_days, internal_task_id, concluida_em )
  )
` as const;

interface EtapaCrua {
  id: string;
  ordem: number;
  nome: string;
  descricao: string;
  periodo: string;
  responsavel: string;
  liberada_em: string | null;
  onboarding_tasks: {
    id: string;
    ordem: number;
    titulo: string;
    papel: string;
    deadline_days: number;
    internal_task_id: string | null;
    concluida_em: string | null;
  }[];
}

export async function lerJornada(jornadaId: string): Promise<Jornada> {
  const { data, error } = await supabaseV2
    .from("onboarding_journeys")
    .select(COLUNAS_DA_JORNADA)
    .eq("id", jornadaId)
    .single();
  if (error) throw erroDoBanco(error);

  const linha = data as unknown as {
    id: string;
    client_id: string;
    template_versao: number;
    iniciada_em: string;
    concluida_em: string | null;
    cliente: { name: string } | null;
    onboarding_phases: EtapaCrua[];
  };

  const etapas: EtapaDaJornada[] = [...(linha.onboarding_phases ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .map((f) => ({
      id: f.id,
      ordem: f.ordem,
      nome: f.nome,
      descricao: f.descricao,
      periodo: f.periodo,
      responsavel: f.responsavel,
      liberadaEm: f.liberada_em,
      itens: [...(f.onboarding_tasks ?? [])]
        .sort((a, b) => a.ordem - b.ordem)
        .map((t): ItemDaJornada => ({
          id: t.id,
          ordem: t.ordem,
          titulo: t.titulo,
          papel: t.papel,
          prazoEmDias: t.deadline_days,
          tarefaId: t.internal_task_id,
          concluidoEm: t.concluida_em,
        })),
    }));

  return {
    id: linha.id,
    clienteId: linha.client_id,
    cliente: linha.cliente?.name ?? "-",
    versaoDoMetodo: linha.template_versao,
    iniciadaEm: linha.iniciada_em,
    concluidaEm: linha.concluida_em,
    etapas,
  };
}

export async function lerPapeisExigidosPeloMetodo(): Promise<readonly string[]> {
  const { data, error } = await supabaseV2
    .from("onboarding_template_tasks")
    .select("papel")
    .limit(500);
  if (error) throw erroDoBanco(error);
  return [...new Set((data ?? []).map((t) => t.papel))];
}

export interface PapelConfigurado {
  readonly papel: string;
  readonly pessoaId: string | null;
  readonly pessoa: string | null;
  readonly pessoaInativa: boolean;
}

export async function lerPapeis(): Promise<readonly PapelConfigurado[]> {
  const { data, error } = await supabaseV2
    .from("role_assignments")
    .select("role_key, profile_id, pessoa:profiles ( full_name, active )")
    .order("role_key")
    .limit(TETO_PAPEIS);
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as unknown as {
    role_key: string;
    profile_id: string | null;
    pessoa: { full_name: string; active: boolean } | null;
  }[];
  recusaSeTruncou(linhas.length, TETO_PAPEIS, "papéis");
  return linhas.map((r) => ({
    papel: r.role_key,
    pessoaId: r.profile_id,
    pessoa: r.pessoa?.full_name ?? null,
    pessoaInativa: r.pessoa !== null && !r.pessoa.active,
  }));
}

export async function definirPapel(papel: string, pessoaId: string | null): Promise<void> {
  const { data, error } = await supabaseV2
    .from("role_assignments")
    .update({ profile_id: pessoaId, updated_at: new Date().toISOString() })
    .eq("role_key", papel)
    .select("role_key");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Você não tem permissão para configurar papéis.");
  }
}

function emPortugues(
  erro: { message?: string; details?: string; hint?: string; code?: string },
  acao: string,
): { message?: string; details?: string; hint?: string; code?: string } {
  if (erro.message?.includes("forbidden") === true) {
    return { ...erro, message: `${acao} é do owner ou do responsável pelo cliente.` };
  }
  if (erro.code === "23505" && erro.message?.includes("uniq_jornada_aberta_por_cliente") === true) {
    return { ...erro, message: "Este cliente já tem jornada aberta." };
  }
  return erro;
}

export async function iniciarJornada(clienteId: string): Promise<string> {
  const { data, error } = await supabaseV2.rpc("iniciar_jornada", { p_client_id: clienteId });
  if (error) throw erroDoBanco(emPortugues(error, "Abrir jornada"));
  return data as string;
}

export async function liberarEtapa(etapaId: string, forcar = false): Promise<number> {
  const { data, error } = await supabaseV2.rpc("liberar_etapa", {
    p_phase_id: etapaId,
    p_forcar: forcar,
  });
  if (error) throw erroDoBanco(emPortugues(error, "Liberar etapa"));
  return data as number;
}

const PRAZO_INVALIDO = "O prazo do item é um número inteiro de dias, de 0 a 365.";

export async function editarItemDaJornada(itemId: string, campos: EdicaoDoItem): Promise<void> {
  if (!Number.isInteger(campos.prazoEmDias) || campos.prazoEmDias < 0 || campos.prazoEmDias > 365) {
    throw new Error(PRAZO_INVALIDO);
  }
  const { error } = await supabaseV2.rpc("editar_item_da_jornada", {
    p_item_id: itemId,
    p_titulo: campos.titulo.trim(),
    p_prazo_em_dias: campos.prazoEmDias,
    p_papel: campos.papel,
  });
  if (error) throw erroDoBanco(emPortugues(error, "Editar a jornada"));
}

export async function editarEtapaDaJornada(etapaId: string, campos: EdicaoDaEtapa): Promise<void> {
  const { error } = await supabaseV2.rpc("editar_etapa_da_jornada", {
    p_phase_id: etapaId,
    p_descricao: campos.descricao.trim(),
    p_responsavel: campos.responsavel.trim(),
  });
  if (error) throw erroDoBanco(emPortugues(error, "Editar a jornada"));
}

export async function apagarJornada(jornadaId: string): Promise<number> {
  const { data, error } = await supabaseV2.rpc("apagar_jornada", { p_journey_id: jornadaId });
  if (error) {
    throw erroDoBanco(
      error.code === "42501" && error.message?.includes("forbidden") === true
        ? { ...error, message: "Apagar jornada é do owner." }
        : error,
    );
  }
  return data;
}

export async function marcarItem(itemId: string, concluido: boolean): Promise<void> {
  const { data, error } = await supabaseV2
    .from("onboarding_tasks")
    .update({ concluida_em: concluido ? new Date().toISOString() : null })
    .eq("id", itemId)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Você não tem permissão para marcar este item.");
  }
}
