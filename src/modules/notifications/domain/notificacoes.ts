import { formatDate, horarioCurtoSP, somaDias, todaySP } from "@/shared/lib/date";
import { rotuloDaChaveDeCanal } from "@/modules/pipeline/domain/channel";
import { Constants, type Database } from "@/shared/types/database.types";

export type TipoDeAviso = Database["public"]["Enums"]["notification_kind"];

export const TIPOS_DE_AVISO: readonly TipoDeAviso[] = Constants.public.Enums.notification_kind;

export const ROTULO_DO_AVISO: Readonly<Record<TipoDeAviso, string>> = {
  digest: "Resumo diário",
  tarefa_d1: "Tarefa vencendo amanhã",
  tarefa_vencida: "Tarefa vencida",
  onboarding_parado: "Etapa de onboarding parada",
  lead_frio: "Lead sem contato",
  contrato_vencendo: "Contrato vencendo",
  tcv_encerrado: "Projeto encerrado automaticamente",
  nutricao_vencida: "Nutrição no fim do prazo",
  seguranca_semanal: "Revisão semanal de segurança",
  primeiro_contato_vencido: "Primeiro contato atrasado",
};

export const EXPLICACAO_DO_AVISO: Readonly<Record<TipoDeAviso, string>> = {
  digest: "Um e-mail por dia, às 8h, com o que está atrasado e o que vence hoje.",
  tarefa_d1: "Quando uma tarefa sua vence no dia seguinte.",
  tarefa_vencida:
    "Escalação para os owners quando a tarefa de alguém do time venceu no dia anterior. O responsável já vê a tarefa no digest.",
  onboarding_parado:
    "Quando o prazo do método de uma etapa de onboarding passou há 3 dias ou mais com item pendente.",
  lead_frio:
    "Um e-mail por dia, só quando houver, listando as oportunidades suas que estão há 15 dias sem contato registrado.",
  contrato_vencendo: "Quando o faturamento de um contrato termina em 30 dias.",
  tcv_encerrado: "Quando o sistema encerra um projeto por fim de faturamento.",
  seguranca_semanal:
    "Toda segunda-feira, só para owners: quantos eventos de segurança (sessão recusada, limite excedido, papel alterado, CSP) a trilha registrou na semana, quando passar do limiar.",
  nutricao_vencida:
    "Escalação para os owners quando o prazo de nutrição de qualquer oportunidade do funil termina hoje ou já terminou.",
  primeiro_contato_vencido:
    "Um e-mail por dia, só quando houver, listando os leads seus que passaram do prazo de primeiro contato do canal sem nenhum toque registrado.",
};

export const DIAS_DE_ONBOARDING_PARADO = 3;
export const DIAS_DE_LEAD_FRIO = 15;
export const DIAS_DE_CONTRATO_VENCENDO = 30;

export interface JanelaDeAlertas {
  readonly amanha: string;
  readonly ontem: string;
  readonly limiteDeOnboarding: string;
  readonly limiteDeLeadFrio: string;
  readonly limiteDeContrato: string;
}

export function janelaDeAlertas(hojeSP: string): JanelaDeAlertas {
  return {
    amanha: somaDias(hojeSP, 1),
    ontem: somaDias(hojeSP, -1),
    limiteDeOnboarding: somaDias(hojeSP, -DIAS_DE_ONBOARDING_PARADO),
    limiteDeLeadFrio: somaDias(hojeSP, -DIAS_DE_LEAD_FRIO),
    limiteDeContrato: somaDias(hojeSP, DIAS_DE_CONTRATO_VENCENDO),
  };
}

export interface EtapaParaAvaliar {
  readonly diaZero: string;
  readonly tarefas: readonly {
    readonly concluidaEm: string | null;
    readonly deadlineDays: number;
  }[];
}

export interface AvaliacaoDaEtapa {
  readonly parada: boolean;
  readonly prazo: string | null;
  readonly pendentes: number;
}

export function etapaParada(etapa: EtapaParaAvaliar, hojeSP: string): AvaliacaoDaEtapa {
  const pendentes = etapa.tarefas.filter((t) => t.concluidaEm === null);
  if (pendentes.length === 0) return { parada: false, prazo: null, pendentes: 0 };
  const prazo = somaDias(etapa.diaZero, Math.min(...pendentes.map((t) => t.deadlineDays)));
  return {
    parada: diferencaEmDias(prazo, hojeSP) >= DIAS_DE_ONBOARDING_PARADO,
    prazo,
    pendentes: pendentes.length,
  };
}

export function chaveDoAviso(
  tipo: TipoDeAviso,
  destinatarioId: string,
  diaSP: string,
  objetoId?: string,
): string {
  const base = `${tipo}-${destinatarioId}-${diaSP}`;
  return objetoId === undefined ? base : `${base}-${objetoId}`;
}

export interface TarefaDoDigest {
  readonly id: string;
  readonly titulo: string;
  readonly prazo: string;
  readonly cliente: string | null;
}

export interface Digest {
  readonly atrasadas: readonly (TarefaDoDigest & { readonly diasDeAtraso: number })[];
  readonly paraHoje: readonly TarefaDoDigest[];
}

export function montarDigest(tarefas: readonly TarefaDoDigest[], hojeSP: string): Digest | null {
  const atrasadas: (TarefaDoDigest & { diasDeAtraso: number })[] = [];
  const paraHoje: TarefaDoDigest[] = [];

  for (const tarefa of tarefas) {
    if (tarefa.prazo < hojeSP) {
      atrasadas.push({ ...tarefa, diasDeAtraso: diferencaEmDias(tarefa.prazo, hojeSP) });
    } else if (tarefa.prazo === hojeSP) {
      paraHoje.push(tarefa);
    }
  }

  if (atrasadas.length === 0 && paraHoje.length === 0) return null;

  atrasadas.sort((a, b) => b.diasDeAtraso - a.diasDeAtraso || a.titulo.localeCompare(b.titulo));
  paraHoje.sort((a, b) => a.titulo.localeCompare(b.titulo));

  return { atrasadas, paraHoje };
}

export function diferencaEmDias(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  const inicio = Date.UTC(a1, m1 - 1, d1);
  const fim = Date.UTC(a2, m2 - 1, d2);
  return Math.round((fim - inicio) / 86_400_000);
}

export function querReceber(
  destinatarioId: string,
  tipo: TipoDeAviso,
  desligados: readonly { readonly profile_id: string; readonly tipo: TipoDeAviso }[],
): boolean {
  return !desligados.some((d) => d.profile_id === destinatarioId && d.tipo === tipo);
}

export const LEADS_FRIOS_NO_EMAIL = 10;

export interface LeadFrio {
  readonly id: string;
  readonly nome: string;
  readonly paradoDesde: string;
}

export interface OportunidadeFria extends LeadFrio {
  readonly responsavelId: string | null;
}

export interface AgrupadosPorResponsavel<T> {
  readonly porResponsavel: ReadonlyMap<string, readonly T[]>;
  readonly semResponsavel: number;
  readonly comResponsavelInativo: ReadonlyMap<string, number>;
}

export function agruparPorResponsavel<T extends { readonly responsavelId: string | null }>(
  itens: readonly T[],
  ativos: ReadonlySet<string>,
): AgrupadosPorResponsavel<Omit<T, "responsavelId">> {
  const porResponsavel = new Map<string, Omit<T, "responsavelId">[]>();
  const comResponsavelInativo = new Map<string, number>();
  let semResponsavel = 0;

  for (const { responsavelId, ...item } of itens) {
    if (responsavelId === null) {
      semResponsavel += 1;
    } else if (!ativos.has(responsavelId)) {
      comResponsavelInativo.set(responsavelId, (comResponsavelInativo.get(responsavelId) ?? 0) + 1);
    } else {
      const lista = porResponsavel.get(responsavelId) ?? [];
      lista.push(item);
      porResponsavel.set(responsavelId, lista);
    }
  }

  return { porResponsavel, semResponsavel, comResponsavelInativo };
}

export function emailDeLeadsFrios(
  leads: readonly LeadFrio[],
  consultaNoTeto: boolean,
): {
  titulo: string;
  chamada: string;
  fatos: { rotulo: string; valor: string }[];
} {
  const ordenados = [...leads].sort(
    (a, b) =>
      Date.parse(a.paradoDesde) - Date.parse(b.paradoDesde) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const mostrados = ordenados.slice(0, LEADS_FRIOS_NO_EMAIL);
  const resto = ordenados.length - mostrados.length;
  const piso = consultaNoTeto ? "pelo menos " : "";

  const total = `${ordenados.length} ${ordenados.length === 1 ? "lead" : "leads"}`;
  const titulo = `${consultaNoTeto ? "Pelo menos " : ""}${total} sem contato há ${DIAS_DE_LEAD_FRIO} dias ou mais`;
  const chamada =
    `Nenhum toque registrado e nenhuma mudança de etapa há ${DIAS_DE_LEAD_FRIO} dias ou mais.` +
    (resto > 0
      ? ` Abaixo, os ${mostrados.length} mais antigos; ${piso}mais ${resto} no Pipeline.`
      : "");

  return {
    titulo,
    chamada,
    fatos: mostrados.map((l) => ({
      rotulo: `Parado desde ${formatDate(l.paradoDesde)}`,
      valor: l.nome,
    })),
  };
}

export const PRIMEIROS_CONTATOS_NO_EMAIL = 10;

export interface PrimeiroContatoVencido {
  readonly id: string;
  readonly nome: string;
  readonly canal: string;
  readonly venceEm: string;
}

function quandoVenceu(venceEm: string, agora: Date): string {
  const quando = horarioCurtoSP(venceEm, agora);
  return todaySP(new Date(venceEm)) === todaySP(agora) ? `às ${quando}` : quando;
}

export function emailDePrimeiroContatoVencido(
  leads: readonly PrimeiroContatoVencido[],
  consultaNoTeto: boolean,
  agora: Date,
): {
  titulo: string;
  chamada: string;
  fatos: { rotulo: string; valor: string }[];
} {
  const ordenados = [...leads].sort(
    (a, b) =>
      Date.parse(a.venceEm) - Date.parse(b.venceEm) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const mostrados = ordenados.slice(0, PRIMEIROS_CONTATOS_NO_EMAIL);
  const resto = ordenados.length - mostrados.length;
  const piso = consultaNoTeto ? "pelo menos " : "";

  const total = `${ordenados.length} ${ordenados.length === 1 ? "lead" : "leads"}`;
  const titulo = `${consultaNoTeto ? "Pelo menos " : ""}${total} sem primeiro contato no prazo`;
  const chamada =
    "O prazo do primeiro contato do canal passou e nenhum toque foi registrado." +
    (resto > 0
      ? ` Abaixo, os ${mostrados.length} mais antigos; ${piso}mais ${resto} no Pipeline.`
      : "");

  return {
    titulo,
    chamada,
    fatos: mostrados.map((l) => ({
      rotulo: `${rotuloDaChaveDeCanal(l.canal)} · venceu ${quandoVenceu(l.venceEm, agora)}`,
      valor: l.nome,
    })),
  };
}

export const LIMIAR_DE_EVENTOS_SEMANAIS = 50;

export function ehSegundaFeira(diaSP: string): boolean {
  return new Date(`${diaSP}T12:00:00Z`).getUTCDay() === 1;
}

export function deveAvisarSeguranca(
  diaSP: string,
  totalNaSemana: number,
  limiar: number = LIMIAR_DE_EVENTOS_SEMANAIS,
): boolean {
  return ehSegundaFeira(diaSP) && totalNaSemana >= limiar;
}
