import { AlertTriangle } from "lucide-react";

export function FalhaAoLer({ oQue, mensagem }: { oQue: string; mensagem?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <strong>Não foi possível ler {oQue}.</strong>{" "}
        {mensagem ?? (
          <>
            O número abaixo não é zero, é desconhecido. Recarregue a página; se persistir, é falha
            de conexão com o banco.
          </>
        )}
      </span>
    </div>
  );
}
