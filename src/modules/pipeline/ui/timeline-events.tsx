import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/shared/ui/empty-state";
import { formatDateTime } from "@/shared/lib/date";

import type { EventoDaOportunidade } from "../api/pipeline.repository";
import { rotuloDoTipoDeEvento, verboDoTipoDeEvento } from "../domain/event-type";
import { rotuloDoEstagio } from "../domain/stage";

export function ListaDeEventos({
  eventos,
  carregando = false,
  vazio = "Ligações, mensagens de WhatsApp, reuniões, propostas, notas e mudanças de etapa aparecem aqui.",
  podeCorrigir,
  aoCorrigir,
  corrigindo = false,
}: {
  eventos: readonly EventoDaOportunidade[];
  carregando?: boolean;
  vazio?: string;
  podeCorrigir?: (evento: EventoDaOportunidade) => boolean;
  aoCorrigir?: (
    eventoId: string,
    texto: string,
    pronto: () => void,
    editadoEmLido: string | null,
  ) => void;
  corrigindo?: boolean;
}) {
  const [emCorrecao, setEmCorrecao] = useState<{
    id: string;
    editadoEmLido: string | null;
  } | null>(null);
  const [rascunho, setRascunho] = useState("");
  const devolverFocoA = useRef<string | null>(null);

  function fechar(eventoId: string) {
    devolverFocoA.current = eventoId;
    setEmCorrecao(null);
  }

  if (carregando) {
    return <p className="text-xs text-muted-foreground">Carregando…</p>;
  }

  if (eventos.length === 0) {
    return <EmptyState title="Nenhum evento ainda" description={vazio} className="py-6" />;
  }

  return (
    <ol className="grid gap-2">
      {eventos.map((evento) => {
        const editando = emCorrecao?.id === evento.id;
        const desatualizada =
          editando && !corrigindo && evento.editadoEm !== emCorrecao.editadoEmLido;
        const corrigivel =
          aoCorrigir !== undefined &&
          evento.tipo !== "stage_change" &&
          (podeCorrigir?.(evento) ?? false);
        return (
          <li key={evento.id} className="grid gap-0.5 border-l-2 border-border pl-3">
            {editando ? (
              <div className="grid gap-1">
                <Textarea
                  aria-label="Texto corrigido"
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  readOnly={corrigindo}
                  autoFocus
                  className="min-h-16 text-xs"
                />
                {desatualizada && (
                  <p
                    role="alert"
                    className="rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-xs text-amber-500"
                  >
                    {`Esta nota foi corrigida em outra tela e agora diz: ${evento.conteudo ?? "sem texto"}. Cancele e abra Corrigir de novo para partir do texto atual.`}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={rascunho.trim() === "" || corrigindo || desatualizada}
                    onClick={() =>
                      aoCorrigir?.(
                        evento.id,
                        rascunho.trim(),
                        () => fechar(evento.id),
                        emCorrecao.editadoEmLido,
                      )
                    }
                  >
                    Salvar correção
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={corrigindo}
                    onClick={() => fechar(evento.id)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs">
                {evento.tipo === "stage_change"
                  ? (evento.conteudo ??
                    (evento.deEstagio !== null && evento.paraEstagio !== null
                      ? `${rotuloDoEstagio(evento.deEstagio)} → ${rotuloDoEstagio(evento.paraEstagio)}`
                      : rotuloDoTipoDeEvento(evento.tipo)))
                  : (evento.conteudo ?? rotuloDoTipoDeEvento(evento.tipo))}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground first-letter:uppercase">
              {evento.autorNome !== null
                ? `${evento.autorNome} ${verboDoTipoDeEvento(evento.tipo)}`
                : verboDoTipoDeEvento(evento.tipo)}
              {` · ${formatDateTime(evento.criadoEm)}`}
            </p>
            {evento.editadoEm !== null && (
              <p className="text-[10px] text-muted-foreground">
                {`Editado por ${evento.editadoPorNome ?? "autor não identificado"} em ${formatDateTime(evento.editadoEm)}. Texto original: ${evento.conteudoOriginal ?? "sem texto"}`}
              </p>
            )}
            {evento.correcoes.length > 1 && (
              <details className="text-[10px] text-muted-foreground">
                <summary className="cursor-pointer">{`Ver as ${evento.correcoes.length} correções`}</summary>
                <ul aria-label="Correções da nota" className="mt-0.5 grid gap-0.5">
                  {evento.correcoes.map((c) => (
                    <li key={c.id}>
                      {`Por ${c.corrigidoPorNome ?? "autor não identificado"} em ${formatDateTime(c.corrigidoEm)}: de ${c.antes === null ? "sem texto" : `"${c.antes}"`} para "${c.depois}".`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {corrigivel && emCorrecao === null && (
              <Button
                ref={(botao) => {
                  if (botao !== null && devolverFocoA.current === evento.id) {
                    devolverFocoA.current = null;
                    botao.focus();
                  }
                }}
                type="button"
                size="sm"
                variant="link"
                className="h-auto justify-self-start p-0 text-[10px]"
                onClick={() => {
                  devolverFocoA.current = null;
                  setRascunho(evento.conteudo ?? "");
                  setEmCorrecao({ id: evento.id, editadoEmLido: evento.editadoEm });
                }}
              >
                Corrigir
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
