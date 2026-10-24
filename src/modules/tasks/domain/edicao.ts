import { ehDataCivilPlausivel } from "@/shared/lib/date";

import {
  LIMITE_DA_DESCRICAO,
  type PrioridadeDaTarefa,
  type RecorrenciaDaTarefa,
  type Tarefa,
} from "./task";

export interface RascunhoDaTarefa {
  readonly titulo: string;
  readonly descricao: string;
  readonly categoria: string;
  readonly tipo: string;
  readonly prioridade: PrioridadeDaTarefa;
  readonly prazo: string;
  readonly clienteId: string;
  readonly responsavelId: string;
  readonly recorrencia: RecorrenciaDaTarefa;
}

export interface AlteracaoDaTarefa {
  readonly titulo?: string;
  readonly descricao?: string | null;
  readonly categoria?: string;
  readonly tipo?: string;
  readonly prioridade?: PrioridadeDaTarefa;
  readonly prazo?: string | null;
  readonly clienteId?: string | null;
  readonly responsavelId?: string | null;
  readonly recorrencia?: RecorrenciaDaTarefa;
}

export type ResultadoDaEdicao =
  | { readonly ok: true; readonly alteracao: AlteracaoDaTarefa }
  | { readonly ok: false; readonly erro: string };

export function rascunhoDe(t: Tarefa): RascunhoDaTarefa {
  return {
    titulo: t.titulo,
    descricao: t.descricao ?? "",
    categoria: t.categoria,
    tipo: t.tipo,
    prioridade: t.prioridade,
    prazo: t.prazo ?? "",
    clienteId: t.clienteId ?? "",
    responsavelId: t.responsavelId ?? "",
    recorrencia: t.recorrencia,
  };
}

const nuloSeVazio = (v: string): string | null => (v.trim() === "" ? null : v.trim());

export function validarEdicao(inicial: RascunhoDaTarefa, r: RascunhoDaTarefa): ResultadoDaEdicao {
  const titulo = r.titulo.trim();
  if (titulo === "") return { ok: false, erro: "O título da tarefa não pode ficar em branco." };
  if (r.tipo === "") return { ok: false, erro: "Escolha o tipo da tarefa." };
  const descricao = r.descricao.trim();
  const descricaoMudou = descricao !== inicial.descricao.trim();
  if (descricaoMudou && descricao.length > LIMITE_DA_DESCRICAO) {
    return {
      ok: false,
      erro: `Descrição com ${descricao.length} caracteres: o limite é ${LIMITE_DA_DESCRICAO}. Encurte para gravar.`,
    };
  }
  const prazoMudou = r.prazo !== inicial.prazo;
  if (prazoMudou && r.prazo !== "" && !ehDataCivilPlausivel(r.prazo)) {
    return { ok: false, erro: "Prazo inválido. Use um ano entre 2000 e 2100." };
  }

  const alteracao: { -readonly [K in keyof AlteracaoDaTarefa]: AlteracaoDaTarefa[K] } = {};
  if (titulo !== inicial.titulo.trim()) alteracao.titulo = titulo;
  if (descricaoMudou) alteracao.descricao = nuloSeVazio(descricao);
  if (r.categoria !== inicial.categoria || r.tipo !== inicial.tipo) {
    alteracao.categoria = r.categoria;
    alteracao.tipo = r.tipo;
  }
  if (r.prioridade !== inicial.prioridade) alteracao.prioridade = r.prioridade;
  if (prazoMudou) alteracao.prazo = nuloSeVazio(r.prazo);
  if (r.clienteId !== inicial.clienteId) alteracao.clienteId = nuloSeVazio(r.clienteId);
  if (r.responsavelId !== inicial.responsavelId) {
    alteracao.responsavelId = nuloSeVazio(r.responsavelId);
  }
  if (r.recorrencia !== inicial.recorrencia) alteracao.recorrencia = r.recorrencia;
  return { ok: true, alteracao };
}
