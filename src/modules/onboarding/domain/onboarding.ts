export type EstadoDaEtapa = "concluida" | "liberada" | "bloqueada";

export interface ItemDaJornada {
  readonly id: string;
  readonly ordem: number;
  readonly titulo: string;
  readonly papel: string;
  readonly prazoEmDias: number;
  readonly tarefaId: string | null;
  readonly concluidoEm: string | null;
}

export interface EtapaDaJornada {
  readonly id: string;
  readonly ordem: number;
  readonly nome: string;
  readonly descricao: string;
  readonly periodo: string;
  readonly responsavel: string;
  readonly liberadaEm: string | null;
  readonly itens: readonly ItemDaJornada[];
}

export interface EdicaoDoItem {
  readonly titulo: string;
  readonly prazoEmDias: number;
  readonly papel: string;
}

export interface EdicaoDaEtapa {
  readonly descricao: string;
  readonly responsavel: string;
}

export interface Jornada {
  readonly id: string;
  readonly clienteId: string;
  readonly cliente: string;
  readonly versaoDoMetodo: number;
  readonly iniciadaEm: string;
  readonly concluidaEm: string | null;
  readonly etapas: readonly EtapaDaJornada[];
}

export function estadoDaEtapa(etapa: EtapaDaJornada): EstadoDaEtapa {
  if (etapa.liberadaEm === null) return "bloqueada";
  if (etapa.itens.length > 0 && etapa.itens.every((i) => i.concluidoEm !== null)) {
    return "concluida";
  }
  return "liberada";
}

export function concluidosNaEtapa(etapa: EtapaDaJornada): number {
  return etapa.itens.filter((i) => i.concluidoEm !== null).length;
}

export function progressoDaJornada(jornada: Jornada): { concluidas: number; total: number } {
  return {
    concluidas: jornada.etapas.filter((e) => estadoDaEtapa(e) === "concluida").length,
    total: jornada.etapas.length,
  };
}

export function etapaCorrente(jornada: Jornada): EtapaDaJornada | null {
  return jornada.etapas.find((e) => estadoDaEtapa(e) !== "concluida") ?? null;
}

export function proximaLiberavel(jornada: Jornada): EtapaDaJornada | null {
  const ordenadas = [...jornada.etapas].sort((a, b) => a.ordem - b.ordem);
  for (let i = 0; i < ordenadas.length; i++) {
    const etapa = ordenadas[i];
    if (etapa.liberadaEm !== null) continue;
    const anterior = i === 0 ? null : ordenadas[i - 1];
    if (anterior === null || estadoDaEtapa(anterior) === "concluida") return etapa;
    return null;
  }
  return null;
}

export function primeiraBloqueada(jornada: Jornada): EtapaDaJornada | null {
  return (
    [...jornada.etapas].sort((a, b) => a.ordem - b.ordem).find((e) => e.liberadaEm === null) ?? null
  );
}

export function pendentesAntesDe(jornada: Jornada, etapa: EtapaDaJornada): number {
  const anterior = jornada.etapas.find((e) => e.ordem === etapa.ordem - 1);
  if (anterior === undefined) return 0;
  if (anterior.liberadaEm === null) return anterior.itens.length;
  return anterior.itens.filter((i) => i.concluidoEm === null).length;
}

export function papeisExigidos(etapa: EtapaDaJornada): readonly string[] {
  return [...new Set(etapa.itens.map((i) => i.papel))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function papeisSemPessoa(
  etapa: EtapaDaJornada,
  comPessoa: readonly string[],
): readonly string[] {
  return papeisExigidos(etapa).filter((p) => !comPessoa.includes(p));
}

interface PapelComPessoa {
  readonly papel: string;
  readonly pessoaId: string | null;
  readonly pessoaInativa: boolean;
}

export function papeisComPessoaAtiva(papeis: readonly PapelComPessoa[]): readonly string[] {
  return papeis.filter((p) => p.pessoaId !== null && !p.pessoaInativa).map((p) => p.papel);
}

export function papeisComPessoaDesativada(papeis: readonly PapelComPessoa[]): readonly string[] {
  return papeis.filter((p) => p.pessoaId !== null && p.pessoaInativa).map((p) => p.papel);
}
