import type { Database } from "@/shared/types/database.types";

export type StatusDaProposta = Database["public"]["Enums"]["proposal_status"];
export type PapelNaProposta = "owner" | "manager" | "member" | "client";

export const PROPOSTA_CONGELADA = "Esta proposta já foi enviada. Crie uma nova versão para mudar.";

export const NOME_DO_ITEM_EM_BRANCO = "O nome do item não pode ficar em branco.";

export const ROTULO_DO_STATUS: Readonly<Record<StatusDaProposta, string>> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};

export function rotuloDaProposta(numero: number, versao: number): string {
  return `Nº ${String(numero).padStart(4, "0")} v${versao}`;
}

export function podeEditar(status: StatusDaProposta): boolean {
  return status === "rascunho";
}

export type AcaoDaProposta = "baixar_pdf" | "excluir" | "recusar" | "nova_versao" | "aceitar";

export function acoes(
  status: StatusDaProposta,
  papel: PapelNaProposta | null,
  ultima: boolean,
): readonly AcaoDaProposta[] {
  if (papel === null || papel === "client") return [];
  if (status === "rascunho") return ["baixar_pdf", "excluir"];
  if (status === "aceita" || !ultima) return ["baixar_pdf"];
  if (status === "recusada") return ["baixar_pdf", "nova_versao"];
  return papel === "owner"
    ? ["baixar_pdf", "recusar", "nova_versao", "aceitar"]
    : ["baixar_pdf", "recusar", "nova_versao"];
}
