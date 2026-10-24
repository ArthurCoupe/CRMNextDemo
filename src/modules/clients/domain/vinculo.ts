import { formatDate } from "@/shared/lib/date";

export interface GanhaSemContrato {
  readonly id: string;
  readonly nome: string;
  readonly contatoNome: string | null;
  readonly contatoEmail: string | null;
  readonly contatoTelefone: string | null;
  readonly segmento: string | null;
  readonly nicho: string | null;
  readonly ganhaEm: string;
}

export function rotuloDaGanha(ganha: GanhaSemContrato): string {
  return `${ganha.nome}, ganha em ${formatDate(ganha.ganhaEm)}`;
}
