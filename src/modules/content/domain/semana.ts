import { DIAS_DA_SEMANA, formatDate, paraInstante, somaDias, todaySP } from "@/shared/lib/date";

export function diasDaSemana(inicio: string): readonly string[] {
  return Array.from({ length: 7 }, (_, i) => somaDias(inicio, i));
}

export function limitesDaSemana(inicio: string): { readonly de: string; readonly ate: string } {
  return { de: paraInstante(inicio, "00:00"), ate: paraInstante(somaDias(inicio, 7), "00:00") };
}

export function diaDoPost(agendadoPara: string): string {
  return todaySP(new Date(agendadoPara));
}

export function agruparPorDia<T extends { readonly agendadoPara: string }>(
  posts: readonly T[],
  inicio: string,
): ReadonlyMap<string, readonly T[]> {
  const grupos = new Map<string, T[]>(diasDaSemana(inicio).map((dia) => [dia, []]));
  const emOrdem = [...posts].sort(
    (a, b) => Date.parse(a.agendadoPara) - Date.parse(b.agendadoPara),
  );
  for (const post of emOrdem) grupos.get(diaDoPost(post.agendadoPara))?.push(post);
  return grupos;
}

export function rotuloDaSemana(inicio: string): string {
  return `${formatDate(inicio)} a ${formatDate(somaDias(inicio, 6))}`;
}

export function rotuloDoDia(dia: string): string {
  const semana = DIAS_DA_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()];
  return `${semana} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}
