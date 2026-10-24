export type EstadoDaConsulta = "carregando" | "erro" | "pronto";

export function estadoDaConsulta(query: {
  readonly isError: boolean;
  readonly isPending: boolean;
}): EstadoDaConsulta {
  if (query.isError) return "erro";
  if (query.isPending) return "carregando";
  return "pronto";
}

export function piorEstado(...estados: readonly EstadoDaConsulta[]): EstadoDaConsulta {
  if (estados.includes("erro")) return "erro";
  if (estados.includes("carregando")) return "carregando";
  return "pronto";
}
