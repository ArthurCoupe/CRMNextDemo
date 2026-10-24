import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { supabaseV2 } from "@/integrations/supabase/client.v2";

import {
  problemaNasFrentesDoCombo,
  type FrenteDeServico,
  type LinhaDeNegocio,
  type TipoDeContrato,
} from "../domain/contract";

const LIMITE = 200;

export interface ProdutoDoCatalogoCompleto {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly frente: FrenteDeServico;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly tipo: TipoDeContrato;
  readonly preco: number;
  readonly frentesDoCombo: readonly FrenteDeServico[] | null;
  readonly ativo: boolean;
  readonly ordem: number;
}

export interface CatalogoLido {
  readonly produtos: readonly ProdutoDoCatalogoCompleto[];
  readonly truncado: boolean;
}

export async function listarCatalogoCompleto(): Promise<CatalogoLido> {
  const { data, error } = await supabaseV2
    .from("products")
    .select(
      "id, name, description, front, business_unit, contract_type, price, combo_fronts, active, sort_order",
    )
    .order("sort_order")
    .order("name")
    .limit(LIMITE);

  if (error) throw erroDoBanco(error);

  const linhas = data ?? [];
  return {
    produtos: linhas.map((p) => ({
      id: p.id,
      nome: p.name,
      descricao: p.description,
      frente: p.front,
      linhaDeNegocio: p.business_unit,
      tipo: p.contract_type,
      preco: p.price,
      frentesDoCombo: p.combo_fronts,
      ativo: p.active,
      ordem: p.sort_order,
    })),
    truncado: linhas.length >= LIMITE,
  };
}

export interface EntradaDeProduto {
  readonly id: string | null;
  readonly nome: string;
  readonly descricao: string | null;
  readonly frente: FrenteDeServico;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly tipo: TipoDeContrato;
  readonly preco: number;
  readonly ordem?: number;
  readonly frentesDoCombo?: readonly FrenteDeServico[];
}

async function proximaOrdem(): Promise<number> {
  const { data, error } = await supabaseV2
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw erroDoBanco(error);
  return (data?.[0]?.sort_order ?? 0) + 1;
}

export async function salvarProduto(entrada: EntradaDeProduto): Promise<void> {
  const linha = {
    name: entrada.nome,
    description: entrada.descricao,
    front: entrada.frente,
    business_unit: entrada.linhaDeNegocio,
    contract_type: entrada.tipo,
    price: entrada.preco,
  };

  if (entrada.id === null) {
    const { error } = await supabaseV2
      .from("products")
      .insert({ ...linha, sort_order: await proximaOrdem() });
    if (error) throw erroDoBanco(error);
    return;
  }

  if (entrada.frentesDoCombo !== undefined) {
    const problema = problemaNasFrentesDoCombo(entrada.frentesDoCombo, entrada.linhaDeNegocio);
    if (problema !== null) throw new Error(problema);
  }

  const { data, error } = await supabaseV2
    .from("products")
    .update({
      ...linha,
      ...(entrada.ordem === undefined ? {} : { sort_order: entrada.ordem }),
      ...(entrada.frentesDoCombo === undefined
        ? {}
        : { combo_fronts: [...entrada.frentesDoCombo] }),
    })
    .eq("id", entrada.id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita produtos.");
  }
}

export async function definirSituacaoDoProduto(id: string, ativo: boolean): Promise<void> {
  const { data, error } = await supabaseV2
    .from("products")
    .update({ active: ativo })
    .eq("id", id)
    .select("id");
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Nada foi alterado: só o owner edita produtos.");
  }
}

export async function apagarProduto(id: string): Promise<void> {
  const { data, error } = await supabaseV2.from("products").delete().eq("id", id).select("id");
  if (error?.code === "23503") {
    throw erroDoBanco({
      code: error.code,
      details: error.details,
      hint: error.hint,
      message:
        "Este produto já foi usado em contrato e não pode ser apagado. Desative em vez de apagar.",
    });
  }
  if (error) throw erroDoBanco(error);
  if ((data ?? []).length === 0) {
    throw new Error("Só o owner apaga produto.");
  }
}
