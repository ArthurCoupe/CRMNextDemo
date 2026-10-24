import { PostgrestError } from "@supabase/supabase-js";

interface ErroBruto {
  readonly message?: string;
  readonly details?: string;
  readonly hint?: string;
  readonly code?: string;
}

export function erroDoBanco(erro: ErroBruto): unknown {
  if (typeof erro.code !== "string" || erro.code === "") return erro;

  return new PostgrestError({
    message: erro.message ?? "",
    details: erro.details ?? "",
    hint: erro.hint ?? "",
    code: erro.code,
  });
}
