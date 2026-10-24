import type { Database } from "@/shared/types/database.types";

export type Canal = Database["public"]["Enums"]["acquisition_channel"];

export const SEM_ATRIBUICAO = "sem_atribuicao";

interface InfoDoCanal {
  readonly rotulo: string;
  readonly tese: string;
}

const INFO: Record<Canal, InfoDoCanal> = {
  indicacao: {
    rotulo: "Indicação",
    tese: "Contato que chega por recomendação de um cliente ou parceiro.",
  },
  pago: {
    rotulo: "Tráfego pago",
    tese: "Contato que chega por anúncio pago, com custo por lead medido.",
  },
  inbound: {
    rotulo: "Inbound / MKT",
    tese: "Contato que chega pelo site, conteúdo ou redes sociais.",
  },
  outbound: {
    rotulo: "Outbound",
    tese: "Contato iniciado pelo time comercial, por lista ou prospecção ativa.",
  },
};

export const CANAIS: readonly Canal[] = ["indicacao", "pago", "inbound", "outbound"];

export function rotuloDoCanal(canal: Canal): string {
  return INFO[canal].rotulo;
}

export function teseDoCanal(canal: Canal): string {
  return INFO[canal].tese;
}

export function rotuloDaChaveDeCanal(chave: string): string {
  if (chave === SEM_ATRIBUICAO) return "Sem atribuição";
  return Object.hasOwn(INFO, chave) ? INFO[chave as Canal].rotulo : chave;
}

export function ehCanalDeVerdade(chave: string): chave is Canal {
  return Object.hasOwn(INFO, chave);
}
