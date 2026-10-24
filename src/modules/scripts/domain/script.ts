import type { Database } from "@/shared/types/database.types";

export type TipoDeScript = Database["public"]["Enums"]["script_kind"];
export type CanalDeScript = Database["public"]["Enums"]["script_channel"];
export type MomentoDeScript = Database["public"]["Enums"]["script_moment"];

export const CANAIS_POR_TIPO: Record<TipoDeScript, readonly CanalDeScript[]> = {
  sdr: ["whatsapp", "email", "linkedin", "cold_call"],
  closer: ["reuniao", "whatsapp", "email"],
};

export const MOMENTOS_POR_TIPO: Record<TipoDeScript, readonly MomentoDeScript[]> = {
  sdr: ["primeiro_contato", "follow_up", "quebra_objecao"],
  closer: ["abertura", "proposta", "objecao", "fechamento"],
};

const ROTULO_DO_CANAL: Record<CanalDeScript, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  linkedin: "LinkedIn",
  cold_call: "Cold call",
  reuniao: "Reunião",
};

const ROTULO_DO_MOMENTO: Record<MomentoDeScript, string> = {
  primeiro_contato: "Primeiro contato",
  follow_up: "Follow-up",
  quebra_objecao: "Quebra de objeção",
  abertura: "Abertura",
  proposta: "Proposta",
  objecao: "Objeção",
  fechamento: "Fechamento",
};

const ROTULO_DO_TIPO: Record<TipoDeScript, string> = {
  sdr: "SDR",
  closer: "Closer",
};

export function rotuloDoCanal(canal: CanalDeScript): string {
  return ROTULO_DO_CANAL[canal];
}

export function rotuloDoMomento(momento: MomentoDeScript): string {
  return ROTULO_DO_MOMENTO[momento];
}

export function rotuloDoTipo(tipo: TipoDeScript): string {
  return ROTULO_DO_TIPO[tipo];
}

export function ehTipoDeScript(valor: string): valor is TipoDeScript {
  return Object.keys(CANAIS_POR_TIPO).includes(valor);
}

export function combinacaoValida(
  tipo: TipoDeScript,
  canal: CanalDeScript,
  momento: MomentoDeScript,
): boolean {
  return CANAIS_POR_TIPO[tipo].includes(canal) && MOMENTOS_POR_TIPO[tipo].includes(momento);
}
