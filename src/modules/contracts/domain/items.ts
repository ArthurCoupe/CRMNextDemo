import { frenteLabel, type FrenteDeServico, type ItemDeContrato } from "./contract";

export interface FrenteComPreco {
  readonly frente: FrenteDeServico;
  readonly precoAvulso: number;
  readonly produtoId?: string | null;
}

function paraCentavos(reais: number): number {
  return Math.round(reais * 100);
}

function paraReais(centavos: number): number {
  return centavos / 100;
}

export function ratearCombo(
  frentes: readonly FrenteComPreco[],
  valorDoContrato: number,
): ItemDeContrato[] {
  if (frentes.length === 0) {
    throw new Error("Rateio exige ao menos uma frente.");
  }

  const somaDosPrecos = frentes.reduce((soma, f) => soma + f.precoAvulso, 0);
  if (somaDosPrecos <= 0) {
    throw new Error("Rateio exige preço de tabela maior que zero em ao menos uma frente.");
  }

  const totalEmCentavos = paraCentavos(valorDoContrato);

  const centavosPorFrente = frentes.map((f) =>
    Math.round((f.precoAvulso / somaDosPrecos) * totalEmCentavos),
  );

  const residuo = totalEmCentavos - centavosPorFrente.reduce((soma, c) => soma + c, 0);

  let indiceDoMaior = 0;
  for (let i = 1; i < frentes.length; i++) {
    if (frentes[i]!.precoAvulso > frentes[indiceDoMaior]!.precoAvulso) {
      indiceDoMaior = i;
    }
  }
  centavosPorFrente[indiceDoMaior] = centavosPorFrente[indiceDoMaior]! + residuo;

  return frentes.map((f, i) => ({
    frente: f.frente,
    produtoId: f.produtoId ?? null,
    valor: paraReais(centavosPorFrente[i]!),
  }));
}

export function somarItens(itens: readonly ItemDeContrato[]): number {
  return paraReais(itens.reduce((soma, i) => soma + paraCentavos(i.valor), 0));
}

export function restanteAAlocar(itens: readonly ItemDeContrato[], valorDoContrato: number): number {
  return paraReais(paraCentavos(valorDoContrato) - paraCentavos(somarItens(itens)));
}

export function somaFecha(itens: readonly ItemDeContrato[], valorDoContrato: number): boolean {
  return restanteAAlocar(itens, valorDoContrato) === 0;
}

export function mensagemDeFrenteRepetida(itens: readonly ItemDeContrato[]): string {
  const vistas = new Set<FrenteDeServico>();

  for (const item of itens) {
    if (vistas.has(item.frente)) {
      return (
        `A frente ${frenteLabel(item.frente)} aparece em duas linhas deste contrato. ` +
        `Junte os dois valores numa linha só, ou troque uma delas por outra frente.`
      );
    }
    vistas.add(item.frente);
  }

  return (
    `Duas linhas deste contrato usam a mesma frente. ` +
    `Junte os dois valores numa linha só, ou troque uma delas por outra frente.`
  );
}

export interface ProdutoDecomponivel {
  readonly id: string;
  readonly frente: FrenteDeServico;
  readonly preco: number;
  readonly frentesDoCombo: readonly FrenteDeServico[] | null;
}

function ehCombo(produto: ProdutoDecomponivel): boolean {
  return produto.frentesDoCombo !== null && produto.frentesDoCombo.length > 0;
}

export function decomporProduto(
  produto: ProdutoDecomponivel,
  catalogo: readonly ProdutoDecomponivel[],
): { itens: ItemDeContrato[]; semPreco: FrenteDeServico[] } {
  const frentesDoCombo = produto.frentesDoCombo;
  if (frentesDoCombo === null || frentesDoCombo.length === 0) {
    return {
      itens: [{ frente: produto.frente, produtoId: produto.id, valor: produto.preco }],
      semPreco: [],
    };
  }

  const comPreco: FrenteComPreco[] = [];
  const semPreco: FrenteDeServico[] = [];
  for (const frente of frentesDoCombo) {
    const preco = catalogo.find((p) => p.frente === frente && !ehCombo(p))?.preco;
    if (preco === undefined) semPreco.push(frente);
    else comPreco.push({ frente, precoAvulso: preco });
  }
  if (semPreco.length > 0) {
    return {
      itens: frentesDoCombo.map((frente) => ({ frente, produtoId: null, valor: 0 })),
      semPreco,
    };
  }
  return { itens: ratearCombo(comPreco, produto.preco), semPreco: [] };
}

export function avisoDeFrenteSemPreco(frentes: readonly FrenteDeServico[]): string {
  const nomes = frentes.map(frenteLabel).join(", ");
  return frentes.length === 1
    ? `Frente ${nomes} sem preço de tabela ativo. Ative o produto no catálogo ou informe a decomposição.`
    : `Frentes ${nomes} sem preço de tabela ativo. Ative os produtos no catálogo ou informe a decomposição.`;
}
