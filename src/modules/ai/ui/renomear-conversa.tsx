import { Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { erroDoTitulo, LIMITE_DO_TITULO } from "../domain/titulo";
import { useRenomearConversa } from "../hooks/use-conversas";

export function RenomearConversa({
  conversaId,
  tituloAtual,
  desabilitado,
}: {
  readonly conversaId: string;
  readonly tituloAtual: string | null;
  readonly desabilitado: boolean;
}) {
  const renomear = useRenomearConversa();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [mexeu, setMexeu] = useState(false);
  const problema = erroDoTitulo(texto);
  const acusar = mexeu && problema !== null;

  function abrirOuFechar(abrir: boolean) {
    if (!abrir && renomear.isPending) return;
    if (abrir) {
      setTexto(tituloAtual ?? "");
      setMexeu(false);
    }
    setAberto(abrir);
  }

  function salvar(e: FormEvent) {
    e.preventDefault();
    if (problema !== null || renomear.isPending) return;
    renomear.mutate({ id: conversaId, titulo: texto }, { onSuccess: () => setAberto(false) });
  }

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={desabilitado}>
          <Pencil className="size-4" aria-hidden />
          Renomear conversa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear conversa</DialogTitle>
          <DialogDescription>O nome aparece na lista de conversas recentes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="renomear-conversa">Nome da conversa</Label>
            <Input
              id="renomear-conversa"
              value={texto}
              maxLength={LIMITE_DO_TITULO}
              onChange={(e) => {
                setTexto(e.target.value);
                setMexeu(true);
              }}
              aria-invalid={acusar}
              aria-describedby={acusar ? "renomear-conversa-erro" : undefined}
            />
            {acusar && (
              <p id="renomear-conversa-erro" role="alert" className="text-xs text-destructive">
                {problema}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAberto(false)}
              disabled={renomear.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={problema !== null || renomear.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
