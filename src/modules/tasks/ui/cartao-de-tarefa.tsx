import { useDraggable } from "@dnd-kit/core";
import { AlignLeft, CalendarDays, ChevronDown, GripVertical, Link2, User } from "lucide-react";
import { useId } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { formatDate } from "@/shared/lib/date";

import { podeArrastar } from "../domain/permissoes";
import {
  type ColunaDaTarefa,
  ORDEM_DAS_COLUNAS,
  ROTULO_DA_COLUNA,
  ROTULO_DA_PRIORIDADE,
  rotuloDeAtraso,
  type Tarefa,
  tarefaVencida,
} from "../domain/task";

const BARRA_DA_PRIORIDADE: Readonly<Record<Tarefa["prioridade"], string>> = {
  urgente: "bg-destructive",
  alta: "bg-warning",
  media: "bg-primary/60",
  baixa: "bg-muted-foreground/40",
};

export function CartaoDeTarefa({
  tarefa,
  movendo,
  onAbrir,
  onMover,
}: {
  readonly tarefa: Tarefa;
  readonly movendo: boolean;
  readonly onAbrir: () => void;
  readonly onMover: (coluna: ColunaDaTarefa) => void;
}) {
  const { papel, meuId } = useProfile();
  const arrastavel = podeArrastar(tarefa, papel, meuId);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({
      id: tarefa.id,
      disabled: !arrastavel || movendo,
      attributes: { roleDescription: "tarefa arrastável", tabIndex: -1 },
    });
  const tituloId = useId();

  const atraso = rotuloDeAtraso(tarefa);
  const vencida = tarefaVencida(tarefa);
  const destinos = ORDEM_DAS_COLUNAS.filter((c) => c !== tarefa.coluna);

  return (
    <article
      ref={setNodeRef}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-3 pl-4 text-sm",
        vencida && "border-destructive/50",
        (isDragging || movendo) && "opacity-60",
        isDragging && "z-10",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-0.5", BARRA_DA_PRIORIDADE[tarefa.prioridade])}
      />

      <div className="flex items-start gap-1.5">
        {arrastavel && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-describedby={`${attributes["aria-describedby"]} ${tituloId}`}
            aria-label="Arrastar tarefa"
            className="mt-0.5 cursor-grab touch-none text-muted-foreground"
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onAbrir}>
          <span id={tituloId} className="block font-medium leading-snug">
            {tarefa.titulo}
          </span>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {tarefa.categoria} · {tarefa.tipo}
          </span>
          {atraso !== null && (
            <span className="mt-1.5 block text-[11px] font-semibold text-destructive">
              {atraso}
            </span>
          )}
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden />
              {tarefa.responsavel ?? <span className="text-warning">sem responsável</span>}
              {tarefa.participantes.length > 0 && <span>+{tarefa.participantes.length}</span>}
            </span>
            {tarefa.prazo !== null && (
              <span
                className={cn(
                  "flex items-center gap-1 tabular-nums",
                  vencida && "text-destructive",
                )}
              >
                <CalendarDays className="h-3 w-3" aria-hidden />
                {formatDate(tarefa.prazo)}
              </span>
            )}
            {tarefa.cliente !== null && <span>{tarefa.cliente}</span>}
            {(tarefa.descricao ?? "").trim() !== "" && (
              <span className="flex items-center">
                <AlignLeft className="h-3 w-3" aria-hidden />
                <span className="sr-only">Tem descrição.</span>
              </span>
            )}
            {tarefa.links.length > 0 && (
              <span className="flex items-center">
                <Link2 className="h-3 w-3" aria-hidden />
                <span className="sr-only">Tem links.</span>
              </span>
            )}
            <span className="ml-auto">{ROTULO_DA_PRIORIDADE[tarefa.prioridade]}</span>
          </span>
        </button>
      </div>

      {arrastavel && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mover para"
              aria-describedby={tituloId}
              disabled={movendo}
              className="mt-2 flex h-7 w-full items-center justify-between rounded-md border bg-background px-1.5 text-[11px] disabled:opacity-50"
            >
              Mover para…
              <ChevronDown className="h-3 w-3" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {destinos.map((coluna) => (
              <DropdownMenuItem key={coluna} onSelect={() => onMover(coluna)}>
                {ROTULO_DA_COLUNA[coluna]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </article>
  );
}
