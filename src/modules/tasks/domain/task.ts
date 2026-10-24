import { daysOverdue, isOverdue } from "@/shared/lib/date";

export type ColunaDaTarefa = "todo" | "doing" | "review" | "done";
export type PrioridadeDaTarefa = "baixa" | "media" | "alta" | "urgente";
export type RecorrenciaDaTarefa = "nenhuma" | "semanal" | "quinzenal" | "mensal";

export interface ParticipanteDaTarefa {
  readonly id: string;
  readonly nome: string;
  readonly ativo: boolean;
}

export interface LinkDaTarefa {
  readonly id: string;
  readonly rotulo: string;
  readonly url: string;
}

export interface Tarefa {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string | null;
  readonly categoria: string;
  readonly tipo: string;
  readonly responsavelId: string | null;
  readonly responsavel: string | null;
  readonly clienteId: string | null;
  readonly cliente: string | null;
  readonly coluna: ColunaDaTarefa;
  readonly prioridade: PrioridadeDaTarefa;
  readonly prazo: string | null;
  readonly recorrencia: RecorrenciaDaTarefa;
  readonly raizRecorrente: string | null;
  readonly criadoPor: string | null;
  readonly participantes: readonly ParticipanteDaTarefa[];
  readonly links: readonly LinkDaTarefa[];
  readonly pastaDoDriveDoCliente: string | null;
}

export const LIMITE_DA_DESCRICAO = 2000;

export const ORDEM_DAS_COLUNAS: readonly ColunaDaTarefa[] = ["todo", "doing", "review", "done"];

export const ROTULO_DA_COLUNA: Readonly<Record<ColunaDaTarefa, string>> = {
  todo: "A fazer",
  doing: "Em andamento",
  review: "Em revisão",
  done: "Concluída",
};

export const ROTULO_DA_PRIORIDADE: Readonly<Record<PrioridadeDaTarefa, string>> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const ROTULO_DA_RECORRENCIA: Readonly<Record<RecorrenciaDaTarefa, string>> = {
  nenhuma: "Não se repete",
  semanal: "Toda semana",
  quinzenal: "A cada 15 dias",
  mensal: "Todo mês",
};

const PESO_DA_PRIORIDADE: Readonly<Record<PrioridadeDaTarefa, number>> = {
  urgente: 4,
  alta: 3,
  media: 2,
  baixa: 1,
};

export function tarefaVencida(tarefa: Tarefa, agora: Date = new Date()): boolean {
  if (tarefa.coluna === "done" || tarefa.prazo === null) return false;
  return isOverdue(tarefa.prazo, agora);
}

export function diasDeAtraso(tarefa: Tarefa, agora: Date = new Date()): number {
  if (!tarefaVencida(tarefa, agora)) return 0;
  return daysOverdue(tarefa.prazo as string, agora);
}

export function rotuloDeAtraso(tarefa: Tarefa, agora: Date = new Date()): string | null {
  const dias = diasDeAtraso(tarefa, agora);
  if (dias === 0) return null;
  return dias === 1 ? "vencida há 1 dia" : `vencida há ${dias} dias`;
}

export function ordenarTarefas(
  tarefas: readonly Tarefa[],
  agora: Date = new Date(),
): readonly Tarefa[] {
  return [...tarefas].sort((a, b) => {
    const atrasoA = diasDeAtraso(a, agora);
    const atrasoB = diasDeAtraso(b, agora);
    if (atrasoA !== atrasoB) return atrasoB - atrasoA;

    const pesoA = PESO_DA_PRIORIDADE[a.prioridade];
    const pesoB = PESO_DA_PRIORIDADE[b.prioridade];
    if (pesoA !== pesoB) return pesoB - pesoA;

    if (a.prazo === null && b.prazo === null) return a.titulo.localeCompare(b.titulo, "pt-BR");
    if (a.prazo === null) return 1;
    if (b.prazo === null) return -1;
    if (a.prazo !== b.prazo) return a.prazo < b.prazo ? -1 : 1;

    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

export function agruparPorColuna(
  tarefas: readonly Tarefa[],
  agora: Date = new Date(),
): Readonly<Record<ColunaDaTarefa, readonly Tarefa[]>> {
  const ordenadas = ordenarTarefas(tarefas, agora);
  return {
    todo: ordenadas.filter((t) => t.coluna === "todo"),
    doing: ordenadas.filter((t) => t.coluna === "doing"),
    review: ordenadas.filter((t) => t.coluna === "review"),
    done: ordenadas.filter((t) => t.coluna === "done"),
  };
}

export function contarVencidas(tarefas: readonly Tarefa[], agora: Date = new Date()): number {
  return tarefas.filter((t) => tarefaVencida(t, agora)).length;
}

export function ehColuna(valor: unknown): valor is ColunaDaTarefa {
  return typeof valor === "string" && (ORDEM_DAS_COLUNAS as readonly string[]).includes(valor);
}

export function ehRecorrencia(valor: string): valor is RecorrenciaDaTarefa {
  return Object.keys(ROTULO_DA_RECORRENCIA).includes(valor);
}

export function destinoDoArrasto(
  tarefas: readonly Tarefa[],
  ativoId: string | number,
  sobreId: string | number | null | undefined,
): { readonly id: string; readonly coluna: ColunaDaTarefa } | null {
  if (!ehColuna(sobreId)) return null;
  const tarefa = tarefas.find((t) => t.id === ativoId);
  if (tarefa === undefined || tarefa.coluna === sobreId) return null;
  return { id: tarefa.id, coluna: sobreId };
}
