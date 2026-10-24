import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { PostDoQuadro } from "../api/content.repository";
import {
  COR_DO_STATUS,
  ETAPAS,
  ORDEM_DOS_STATUS,
  ROTULO_DO_STATUS,
  type StatusDoPost,
} from "../domain/post";
import { podeMover } from "../domain/transicoes";
import { CartaoDoPost } from "./cartao-do-post";

const rotulo = (id: string | number) => ROTULO_DO_STATUS[id as StatusDoPost] ?? String(id);

const ANUNCIOS: Announcements = {
  onDragStart: () => "Arrastando o post.",
  onDragOver: ({ over }) => (over ? `Sobre ${rotulo(over.id)}.` : "Fora das colunas."),
  onDragEnd: ({ over }) => (over ? `Solto em ${rotulo(over.id)}.` : "Solto fora das colunas."),
  onDragCancel: () => "Movimento cancelado.",
};

export function QuadroDeConteudo({
  posts,
  agora,
  movendoId,
  onAbrir,
  onMover,
}: {
  readonly posts: readonly PostDoQuadro[];
  readonly agora: Date;
  readonly movendoId: string | undefined;
  readonly onAbrir: (post: PostDoQuadro) => void;
  readonly onMover: (post: PostDoQuadro, para: StatusDoPost) => void;
}) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [arrastando, setArrastando] = useState<StatusDoPost | null>(null);

  const porStatus = new Map<StatusDoPost, PostDoQuadro[]>(ORDEM_DOS_STATUS.map((s) => [s, []]));
  for (const p of posts) porStatus.get(p.status)?.push(p);

  function aoSoltar(evento: DragEndEvent) {
    setArrastando(null);
    const post = posts.find((p) => p.id === evento.active.id);
    const para = evento.over?.id;
    if (post !== undefined && typeof para === "string") onMover(post, para as StatusDoPost);
  }

  return (
    <DndContext
      sensors={sensores}
      accessibility={{
        announcements: ANUNCIOS,
        screenReaderInstructions: {
          draggable: "Para mudar a etapa pelo teclado, use o menu Mover para do cartão.",
        },
      }}
      onDragStart={(e) => setArrastando(posts.find((p) => p.id === e.active.id)?.status ?? null)}
      onDragEnd={aoSoltar}
      onDragCancel={() => setArrastando(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {ETAPAS.map((etapa) => (
          <section
            key={etapa.sigla}
            aria-label={`${etapa.sigla} · ${etapa.nome}`}
            className="flex shrink-0 flex-col"
          >
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {etapa.sigla} · {etapa.nome}
            </h2>
            <div className="flex flex-1 gap-2">
              {etapa.status.map((status) => (
                <Coluna
                  key={status}
                  status={status}
                  posts={porStatus.get(status) ?? []}
                  aceita={arrastando === null || podeMover(arrastando, status)}
                  origem={status === arrastando}
                  agora={agora}
                  movendoId={movendoId}
                  onAbrir={onAbrir}
                  onMover={onMover}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </DndContext>
  );
}

function Coluna({
  status,
  posts,
  aceita,
  origem,
  agora,
  movendoId,
  onAbrir,
  onMover,
}: {
  readonly status: StatusDoPost;
  readonly posts: readonly PostDoQuadro[];
  readonly aceita: boolean;
  readonly origem: boolean;
  readonly agora: Date;
  readonly movendoId: string | undefined;
  readonly onAbrir: (post: PostDoQuadro) => void;
  readonly onMover: (post: PostDoQuadro, para: StatusDoPost) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !aceita });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-60 flex-col rounded-lg border bg-card p-2",
        isOver && "ring-2 ring-primary",
        !aceita && !origem && "opacity-40",
      )}
    >
      <h3 className="mb-2 flex items-center justify-between text-xs font-medium">
        <span className={cn("rounded px-1.5 py-0.5", COR_DO_STATUS[status])}>
          {ROTULO_DO_STATUS[status]}
        </span>
        <span className="tabular-nums text-muted-foreground">{posts.length}</span>
      </h3>
      <ul className="space-y-2">
        {posts.map((p) => (
          <li key={p.id}>
            <CartaoDoPost
              post={p}
              agora={agora}
              movendo={movendoId === p.id}
              onAbrir={onAbrir}
              onEscolher={onMover}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
