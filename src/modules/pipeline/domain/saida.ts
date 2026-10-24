import type { TipoDeEstagio } from "./pipeline";

export function motivoExigidoPor(tipo: TipoDeEstagio): "descarte" | "perda" | null {
  if (tipo === "descartado") return "descarte";
  if (tipo === "perdido") return "perda";
  return null;
}

export interface MotivoDeSaidaEscolhido {
  readonly tipo: "descarte" | "perda";
  readonly motivoId: string;
  readonly obs: string | null;
}
