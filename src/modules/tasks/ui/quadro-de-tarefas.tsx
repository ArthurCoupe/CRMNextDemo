import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/ui/empty-state";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";

import {
  agruparPorColuna,
  type ColunaDaTarefa,
  destinoDoArrasto,
  ehColuna,
  ORDEM_DAS_COLUNAS,
  ROTULO_DA_COLUNA,
  type Tarefa,
} from "../domain/task";
import { CartaoDeTarefa } from "./cartao-de-tarefa";

const rotulo = (id: string | number) => (ehColuna(id) ? ROTULO_DA_COLUNA[id] : String(id));

const ANUNCIOS: Announcements = {
  onDragStart: () => "Arrastando a tarefa.",
  onDragOver: ({ over }) => (over ? `Sobre ${rotulo(over.id)}.` : "Fora das colunas."),
  onDragEnd: ({ over }) => (over ? `Solta em ${rotulo(over.id)}.` : "Solta fora das colunas."),
  onDragCancel: () => "Movimento cancelado.",
};

export function QuadroDeTarefas({
  tarefas,
  estado,
  onMover,
  onAbrir,
  movendo,
  concluidasNaLista,
  somenteVencidas,
  incluirConcluidas,
}: {
  readonly tarefas: readonly Tarefa[];
  readonly estado: EstadoDaConsulta;
  readonly onMover: (id: string, coluna: ColunaDaTarefa) => void;
  readonly onAbrir: (id: string) => void;
  readonly movendo: string | undefined;
  readonly concluidasNaLista: boolean;
  readonly somenteVencidas: boolean;
  readonly incluirConcluidas: boolean;
}) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  if (estado === "erro") return <FalhaAoLer oQue="as tarefas" />;
  if (estado === "carregando")
    return <div className="h-64 animate-pulse rounded-xl border bg-card" />;

  const porColuna = agruparPorColuna(tarefas);

  function aoSoltar(evento: DragEndEvent) {
    const destino = destinoDoArrasto(tarefas, evento.active.id, evento.over?.id);
    if (destino !== null) onMover(destino.id, destino.coluna);
  }

  return (
    <>
      {tarefas.length === 0 && (
        <EmptyState
          title="Nada nesta seleção"
          description="Estreite ou solte os filtros. As colunas abaixo dizem o que ficou de fora."
        />
      )}

      <DndContext
        sensors={sensores}
        accessibility={{
          announcements: ANUNCIOS,
          screenReaderInstructions: {
            draggable: "Para mudar a coluna pelo teclado, use o menu Mover para do cartão.",
          },
        }}
        onDragEnd={aoSoltar}
      >
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 md:grid md:grid-cols-4 md:overflow-visible">
          {ORDEM_DAS_COLUNAS.map((coluna) => (
            <Coluna key={coluna} coluna={coluna}>
              <h3 className="mb-2 flex items-baseline gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                {ROTULO_DA_COLUNA[coluna]}
                <span className="tabular-nums">
                  {coluna === "done" && !concluidasNaLista ? "-" : porColuna[coluna].length}
                </span>
              </h3>

              <div className="space-y-2">
                {porColuna[coluna].length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">
                    {coluna !== "done" || concluidasNaLista
                      ? "nada aqui"
                      : somenteVencidas
                        ? `concluída nunca está vencida: desligue “Só vencidas”${incluirConcluidas ? "" : " e ligue “Mostrar concluídas”"} para vê-las`
                        : "as concluídas não estão nesta consulta: use “Mostrar concluídas”"}
                  </p>
                ) : (
                  porColuna[coluna].map((t) => (
                    <CartaoDeTarefa
                      key={t.id}
                      tarefa={t}
                      movendo={movendo === t.id}
                      onAbrir={() => onAbrir(t.id)}
                      onMover={(destino) => onMover(t.id, destino)}
                    />
                  ))
                )}
              </div>
            </Coluna>
          ))}
        </div>
      </DndContext>
    </>
  );
}

function Coluna({
  coluna,
  children,
}: {
  readonly coluna: ColunaDaTarefa;
  readonly children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna });
  return (
    <section
      ref={setNodeRef}
      aria-label={ROTULO_DA_COLUNA[coluna]}
      className={cn(
        "w-[85vw] shrink-0 snap-start rounded-lg sm:w-[60vw] md:w-auto md:shrink",
        isOver && "ring-2 ring-primary",
      )}
    >
      {children}
    </section>
  );
}
