import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

export const avisarErro = (fallback: string) => (erro: unknown) =>
  toast.error(erro instanceof Error ? erro.message : fallback);

export function avisarEInvalidar(qc: QueryClient, chave: QueryKey, fallback: string) {
  return (erro: unknown) => {
    void qc.invalidateQueries({ queryKey: chave });
    avisarErro(fallback)(erro);
  };
}
