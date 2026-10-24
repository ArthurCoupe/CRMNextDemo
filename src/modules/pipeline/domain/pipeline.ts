import type { Database } from "@/shared/types/database.types";

import { ORDEM_DOS_ESTAGIOS } from "./stage";

export type TipoDeEstagio = Database["public"]["Enums"]["opportunity_stage"];

export function ehTipoDeEstagio(valor: string): valor is TipoDeEstagio {
  const tipos: readonly string[] = ORDEM_DOS_ESTAGIOS;
  return tipos.includes(valor);
}

export const PIPELINE_PADRAO = "10000000-0000-4000-8000-000000000001";

export interface Pipeline {
  readonly id: string;
  readonly nome: string;
  readonly ordem: number;
  readonly ativo: boolean;
}

export interface EstagioDoPipeline {
  readonly id: string;
  readonly pipelineId: string;
  readonly nome: string;
  readonly ordem: number;
  readonly tipo: TipoDeEstagio;
}

export interface MotivoDeSaida {
  readonly id: string;
  readonly pipelineId: string;
  readonly tipo: "perda" | "descarte";
  readonly rotulo: string;
  readonly ordem: number;
  readonly ativo: boolean;
}

export const TIPOS_TERMINAIS: readonly TipoDeEstagio[] = ["fechado", "perdido", "descartado"];

export function ehTipoTerminal(tipo: TipoDeEstagio): boolean {
  return TIPOS_TERMINAIS.includes(tipo);
}

export function ordenarEstagios(
  estagios: readonly EstagioDoPipeline[],
): readonly EstagioDoPipeline[] {
  return [...estagios].sort((a, b) => a.ordem - b.ordem);
}

export function estagioCanonico(
  estagios: readonly EstagioDoPipeline[],
  tipo: TipoDeEstagio,
): EstagioDoPipeline | null {
  const ordenados = ordenarEstagios(estagios);
  return (
    ordenados.find((e) => e.tipo === tipo) ?? ordenados.find((e) => !ehTipoTerminal(e.tipo)) ?? null
  );
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase();
}

function temRepetido(textos: readonly string[]): boolean {
  return new Set(textos).size !== textos.length;
}

export function problemasDosEstagios(estagios: readonly EstagioDoPipeline[]): readonly string[] {
  const problemas: string[] = [];
  for (const tipo of TIPOS_TERMINAIS) {
    const quantos = estagios.filter((e) => e.tipo === tipo).length;
    if (quantos === 0) problemas.push(`Falta um estágio do tipo ${tipo}.`);
    if (quantos > 1) problemas.push(`Só pode haver um estágio do tipo ${tipo}.`);
  }
  if (!estagios.some((e) => !ehTipoTerminal(e.tipo))) {
    problemas.push("Falta pelo menos um estágio aberto.");
  }
  const nomes = estagios.map((e) => normalizar(e.nome));
  if (nomes.some((n) => n === "")) problemas.push("Estágio sem nome.");
  if (temRepetido(nomes)) problemas.push("Dois estágios com o mesmo nome.");
  return problemas;
}

export function problemasDosMotivos(motivos: readonly MotivoDeSaida[]): readonly string[] {
  const problemas: string[] = [];
  if (motivos.some((m) => normalizar(m.rotulo) === "")) problemas.push("Motivo sem rótulo.");
  for (const tipo of ["perda", "descarte"] as const) {
    const doTipo = motivos.filter((m) => m.tipo === tipo);
    if (temRepetido(doTipo.map((m) => normalizar(m.rotulo)))) {
      problemas.push(`Dois motivos de ${tipo} com o mesmo rótulo.`);
    }
    if (!doTipo.some((m) => m.ativo)) {
      problemas.push(`Falta pelo menos um motivo ativo de ${tipo}.`);
    }
  }
  return problemas;
}
