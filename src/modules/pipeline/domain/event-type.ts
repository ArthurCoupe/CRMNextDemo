import type { Database } from "@/shared/types/database.types";

export type TipoDeEvento = Database["public"]["Enums"]["opportunity_event_type"];

interface InfoDoTipo {
  readonly rotulo: string;
  readonly naLinhaDoTempo: string;
}

const INFO: Record<TipoDeEvento, InfoDoTipo> = {
  stage_change: { rotulo: "Mudança de etapa", naLinhaDoTempo: "moveu de etapa" },
  note: { rotulo: "Nota", naLinhaDoTempo: "anotou" },
  call: { rotulo: "Ligação", naLinhaDoTempo: "ligou" },
  meeting: { rotulo: "Reunião", naLinhaDoTempo: "reuniu-se" },
  proposal_sent: { rotulo: "Proposta enviada", naLinhaDoTempo: "enviou proposta" },
  whatsapp: { rotulo: "WhatsApp", naLinhaDoTempo: "mandou WhatsApp" },
};

export const TIPOS_DE_EVENTO: readonly TipoDeEvento[] = [
  "stage_change",
  "note",
  "call",
  "meeting",
  "proposal_sent",
  "whatsapp",
];

export const TIPOS_REGISTRAVEIS: readonly TipoDeEvento[] = TIPOS_DE_EVENTO.filter(
  (tipo) => tipo !== "stage_change",
);

export const TIPOS_DE_TOQUE: readonly TipoDeEvento[] = TIPOS_DE_EVENTO.filter(
  (tipo) => tipo !== "stage_change",
);

export function ehToque(tipo: TipoDeEvento): boolean {
  return tipo !== "stage_change";
}

export function rotuloDoTipoDeEvento(tipo: TipoDeEvento): string {
  return INFO[tipo].rotulo;
}

export function verboDoTipoDeEvento(tipo: TipoDeEvento): string {
  return INFO[tipo].naLinhaDoTempo;
}
