import type { MeioDePagamento, TipoDeContrato } from "@/modules/contracts/domain/contract";

export interface ConfiguracaoFiscal {
  readonly aliquotaPct: number;
  readonly provisoria: boolean;
  readonly fonte: string | null;
}

export interface TaxasDoMeio {
  readonly meio: MeioDePagamento;
  readonly taxaFixa: number;
  readonly percentualVariavel: number;
  readonly parcelavel: boolean;
  readonly liquidacao: string | null;
}

export type TabelaDeParcelamento = ReadonlyMap<number, number>;

export interface BaseDoLiquido {
  readonly tipo: TipoDeContrato;
  readonly valorMensal: number | null;
  readonly valorTotal: number | null;
  readonly mesesDeCobranca: number | null;
  readonly meioDePagamento: MeioDePagamento;
  readonly parcelas: number | null;
}

export interface Liquido {
  readonly bruto: number;
  readonly imposto: number;
  readonly taxaVariavel: number;
  readonly taxaFixa: number;
  readonly liquido: number;
  readonly percentualVariavel: number;
  readonly percentualDeDeducao: number;
}

export function interpretarPercentual(texto: string): number | null {
  const limpo = texto.trim();
  if (limpo === "") return null;
  const numero = Number(limpo.replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return null;
  return numero;
}

export function parcelasParaGravar(meio: MeioDePagamento, parcelas: number | null): number | null {
  return meio === "credito" ? parcelas : null;
}

function emCentavos(valor: number): number {
  return Math.round(valor * 100);
}

function percentualDeCentavos(centavos: number, pct: number): number {
  const centesimosDePct = Math.round(pct * 100);
  const numerador = centavos * centesimosDePct;
  const quociente = Math.floor(numerador / 10000);
  const resto = numerador - quociente * 10000;
  return resto * 2 >= 10000 ? quociente + 1 : quociente;
}

function emReais(centavos: number): number {
  return centavos / 100;
}

export function brutoDoMes(base: BaseDoLiquido): number | null {
  if (base.tipo === "mrr") {
    if (base.valorMensal === null) return null;
    return emReais(emCentavos(base.valorMensal));
  }
  if (base.valorTotal === null) return null;
  if (base.mesesDeCobranca === null || base.mesesDeCobranca <= 0) return null;
  return emReais(Math.round(emCentavos(base.valorTotal) / base.mesesDeCobranca));
}

export function percentualVariavel(
  base: BaseDoLiquido,
  taxas: TaxasDoMeio,
  tabela: TabelaDeParcelamento,
): number | null {
  if (base.meioDePagamento !== "credito") return taxas.percentualVariavel;
  const parcelas = base.parcelas ?? 1;
  return tabela.get(parcelas) ?? null;
}

export function calcularLiquido(
  base: BaseDoLiquido,
  config: ConfiguracaoFiscal,
  taxas: TaxasDoMeio,
  tabela: TabelaDeParcelamento,
): Liquido | null {
  const bruto = brutoDoMes(base);
  if (bruto === null) return null;

  const pctVariavel = percentualVariavel(base, taxas, tabela);
  if (pctVariavel === null) return null;

  const brutoCentavos = emCentavos(bruto);
  const imposto = emReais(percentualDeCentavos(brutoCentavos, config.aliquotaPct));
  const taxaVariavel = emReais(percentualDeCentavos(brutoCentavos, pctVariavel));
  const taxaFixa = emReais(emCentavos(taxas.taxaFixa));

  const liquido = emReais(
    brutoCentavos - emCentavos(imposto) - emCentavos(taxaVariavel) - emCentavos(taxaFixa),
  );

  return {
    bruto,
    imposto,
    taxaVariavel,
    taxaFixa,
    liquido,
    percentualVariavel: pctVariavel,
    percentualDeDeducao:
      brutoCentavos === 0
        ? 0
        : emReais(Math.round(((brutoCentavos - emCentavos(liquido)) * 10000) / brutoCentavos)),
  };
}
