import {
  linhaDeNegocioLabel,
  type ContratoInicial,
  type FrenteDeServico,
  type ItemDeContrato,
  type LinhaDeNegocio,
  type MeioDePagamento,
  type TipoDeContrato,
} from "@/modules/contracts/domain/contract";
import { decomporProduto, type ProdutoDecomponivel } from "@/modules/contracts/domain/items";

export interface ItemDaProposta {
  readonly id: string;
  readonly produtoId: string | null;
  readonly nome: string;
  readonly descricao: string | null;
  readonly frente: FrenteDeServico;
  readonly frentesDoCombo: readonly FrenteDeServico[] | null;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly tipo: TipoDeContrato;
  readonly precoCatalogo: number;
  readonly valor: number;
  readonly ordem: number;
  readonly contratoId: string | null;
}

export interface GrupoDeContrato {
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly valor: number;
  readonly itens: readonly ItemDeContrato[];
  readonly frentesSemPreco: readonly FrenteDeServico[];
}

export interface CondicoesDaProposta {
  readonly formaPagamento: MeioDePagamento;
  readonly parcelasProjeto: number | null;
  readonly fidelidadeMeses: number | null;
  readonly prazoEntregaDias: number | null;
}

export const ROTULO_DA_FORMA_DE_PAGAMENTO: Readonly<Record<MeioDePagamento, string>> = {
  transferencia: "Transferência",
  pix: "Pix",
  credito: "Cartão de crédito",
};

const ORDEM: ReadonlyArray<readonly [LinhaDeNegocio, TipoDeContrato]> = [
  ["demanda", "mrr"],
  ["demanda", "tcv"],
  ["sistemas", "mrr"],
  ["sistemas", "tcv"],
];

const centavos = (reais: number) => Math.round(reais * 100);

function juntarPorFrente(partes: readonly ItemDeContrato[]): ItemDeContrato[] {
  const porFrente = new Map<FrenteDeServico, { centavos: number; produtos: Set<string | null> }>();
  for (const parte of partes) {
    const atual = porFrente.get(parte.frente) ?? {
      centavos: 0,
      produtos: new Set<string | null>(),
    };
    atual.centavos += centavos(parte.valor);
    atual.produtos.add(parte.produtoId ?? null);
    porFrente.set(parte.frente, atual);
  }
  return [...porFrente].map(([frente, { centavos: c, produtos }]) => ({
    frente,
    produtoId: produtos.size === 1 ? ([...produtos][0] ?? null) : null,
    valor: c / 100,
  }));
}

export function agruparParaContratos(
  itens: readonly ItemDaProposta[],
  catalogo: readonly ProdutoDecomponivel[],
): GrupoDeContrato[] {
  const pendentes = itens.filter((i) => i.contratoId === null);
  const grupos: GrupoDeContrato[] = [];

  for (const [linha, tipo] of ORDEM) {
    const doGrupo = pendentes.filter((i) => i.linhaDeNegocio === linha && i.tipo === tipo);
    if (doGrupo.length === 0) continue;

    const partes: ItemDeContrato[] = [];
    const semPreco = new Set<FrenteDeServico>();
    for (const i of doGrupo) {
      if (i.frentesDoCombo === null || i.frentesDoCombo.length === 0) {
        partes.push({ frente: i.frente, produtoId: i.produtoId, valor: i.valor });
        continue;
      }
      const precos = i.frentesDoCombo.map(
        (f) =>
          catalogo.find(
            (p) => p.frente === f && (p.frentesDoCombo === null || p.frentesDoCombo.length === 0),
          )?.preco,
      );
      if (
        precos.every((p) => p !== undefined) &&
        precos.reduce<number>((soma, p) => soma + (p ?? 0), 0) <= 0
      ) {
        for (const frente of i.frentesDoCombo) {
          partes.push({ frente, produtoId: null, valor: 0 });
          semPreco.add(frente);
        }
        continue;
      }
      const rateio = decomporProduto(
        {
          id: i.produtoId ?? "",
          frente: i.frente,
          preco: i.valor,
          frentesDoCombo: i.frentesDoCombo,
        },
        catalogo,
      );
      partes.push(...rateio.itens);
      for (const f of rateio.semPreco) semPreco.add(f);
    }

    grupos.push({
      tipo,
      linhaDeNegocio: linha,
      valor: doGrupo.reduce((soma, i) => soma + centavos(i.valor), 0) / 100,
      itens: juntarPorFrente(partes),
      frentesSemPreco: [...semPreco],
    });
  }
  return grupos;
}

export function rotuloDoGrupo(grupo: {
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
}): string {
  return `${linhaDeNegocioLabel(grupo.linhaDeNegocio)} ${grupo.tipo === "mrr" ? "mensal" : "projeto"}`;
}

export function contratoInicialDoGrupo(
  grupo: GrupoDeContrato,
  condicoes: CondicoesDaProposta,
  nome: string,
): ContratoInicial {
  return {
    nome: `${nome} · ${rotuloDoGrupo(grupo)}`,
    tipo: grupo.tipo,
    linhaDeNegocio: grupo.linhaDeNegocio,
    valor: grupo.valor,
    itens: grupo.itens,
    frentesSemPreco: grupo.frentesSemPreco,
    mesesDeCobranca: grupo.tipo === "tcv" ? condicoes.parcelasProjeto : null,
    mesesDeFidelidade: grupo.tipo === "mrr" ? condicoes.fidelidadeMeses : null,
    meioDePagamento: condicoes.formaPagamento,
    prazoDeEntregaDias: grupo.tipo === "tcv" ? condicoes.prazoEntregaDias : null,
  };
}
