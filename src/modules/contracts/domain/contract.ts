import type { Database } from "@/shared/types/database.types";

export type TipoDeContrato = Database["public"]["Enums"]["contract_type"];
export type LinhaDeNegocio = Database["public"]["Enums"]["business_unit"];
export type FrenteDeServico = Database["public"]["Enums"]["service_front"];
export const FRENTES_DE_SERVICO: readonly FrenteDeServico[] = [
  "posicionamento",
  "trafego",
  "comercial",
  "sistemas",
];
export type StatusDeContrato = Database["public"]["Enums"]["contract_status"];
export type MeioDePagamento = Database["public"]["Enums"]["payment_method"];

export interface ItemDeContrato {
  readonly frente: FrenteDeServico;
  readonly produtoId?: string | null;
  readonly valor: number;
}

export interface ContratoInicial {
  readonly nome: string;
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly valor: number;
  readonly itens: readonly ItemDeContrato[];
  readonly frentesSemPreco: readonly FrenteDeServico[];
  readonly mesesDeCobranca: number | null;
  readonly mesesDeFidelidade: number | null;
  readonly meioDePagamento: MeioDePagamento;
  readonly prazoDeEntregaDias: number | null;
}

export interface Contrato {
  readonly id: string;
  readonly clienteId: string;
  readonly nome: string;
  readonly tipo: TipoDeContrato;
  readonly linhaDeNegocio: LinhaDeNegocio;
  readonly valorMensal: number | null;
  readonly valorTotal: number | null;
  readonly mesesDeCobranca: number | null;
  readonly cobrancaAtiva: boolean;
  readonly inicio: string;
  readonly fim: string | null;
  readonly firme: boolean;
  readonly status: StatusDeContrato;
}

const ROTULO_STATUS: Record<StatusDeContrato, string> = {
  active: "Ativo",
  paused: "Pausado",
  cancelled: "Cancelado",
  finished: "Encerrado",
};

export function contractStatusLabel(status: StatusDeContrato): string {
  return ROTULO_STATUS[status];
}

const ROTULO_FRENTE: Record<FrenteDeServico, string> = {
  posicionamento: "Posicionamento",
  trafego: "Tráfego",
  comercial: "Comercial",
  sistemas: "Sistemas",
};

export function frenteLabel(frente: FrenteDeServico): string {
  return ROTULO_FRENTE[frente];
}

const ROTULO_BU: Record<LinhaDeNegocio, string> = {
  demanda: "Demanda",
  sistemas: "Sistemas",
  compartilhado: "Compartilhado",
};

export function linhaDeNegocioLabel(bu: LinhaDeNegocio): string {
  return ROTULO_BU[bu];
}

export function linhaDeNegocioDaFrente(frente: FrenteDeServico): LinhaDeNegocio {
  return frente === "sistemas" ? "sistemas" : "demanda";
}

export function frenteCombinaComLinhaDeNegocio(
  frente: FrenteDeServico,
  bu: LinhaDeNegocio,
): boolean {
  return linhaDeNegocioDaFrente(frente) === bu;
}

export function problemaNasFrentesDoCombo(
  frentes: readonly FrenteDeServico[],
  linhaDeNegocio: LinhaDeNegocio,
): string | null {
  if (frentes.length === 0) return "Marque pelo menos uma frente do combo.";
  const deFora = frentes.filter((f) => !frenteCombinaComLinhaDeNegocio(f, linhaDeNegocio));
  if (deFora.length === 0) return null;
  const verbo = deFora.length === 1 ? "não é" : "não são";
  return `${deFora.map(frenteLabel).join(", ")} ${verbo} da linha ${linhaDeNegocioLabel(linhaDeNegocio)}: o contrato recusaria o item.`;
}

export function exigeDecisaoDeCobranca(status: StatusDeContrato): boolean {
  return status === "paused" || status === "finished" || status === "cancelled";
}

export function exigeDecisaoAoReativar(
  status: StatusDeContrato,
  cobrancaAtivaOriginal: boolean,
): boolean {
  return status === "active" && !cobrancaAtivaOriginal;
}
