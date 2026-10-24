export type NivelDeGarantia = string | null;

export function precisaDeSegundoFator(atual: NivelDeGarantia, exigido: NivelDeGarantia): boolean {
  return exigido === "aal2" && atual !== "aal2";
}

export function codigoTotpValido(codigo: string): boolean {
  return /^[0-9]{6}$/.test(codigo.replace(/\s+/g, ""));
}

export function normalizarCodigoTotp(codigo: string): string {
  return codigo.replace(/\s+/g, "");
}

export type SituacaoDoSegundoFator = "sem-fator" | "falta-codigo" | "ok";

export function situacaoDoSegundoFator(
  temFatorVerificado: boolean,
  atual: NivelDeGarantia,
  exigido: NivelDeGarantia,
): SituacaoDoSegundoFator {
  if (!temFatorVerificado) return "sem-fator";
  return precisaDeSegundoFator(atual, exigido) ? "falta-codigo" : "ok";
}
