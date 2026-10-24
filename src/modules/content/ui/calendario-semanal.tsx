import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dataEHoraSP, inicioDaSemanaSP, somaDias, todaySP } from "@/shared/lib/date";

import type { PostDoQuadro } from "../api/content.repository";
import { COR_DO_STATUS, ROTULO_DO_STATUS } from "../domain/post";
import { estaAtrasado } from "../domain/prazos";
import { agruparPorDia, rotuloDaSemana, rotuloDoDia } from "../domain/semana";

export function CalendarioSemanal({
  inicio,
  carregando,
  posts,
  agora,
  onAbrir,
  onSemana,
}: {
  readonly inicio: string;
  readonly carregando: boolean;
  readonly posts: readonly PostDoQuadro[];
  readonly agora: Date;
  readonly onAbrir: (post: PostDoQuadro) => void;
  readonly onSemana: (inicio: string) => void;
}) {
  const grupos = agruparPorDia(posts, inicio);
  const hoje = todaySP(agora);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSemana(somaDias(inicio, -7))}
        >
          Semana anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSemana(inicioDaSemanaSP(agora))}
        >
          Esta semana
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSemana(somaDias(inicio, 7))}
        >
          Próxima semana
        </Button>
        <span className="text-sm text-muted-foreground">{rotuloDaSemana(inicio)}</span>
      </div>
      <ol className="grid grid-cols-1 gap-2 md:grid-cols-7">
        {[...grupos].map(([dia, doDia]) => (
          <li
            key={dia}
            data-dia={dia}
            aria-current={dia === hoje ? "date" : undefined}
            className={cn("rounded-lg border bg-card p-2", dia === hoje && "border-primary")}
          >
            <h3 className="mb-1 text-xs font-medium">
              {rotuloDoDia(dia)}
              {dia === hoje && " · hoje"}
            </h3>
            {carregando ? (
              <p className="text-[11px] text-muted-foreground">Carregando…</p>
            ) : doDia.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">-</p>
            ) : (
              <ul className="space-y-1">
                {doDia.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onAbrir(p)}
                      className={cn(
                        "w-full rounded px-1.5 py-1 text-left text-xs",
                        COR_DO_STATUS[p.status],
                      )}
                    >
                      <span className="tabular-nums">{dataEHoraSP(p.agendadoPara).hora}</span>{" "}
                      {p.titulo}{" "}
                      <span className="text-[10px] opacity-80">({ROTULO_DO_STATUS[p.status]})</span>
                      {estaAtrasado(p, agora) && (
                        <>
                          {" "}
                          <span className="rounded bg-destructive-soft px-1 text-destructive">
                            Atrasado
                          </span>
                        </>
                      )}
                      <span className="block truncate text-[11px] opacity-80">{p.clienteNome}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
