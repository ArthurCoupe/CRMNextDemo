import type { PostgrestError } from "@supabase/supabase-js";

export const CODIGO_SEM_PERMISSAO = "42501";

export function ehFaltaDePermissao(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "code" in erro &&
    (erro as PostgrestError).code === CODIGO_SEM_PERMISSAO
  );
}

export const SEM_RETENTATIVA_EM_RECUSA = (contagem: number, erro: unknown): boolean =>
  !ehFaltaDePermissao(erro) && contagem < 2;
