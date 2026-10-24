import { useState, type ReactElement, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DialogoDeExclusao({
  gatilho,
  titulo,
  children,
  confirmarDigitando,
  pendente,
  onConfirmar,
}: {
  gatilho: ReactElement;
  titulo: string;
  children: ReactNode;
  confirmarDigitando?: string;
  pendente: boolean;
  onConfirmar: () => void;
}) {
  const [digitado, setDigitado] = useState("");
  const confere = confirmarDigitando === undefined || digitado.trim() === confirmarDigitando.trim();

  return (
    <AlertDialog
      onOpenChange={(aberto) => {
        if (!aberto) setDigitado("");
      }}
    >
      <AlertDialogTrigger asChild>{gatilho}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">{children}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {confirmarDigitando !== undefined && (
          <div className="space-y-1.5">
            <label htmlFor="confirmar-exclusao" className="text-sm font-medium">
              Digite <span className="font-semibold">{confirmarDigitando}</span> para confirmar
            </label>
            <Input
              id="confirmar-exclusao"
              autoComplete="off"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={pendente || !confere}
            onClick={onConfirmar}
          >
            Sim, apagar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
