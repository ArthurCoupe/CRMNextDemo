import type { Database } from "@/shared/types/database.types";

export type TipoDeReuniao = Database["public"]["Enums"]["meeting_type"];

export type VinculoExigido = "cliente" | "oportunidade" | "nenhum";

export const TIPOS_POR_GRUPO = [
  {
    grupo: "Com cliente",
    tipos: [
      "kickoff_cliente",
      "semanal_cliente",
      "alinhamento_cliente",
      "apresentacao_de_resultados",
      "renovacao_ou_upsell",
    ],
  },
  {
    grupo: "Internas: time",
    tipos: [
      "interna_de_time",
      "semanal_de_time",
      "quinzenal_de_time",
      "planejamento",
      "retrospectiva",
      "um_a_um",
      "onboarding_de_colaborador",
    ],
  },
  {
    grupo: "Internas: sobre cliente",
    tipos: ["entregas_do_cliente", "alinhamento_interno_sobre_cliente", "proposta_para_prospect"],
  },
] as const satisfies readonly { grupo: string; tipos: readonly TipoDeReuniao[] }[];

const ROTULOS: Record<TipoDeReuniao, string> = {
  kickoff_cliente: "Kickoff com cliente",
  semanal_cliente: "Semanal com cliente",
  alinhamento_cliente: "Alinhamento com cliente",
  apresentacao_de_resultados: "Apresentação de resultados",
  renovacao_ou_upsell: "Renovação ou upsell",
  interna_de_time: "Interna de time",
  semanal_de_time: "Semanal de time",
  quinzenal_de_time: "Quinzenal de time",
  planejamento: "Planejamento",
  retrospectiva: "Retrospectiva",
  um_a_um: "1:1 com colaborador",
  onboarding_de_colaborador: "Onboarding de colaborador",
  entregas_do_cliente: "Entregas do cliente",
  alinhamento_interno_sobre_cliente: "Alinhamento interno sobre cliente",
  proposta_para_prospect: "Proposta para prospect",
};

export function rotuloDoTipo(tipo: TipoDeReuniao): string {
  return ROTULOS[tipo];
}

const EXIGEM_CLIENTE: readonly TipoDeReuniao[] = [
  "kickoff_cliente",
  "semanal_cliente",
  "alinhamento_cliente",
  "apresentacao_de_resultados",
  "renovacao_ou_upsell",
  "entregas_do_cliente",
  "alinhamento_interno_sobre_cliente",
];

export function vinculoExigido(tipo: TipoDeReuniao): VinculoExigido {
  if (tipo === "proposta_para_prospect") return "oportunidade";
  if (EXIGEM_CLIENTE.includes(tipo)) return "cliente";
  return "nenhum";
}

export const TETO_DE_REUNIOES = 200;

export const DURACAO_MAXIMA_MINUTOS = 1440;

export function duracaoValida(minutos: number): boolean {
  return minutos > 0 && minutos <= DURACAO_MAXIMA_MINUTOS;
}

export const MENSAGEM_DO_TETO_DE_REUNIOES =
  `Há mais de ${TETO_DE_REUNIOES} reuniões no período exibido e a lista ficaria incompleta: ` +
  `encurte o período (datas acima) para ver a agenda.`;

export const LIMITE_DA_BUSCA_DE_OPORTUNIDADES = 20;

const MINIMO_DA_BUSCA_DE_OPORTUNIDADE = 2;

export function termoDaBuscaDeOportunidade(digitado: string): string | null {
  const termo = digitado.trim();
  return termo.length >= MINIMO_DA_BUSCA_DE_OPORTUNIDADE ? termo : null;
}

export class ReuniaoCriadaSemParticipantes extends Error {
  constructor(
    readonly reuniaoId: string,
    options?: ErrorOptions,
  ) {
    super(
      "A reunião foi criada, mas sem os participantes. Reabra a reunião e convide quem falta.",
      options,
    );
    this.name = "ReuniaoCriadaSemParticipantes";
  }
}

export { ehDataCivil, ehDataCivilPlausivel, paraInstante } from "@/shared/lib/date";

export function sobrepoe(
  aInicio: Date,
  aMinutos: number,
  bInicio: Date,
  bMinutos: number,
): boolean {
  const aFim = aInicio.getTime() + aMinutos * 60_000;
  const bFim = bInicio.getTime() + bMinutos * 60_000;
  return aInicio.getTime() < bFim && bInicio.getTime() < aFim;
}

export function separarAgenda<R extends { readonly startsAt: string }>(
  lista: readonly R[],
  agora: number = Date.now(),
): { futuras: R[]; passadas: R[] } {
  const inicio = (r: R) => new Date(r.startsAt).getTime();
  return {
    futuras: lista.filter((r) => inicio(r) >= agora).sort((a, b) => inicio(a) - inicio(b)),
    passadas: lista.filter((r) => inicio(r) < agora).sort((a, b) => inicio(b) - inicio(a)),
  };
}
