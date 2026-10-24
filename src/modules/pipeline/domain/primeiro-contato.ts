import { horarioCurtoSP } from "@/shared/lib/date";

export interface PrimeiroContato {
  readonly venceEm: string | null;
  readonly primeiroToqueEm: string | null;
}

export type SituacaoDoPrimeiroContato = "sem_selo" | "no_prazo" | "atrasado";

export function situacaoDoPrimeiroContato(
  contato: PrimeiroContato,
  agora: Date,
): SituacaoDoPrimeiroContato {
  if (contato.venceEm === null || contato.primeiroToqueEm !== null) return "sem_selo";
  const vence = Date.parse(contato.venceEm);
  if (Number.isNaN(vence)) return "sem_selo";
  return agora.getTime() > vence ? "atrasado" : "no_prazo";
}

export interface SeloDoPrimeiroContato {
  readonly texto: string;
  readonly atrasado: boolean;
}

export function seloDoPrimeiroContato(
  contato: PrimeiroContato,
  agora: Date,
): SeloDoPrimeiroContato | null {
  const situacao = situacaoDoPrimeiroContato(contato, agora);
  if (situacao === "sem_selo" || contato.venceEm === null) return null;
  const quando = horarioCurtoSP(contato.venceEm, agora);
  return situacao === "atrasado"
    ? { texto: `1º contato atrasado desde ${quando}`, atrasado: true }
    : { texto: `1º contato até ${quando}`, atrasado: false };
}

export function formatarMinutosUteis(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
