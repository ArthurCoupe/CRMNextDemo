import { ehDataCivilPlausivel } from "@/shared/lib/date";

export function validarDataDoStatus(valor: string, hoje: string): string | null {
  if (valor === "") return "A data não pode ficar vazia.";
  if (!ehDataCivilPlausivel(valor)) return "Data inválida. Use um ano entre 2000 e 2100.";
  if (valor > hoje) return "A data não pode ficar no futuro.";
  return null;
}
