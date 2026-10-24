import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";

import { useMudou } from "@/shared/lib/use-mudou";

import { useAtualizarPerfil, usePerfilEmGravacao } from "../hooks/use-settings";

export function DialogoMeuPerfil({ onFechar }: { readonly onFechar: () => void }) {
  const { perfil, meuId } = useProfile();
  const atualizar = useAtualizarPerfil();
  const gravandoPerfil = usePerfilEmGravacao();
  const [nome, setNome] = useState(perfil?.full_name ?? "");
  const [cargo, setCargo] = useState(perfil?.job_title ?? "");
  const [nomeTocado, setNomeTocado] = useState(false);
  const [cargoTocado, setCargoTocado] = useState(false);
  const nomeMudou = useMudou(perfil?.full_name);
  const cargoMudou = useMudou(perfil?.job_title);
  if (nomeMudou && !nomeTocado) setNome(perfil?.full_name ?? "");
  if (cargoMudou && !cargoTocado) setCargo(perfil?.job_title ?? "");
  const nomeEmBranco = nome.trim() === "";
  const travado =
    nomeEmBranco || meuId === null || perfil === null || atualizar.isPending || gravandoPerfil;

  function salvar() {
    if (travado || meuId === null) return;
    atualizar.mutate(
      { id: meuId, dados: { nomeCompleto: nome, cargo: cargo.trim() === "" ? null : cargo } },
      { onSuccess: onFechar },
    );
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !atualizar.isPending && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>
            O nome aparece para o time em todo o CRM. O cargo fica no seu perfil.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="perfil-nome">Nome</Label>
            <Input
              id="perfil-nome"
              value={nome}
              maxLength={120}
              onChange={(e) => {
                setNome(e.target.value);
                setNomeTocado(true);
              }}
            />
            {nomeEmBranco && (
              <p role="alert" className="text-xs text-destructive">
                O nome não pode ficar em branco.
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="perfil-cargo">Cargo</Label>
            <Input
              id="perfil-cargo"
              value={cargo}
              maxLength={120}
              placeholder="SDR"
              onChange={(e) => {
                setCargo(e.target.value);
                setCargoTocado(true);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar} disabled={atualizar.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={travado}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
