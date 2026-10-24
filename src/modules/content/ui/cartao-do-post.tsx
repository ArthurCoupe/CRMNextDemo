import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, GripVertical } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/shared/lib/date";

import type { PostDoQuadro } from "../api/content.repository";
import { ROTULO_DO_CANAL, ROTULO_DO_FORMATO, type StatusDoPost } from "../domain/post";
import { estaAtrasado } from "../domain/prazos";
import { destinosDe, rotuloDaAcao } from "../domain/transicoes";

export function CartaoDoPost({
  post,
  agora,
  movendo,
  onAbrir,
  onEscolher,
}: {
  readonly post: PostDoQuadro;
  readonly agora: Date;
  readonly movendo: boolean;
  readonly onAbrir: (post: PostDoQuadro) => void;
  readonly onEscolher: (post: PostDoQuadro, para: StatusDoPost) => void;
}) {
  const destinos = destinosDe(post.status);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({ id: post.id, disabled: movendo || destinos.length === 0 });

  return (
    <article
      ref={setNodeRef}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        "rounded-md border bg-background p-2 text-xs shadow-sm",
        (isDragging || movendo) && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        {destinos.length > 0 && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            tabIndex={-1}
            aria-label="Arrastar post"
            className="mt-0.5 cursor-grab touch-none text-muted-foreground"
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onAbrir(post)}>
          <span className="block text-[11px] text-muted-foreground">
            {ROTULO_DO_FORMATO[post.formato]} · {ROTULO_DO_CANAL[post.canal]}
          </span>
          <span className="block truncate font-medium">{post.titulo}</span>
          <span className="block truncate text-muted-foreground">{post.clienteNome}</span>
        </button>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{formatDateTime(post.agendadoPara)}</span>
        <span>· {post.responsavelNome}</span>
        {estaAtrasado(post, agora) && (
          <span className="rounded bg-destructive-soft px-1 text-destructive">Atrasado</span>
        )}
      </p>
      {destinos.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mover para"
              disabled={movendo}
              className="mt-1.5 flex h-7 w-full items-center justify-between rounded-md border bg-background px-1.5 text-[11px] disabled:opacity-50"
            >
              Mover para…
              <ChevronDown className="h-3 w-3" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {destinos.map((para) => (
              <DropdownMenuItem key={para} onSelect={() => onEscolher(post, para)}>
                {rotuloDaAcao(post.status, para)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </article>
  );
}
