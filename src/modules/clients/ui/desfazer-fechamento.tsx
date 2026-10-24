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
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { VendaDeOrigem } from "@/modules/contracts/domain/venda-de-origem";

import { useDesfazerFechamento } from "../hooks/use-clients";

export function DesfazerFechamento({ venda }: { venda: VendaDeOrigem }) {
  const desfazer = useDesfazerFechamento();
  const [motivo, setMotivo] = useState("");
  const motivoValido = motivo.trim() !== "";

  return (
    <AlertDialog
      onOpenChange={(aberto) => {
        if (!aberto) setMotivo("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Desfazer fechamento
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desfazer o fechamento de "{venda.nome}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Isto apaga os contratos desta venda, com os itens e as participações, e devolve a
            oportunidade ao funil. O cliente e os contratos de outras vendas ficam. Não pode ser
            desfeito. O banco recusa se o mês de algum desses contratos já tiver sido congelado.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="motivo-do-desfazer" className="text-sm font-medium">
            Motivo
          </label>
          <Textarea
            id="motivo-do-desfazer"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: fechei a oportunidade errada"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Fica registrado com o seu nome, a data e quanto saiu do funil.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={!motivoValido || desfazer.isPending}
            onClick={(evento) => {
              if (!motivoValido) {
                evento.preventDefault();
                return;
              }
              desfazer.mutate({ vendaId: venda.id, motivo: motivo.trim() });
            }}
          >
            Sim, desfazer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
