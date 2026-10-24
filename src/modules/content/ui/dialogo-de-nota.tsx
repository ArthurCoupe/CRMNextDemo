import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { PostDoQuadro } from "../api/content.repository";
import { ehLinkHttps, LIMITE_DA_NOTA, tamanho } from "../domain/formulario";

export interface PedidoDeMovimento {
  readonly post: PostDoQuadro;
  readonly para: "ajuste_pedido" | "publicado";
}

export function DialogoDeNota({
  pedido,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  readonly pedido: PedidoDeMovimento;
  readonly enviando: boolean;
  readonly onCancelar: () => void;
  readonly onConfirmar: (texto: string | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const limpo = texto.trim();
  const ajuste = pedido.para === "ajuste_pedido";
  const erro = ajuste
    ? tamanho(limpo) > LIMITE_DA_NOTA
      ? "A nota pode ter até 2.000 caracteres."
      : undefined
    : limpo !== "" && !ehLinkHttps(limpo)
      ? "O link do post precisa começar com https:// e ter até 2.000 caracteres."
      : undefined;
  const pode = !enviando && erro === undefined && (!ajuste || limpo !== "");

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !enviando && onCancelar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ajuste ? "O que o cliente pediu?" : "Marcar como publicado"}</DialogTitle>
          <DialogDescription className="text-xs">
            {pedido.post.titulo} · {pedido.post.clienteNome}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="nota-do-movimento">
            {ajuste ? "Pedido do cliente" : "Link do post (opcional)"}
          </Label>
          {ajuste ? (
            <Textarea
              id="nota-do-movimento"
              className="mt-1 min-h-24"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          ) : (
            <Input
              id="nota-do-movimento"
              className="mt-1"
              inputMode="url"
              placeholder="https://"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          )}
          {erro !== undefined && (
            <p role="alert" className="mt-1 text-[11px] text-destructive">
              {erro}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={enviando} onClick={onCancelar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!pode}
            onClick={() => onConfirmar(limpo === "" ? null : limpo)}
          >
            {ajuste ? "Registrar ajuste" : "Marcar como publicado"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
