import type { Database } from "@/shared/types/database.types";

export type PapelDeAcesso = Database["public"]["Enums"]["app_role"];

export interface ContextoDeAcesso {
  readonly papel: PapelDeAcesso | null;
  readonly usuarioId: string | null;
}

export function podeLerContratosDoCliente(
  contexto: ContextoDeAcesso,
  responsavelIdDoCliente: string | null,
): boolean {
  if (contexto.papel === "owner") return true;
  if (contexto.papel !== "manager") return false;
  if (contexto.usuarioId === null || responsavelIdDoCliente === null) return false;
  return responsavelIdDoCliente === contexto.usuarioId;
}

export type PermissaoDeTroca =
  { readonly permitido: true } | { readonly permitido: false; readonly motivo: string };

const PERMITIDO: PermissaoDeTroca = { permitido: true };

export function podeTrocarResponsavel(
  contexto: ContextoDeAcesso,
  responsavelIdDoCliente: string | null,
): PermissaoDeTroca {
  if (contexto.papel === "owner") return PERMITIDO;

  if (contexto.papel !== "manager") {
    return {
      permitido: false,
      motivo: "Só owner e manager trocam o responsável de um cliente.",
    };
  }

  if (contexto.usuarioId === null) {
    return { permitido: false, motivo: "Sessão ainda carregando." };
  }

  if (responsavelIdDoCliente === null) {
    return {
      permitido: false,
      motivo:
        "Cliente sem responsável só pode ser atribuído por um owner. Definir o responsável concede leitura dos contratos deste cliente.",
    };
  }

  if (responsavelIdDoCliente !== contexto.usuarioId) {
    return {
      permitido: false,
      motivo:
        "Este cliente é de outro responsável. Trocar exige um owner. Do contrário, qualquer gestor poderia se atribuir a carteira alheia e ler os contratos dela.",
    };
  }

  return PERMITIDO;
}

export interface DisponibilidadeDoFiltroDeBU {
  readonly disponivel: boolean;
  readonly precisaDeAviso: boolean;
  readonly motivo: string | null;
}

export function filtroDeBUDisponivel(contexto: ContextoDeAcesso): DisponibilidadeDoFiltroDeBU {
  if (contexto.papel === "owner") {
    return { disponivel: true, precisaDeAviso: false, motivo: null };
  }
  if (contexto.papel === "manager") {
    return {
      disponivel: true,
      precisaDeAviso: true,
      motivo:
        "A linha de negócio vem do contrato. Com este filtro, aparecem só os clientes cujos contratos você pode ver. Os das outras carteiras ficam de fora.",
    };
  }
  return {
    disponivel: false,
    precisaDeAviso: false,
    motivo: "A linha de negócio vem do contrato, e seu papel não lê contratos.",
  };
}
