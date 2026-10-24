import { useState } from "react";

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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { DataISO } from "../domain/mes-civil";
import { useRegravarMes } from "../hooks/use-result";

export function RegravarMes({ mes, rotulo }: { readonly mes: DataISO; readonly rotulo: string }) {
  const regravar = useRegravarMes();
  const [motivo, setMotivo] = useState("");
  const idDoMotivo = `motivo-regravacao-${mes}`;

  return (
    <span onClick={(evento) => evento.stopPropagation()}>
      <AlertDialog onOpenChange={(aberto) => !aberto && setMotivo("")}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-2 h-6 px-2 text-[11px]"
            aria-label={`Regravar o snapshot de ${rotulo}`}
          >
            Regravar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regravar o mês de {rotulo}?</AlertDialogTitle>
            <AlertDialogDescription>
              O snapshot é refeito com os contratos, as despesas e as alíquotas de hoje. O número
              antigo, o novo, quem regravou e o motivo ficam no registro de regravações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1">
            <Label htmlFor={idDoMotivo}>Motivo da regravação</Label>
            <Textarea
              id={idDoMotivo}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              maxLength={2000}
              className="min-h-16 text-xs"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={motivo.trim() === "" || regravar.isPending}
              onClick={() => regravar.mutate({ mes, motivo: motivo.trim() })}
            >
              Regravar mês
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}
