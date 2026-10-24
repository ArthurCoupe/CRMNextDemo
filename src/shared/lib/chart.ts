import type { Tema } from "@/shared/ui/tema";

export const CHART_COLORS_ESCURO: readonly string[] = [
  "#2e8fff",
  "#3ddc91",
  "#ffc94a",
  "#ff5f6d",
  "#a78bfa",
];

export const CHART_COLORS_CLARO: readonly string[] = [
  "#0074d9",
  "#0e9a5f",
  "#b97d0a",
  "#d6303f",
  "#7c5cd6",
];

export function paletaDoTema(tema: Tema): readonly string[] {
  return tema === "light" ? CHART_COLORS_CLARO : CHART_COLORS_ESCURO;
}

export function chartColor(indice: number, tema: Tema): string {
  const paleta = paletaDoTema(tema);
  return paleta[((indice % paleta.length) + paleta.length) % paleta.length];
}
