import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { OportunidadeListada } from "../api/pipeline.repository";
import type { EstagioDoPipeline } from "../domain/pipeline";
import { useMoverEstagio } from "../hooks/use-pipeline";

export interface GanhoPendente {
  readonly oportunidade: OportunidadeListada;
  readonly destino: EstagioDoPipeline;
}

export function DialogoDeGanho({
  ganhando,
  aoFechar,
}: {
  ganhando: GanhoPendente | null;
  aoFechar: () => void;
}) {
  const mover = useMoverEstagio();

  function aoConfirmar() {
    if (ganhando === null) return;
    mover.mutate(
      {
        oportunidadeId: ganhando.oportunidade.id,
        destino: ganhando.destino,
        estagioAtualId: ganhando.oportunidade.estagioId,
        pipelineId: ganhando.oportunidade.pipelineId,
      },
      {
        onSuccess: () => aoFechar(),
        onError: (erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível marcar como ganha."),
      },
    );
  }

  return (
    <Dialog open={ganhando !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-w-md">
        {ganhando !== null && (
          <>
            <DialogHeader>
              <DialogTitle>{`Marcar "${ganhando.oportunidade.nome}" como ganha?`}</DialogTitle>
              <DialogDescription>
                Cliente e contrato você cadastra depois, nas abas Clientes e Contratos.
              </DialogDescription>
            </DialogHeader>

            <footer className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={aoFechar} disabled={mover.isPending}>
                Cancelar
              </Button>
              <Button type="button" onClick={aoConfirmar} disabled={mover.isPending}>
                {mover.isPending ? "Marcando…" : "Marcar como ganha"}
              </Button>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
