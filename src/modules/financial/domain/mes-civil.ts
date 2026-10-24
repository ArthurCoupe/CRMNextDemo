import { todaySP } from "@/shared/lib/date";

export type DataISO = string;

const ISO = /^(\d{4})-(\d{2})-\d{2}$/;

export function indiceDoMes(data: DataISO): number | null {
  const casamento = ISO.exec(data);
  if (casamento === null) return null;
  const ano = Number(casamento[1]);
  const mes = Number(casamento[2]);
  if (mes < 1 || mes > 12) return null;
  return ano * 12 + (mes - 1);
}

export function mesEAno(data: DataISO): string | null {
  const casamento = ISO.exec(data);
  if (casamento === null) return null;
  return `${casamento[2]}/${casamento[1]}`;
}

export function mesesDesde(inicio: DataISO, mesReferencia: DataISO): number | null {
  const a = indiceDoMes(inicio);
  const b = indiceDoMes(mesReferencia);
  if (a === null || b === null) return null;
  return b - a;
}

export function primeiroDiaDoMes(indice: number): DataISO {
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-01`;
}

export function hojeEmSaoPaulo(): DataISO {
  return todaySP();
}
