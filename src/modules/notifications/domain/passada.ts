export const CHAVE_DA_PASSADA = "ultima_passada_de_avisos";

export interface PlacarDaPassada {
  readonly enviados: number;
  readonly duplicados: number;
  readonly falhas: number;
}

export interface UltimaPassada {
  readonly dia: string;
  readonly ok: boolean;
  readonly terminouEm: string;
  readonly erro: string | null;
  readonly contadores: Readonly<Record<string, PlacarDaPassada>>;
  readonly problemas: readonly string[];
}

export function okDaPassada(problemas: readonly string[]): boolean {
  return problemas.every((p) => !p.startsWith("falha:"));
}

export function montarValorDaPassada(passada: UltimaPassada): Record<string, unknown> {
  return {
    dia: passada.dia,
    ok: passada.ok,
    terminou_em: passada.terminouEm,
    erro: passada.erro,
    contadores: passada.contadores,
    problemas: passada.problemas,
  };
}

function interpretarPlacar(bruto: unknown): PlacarDaPassada | null {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return null;
  const r = bruto as Record<string, unknown>;
  if (
    typeof r.enviados !== "number" ||
    typeof r.duplicados !== "number" ||
    typeof r.falhas !== "number"
  ) {
    return null;
  }
  return { enviados: r.enviados, duplicados: r.duplicados, falhas: r.falhas };
}

export function interpretarPassada(valor: unknown): UltimaPassada | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const r = valor as Record<string, unknown>;

  if (typeof r.dia !== "string") return null;
  if (typeof r.ok !== "boolean") return null;
  if (typeof r.terminou_em !== "string") return null;
  if (r.erro !== null && typeof r.erro !== "string") return null;
  if (typeof r.contadores !== "object" || r.contadores === null || Array.isArray(r.contadores)) {
    return null;
  }
  if (!Array.isArray(r.problemas)) return null;

  const contadores: Record<string, PlacarDaPassada> = {};
  for (const [chave, bruto] of Object.entries(r.contadores as Record<string, unknown>)) {
    const placar = interpretarPlacar(bruto);
    if (placar === null) return null;
    contadores[chave] = placar;
  }

  const problemas: string[] = [];
  for (const item of r.problemas as readonly unknown[]) {
    if (typeof item !== "string") return null;
    problemas.push(item);
  }

  return {
    dia: r.dia,
    ok: r.ok,
    terminouEm: r.terminou_em,
    erro: r.erro,
    contadores,
    problemas,
  };
}
