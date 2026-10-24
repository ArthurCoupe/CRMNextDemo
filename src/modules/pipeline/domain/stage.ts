import type { Database } from "@/shared/types/database.types";

export type Estagio = Database["public"]["Enums"]["opportunity_stage"];

export const ORDEM_DOS_ESTAGIOS: readonly Estagio[] = [
  "prospeccao",
  "abordagem",
  "qualificacao",
  "r1",
  "r2",
  "fechado",
  "perdido",
  "descartado",
];

interface InfoDoEstagio {
  readonly rotulo: string;
  readonly significado: string;
  readonly corDoPonto: string;
}

const INFO: Record<Estagio, InfoDoEstagio> = {
  prospeccao: {
    rotulo: "Prospecção",
    significado: "Lista de empresas com o perfil atendido",
    corDoPonto: "#aaaaaa",
  },
  abordagem: {
    rotulo: "Abordagem",
    significado: "Primeiro contato feito",
    corDoPonto: "#38bdf8",
  },
  qualificacao: {
    rotulo: "Qualificação",
    significado: "Confirmar orçamento, decisão e prazo",
    corDoPonto: "#38bdf8",
  },
  r1: {
    rotulo: "R1 · Diagnóstico",
    significado: "Reunião para entender o problema",
    corDoPonto: "#a78bfa",
  },
  r2: {
    rotulo: "R2 · Proposta",
    significado: "Escopo, prazo e preço apresentados",
    corDoPonto: "#f59e0b",
  },
  fechado: {
    rotulo: "Fechado",
    significado: "Contrato assinado",
    corDoPonto: "#34d399",
  },
  perdido: {
    rotulo: "Perdido",
    significado: "Negociação encerrada sem venda",
    corDoPonto: "#f87171",
  },
  descartado: {
    rotulo: "Descartado",
    significado: "Contato inválido ou fora do perfil",
    corDoPonto: "#234a73",
  },
};

export function rotuloDoEstagio(estagio: Estagio): string {
  return INFO[estagio].rotulo;
}

export function significadoDoEstagio(estagio: Estagio): string {
  return INFO[estagio].significado;
}

export function corDoPontoDoEstagio(estagio: Estagio): string {
  return INFO[estagio].corDoPonto;
}

export function entraNoFunil(estagio: Estagio): boolean {
  return estagio !== "descartado";
}

export function taxaDeConversao(contagens: Partial<Record<Estagio, number>>): number | null {
  const universo = ORDEM_DOS_ESTAGIOS.filter(entraNoFunil).reduce(
    (soma, estagio) => soma + (contagens[estagio] ?? 0),
    0,
  );
  if (universo === 0) return null;
  return (contagens.fechado ?? 0) / universo;
}

export function followUpVencido(
  estagio: Estagio,
  proximoFollowUp: string | null,
  estaVencido: (data: string) => boolean,
): boolean {
  if (proximoFollowUp === null) return false;
  if (estagio === "fechado" || estagio === "perdido" || estagio === "descartado") return false;
  return estaVencido(proximoFollowUp);
}
