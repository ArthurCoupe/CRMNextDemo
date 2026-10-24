import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMudou } from "@/shared/lib/use-mudou";

import type { Script } from "../api/scripts.repository";
import {
  CANAIS_POR_TIPO,
  combinacaoValida,
  ehTipoDeScript,
  MOMENTOS_POR_TIPO,
  rotuloDoCanal,
  rotuloDoMomento,
  rotuloDoTipo,
  type CanalDeScript,
  type MomentoDeScript,
  type TipoDeScript,
} from "../domain/script";
import { useAtualizarScript, useCriarScript, useNichos } from "../hooks/use-scripts";

interface Rascunho {
  tipo: TipoDeScript;
  title: string;
  body: string;
  nicho: string;
  canal: CanalDeScript;
  momento: MomentoDeScript;
}

function rascunhoVazio(tipo: TipoDeScript): Rascunho {
  return {
    tipo,
    title: "",
    body: "",
    nicho: "",
    canal: CANAIS_POR_TIPO[tipo][0],
    momento: MOMENTOS_POR_TIPO[tipo][0],
  };
}

function rascunhoDe(script: Script): Rascunho {
  return {
    tipo: script.tipo,
    title: script.title,
    body: script.body,
    nicho: script.nicho,
    canal: script.canal,
    momento: script.momento,
  };
}

function ajustadoAoTipo(atual: Rascunho, tipo: TipoDeScript): Rascunho {
  const canalOk = CANAIS_POR_TIPO[tipo].includes(atual.canal)
    ? atual.canal
    : CANAIS_POR_TIPO[tipo][0];
  const momentoOk = MOMENTOS_POR_TIPO[tipo].includes(atual.momento)
    ? atual.momento
    : MOMENTOS_POR_TIPO[tipo][0];
  if (tipo === atual.tipo && canalOk === atual.canal && momentoOk === atual.momento) return atual;
  return { ...atual, tipo, canal: canalOk, momento: momentoOk };
}

interface FormularioDeScriptProps {
  readonly tipo: TipoDeScript;
  readonly aberto: boolean;
  readonly script: Script | null;
  readonly aoFechar: () => void;
}

export function FormularioDeScript({ tipo, aberto, script, aoFechar }: FormularioDeScriptProps) {
  const [rascunho, setRascunho] = useState<Rascunho>(() =>
    script === null ? rascunhoVazio(tipo) : rascunhoDe(script),
  );
  const criar = useCriarScript();
  const atualizar = useAtualizarScript();
  const { data: nichos } = useNichos(rascunho.tipo);

  const abriu = useMudou(aberto);
  const trocouScript = useMudou(script);
  const trocouTipo = useMudou(tipo);
  if (aberto && (abriu || trocouScript)) {
    setRascunho(script === null ? rascunhoVazio(tipo) : rascunhoDe(script));
  }
  if (aberto && script === null && (abriu || trocouTipo)) {
    setRascunho((atual) => ajustadoAoTipo(atual, tipo));
  }

  const editar = <C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) =>
    setRascunho((atual) => ({ ...atual, [campo]: valor }));

  const salvando = criar.isPending || atualizar.isPending;
  const invalido =
    rascunho.title.trim() === "" ||
    rascunho.body.trim() === "" ||
    !combinacaoValida(rascunho.tipo, rascunho.canal, rascunho.momento);

  function salvar() {
    if (invalido) return;

    const dados = {
      tipo: rascunho.tipo,
      title: rascunho.title.trim(),
      body: rascunho.body.trim(),
      nicho: rascunho.nicho.trim(),
      canal: rascunho.canal,
      momento: rascunho.momento,
    };

    if (script === null) {
      criar.mutate({ ...dados, pipelineStage: null }, { onSuccess: aoFechar });
    } else {
      atualizar.mutate(
        { id: script.id, dados, updatedAt: script.updatedAt },
        { onSuccess: aoFechar },
      );
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{script === null ? "Novo script" : "Editar script"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {script !== null && (
            <div>
              <Label htmlFor="script-tipo">Tipo</Label>
              <Select
                value={rascunho.tipo}
                onValueChange={(v) => {
                  if (ehTipoDeScript(v)) setRascunho((atual) => ajustadoAoTipo(atual, v));
                }}
              >
                <SelectTrigger id="script-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CANAIS_POR_TIPO) as TipoDeScript[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {rotuloDoTipo(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Trocar o tipo leva o script para a outra lista; canal e momento passam para os do
                tipo novo.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="script-titulo">Título</Label>
            <Input
              id="script-titulo"
              value={rascunho.title}
              onChange={(e) => editar("title", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="script-corpo">Corpo</Label>
            <Textarea
              id="script-corpo"
              rows={6}
              value={rascunho.body}
              onChange={(e) => editar("body", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="script-nicho">Nicho</Label>
            <Input
              id="script-nicho"
              list="script-nicho-sugestoes"
              value={rascunho.nicho}
              onChange={(e) => editar("nicho", e.target.value)}
              placeholder="advocacia"
            />
            <datalist id="script-nicho-sugestoes">
              {(nichos ?? []).map((nicho) => (
                <option key={nicho} value={nicho} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="script-canal">Canal</Label>
              <Select
                value={rascunho.canal}
                onValueChange={(v) => editar("canal", v as CanalDeScript)}
              >
                <SelectTrigger id="script-canal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS_POR_TIPO[rascunho.tipo].map((canal) => (
                    <SelectItem key={canal} value={canal}>
                      {rotuloDoCanal(canal)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="script-momento">Momento</Label>
              <Select
                value={rascunho.momento}
                onValueChange={(v) => editar("momento", v as MomentoDeScript)}
              >
                <SelectTrigger id="script-momento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOMENTOS_POR_TIPO[rascunho.tipo].map((momento) => (
                    <SelectItem key={momento} value={momento}>
                      {rotuloDoMomento(momento)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={invalido || salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
