import { AlertTriangle, CalendarClock, Clock, Target, TrendingDown, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

import { mesEAno, ROTULO_DA_BU } from "../domain/expenses";
import { progressoDaMeta } from "../domain/result";
import type { BreakEven, EncerramentoAutomatico, MetaDeMrr } from "../api/result.repository";
import type { QuedaDeCusto } from "../domain/expenses";
import type { ProjetoAtrasado } from "../domain/receita";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";

export function CardsDoResultado({
  breakEven,
  estadoDoBreakEven,
  queda,
  estadoDaQueda,
  meta,
  estadoDaMeta,
  mrrFirme,
  atrasados,
  estadoDosAtrasados,
  encerramentos,
  estadoDosEncerramentos,
  onReverter,
  revertendo,
}: {
  readonly breakEven: BreakEven | null;
  readonly estadoDoBreakEven: EstadoDaConsulta;
  readonly queda: QuedaDeCusto | null;
  readonly estadoDaQueda: EstadoDaConsulta;
  readonly meta: MetaDeMrr | undefined;
  readonly estadoDaMeta: EstadoDaConsulta;
  readonly mrrFirme: number | null;
  readonly atrasados: readonly ProjetoAtrasado[];
  readonly estadoDosAtrasados: EstadoDaConsulta;
  readonly encerramentos: readonly EncerramentoAutomatico[];
  readonly estadoDosEncerramentos: EstadoDaConsulta;
  readonly onReverter: (contractId: string) => void;
  readonly revertendo: string | undefined;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <CardBreakEven breakEven={breakEven} estado={estadoDoBreakEven} />
      <CardQueda queda={queda} estado={estadoDaQueda} />
      <CardMeta meta={meta} mrrFirme={mrrFirme} estado={estadoDaMeta} />
      <CardAtrasados projetos={atrasados} estado={estadoDosAtrasados} />
      <CardEncerramentos
        encerramentos={encerramentos}
        estado={estadoDosEncerramentos}
        onReverter={onReverter}
        revertendo={revertendo}
      />
    </div>
  );
}

function estadoAntesDeAfirmar(estado: EstadoDaConsulta): React.ReactNode | null {
  if (estado === "erro")
    return <p className="text-xs font-medium text-destructive">desconhecido</p>;
  if (estado === "carregando") return <p className="text-xs text-muted-foreground">carregando…</p>;
  return null;
}

function Moldura({
  icone: Icone,
  titulo,
  children,
  alerta = false,
}: {
  icone: typeof Users;
  titulo: string;
  children: React.ReactNode;
  alerta?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-3.5", alerta && "border-warning/40")}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icone className="h-3.5 w-3.5" aria-hidden />
        {titulo}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function CardBreakEven({
  breakEven,
  estado,
}: {
  breakEven: BreakEven | null;
  estado: EstadoDaConsulta;
}) {
  return (
    <Moldura icone={Users} titulo="Break-even em clientes">
      {estado === "erro" ? (
        <p className="text-xs font-medium text-destructive">desconhecido</p>
      ) : estado === "carregando" ? (
        <p className="text-xs text-muted-foreground">calculando…</p>
      ) : breakEven === null || breakEven.clientesParaPagar === null ? (
        <>
          <p className="text-2xl font-semibold tabular-nums">-</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Sem contrato de MRR faturando neste mês, não há ticket médio para dividir.
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums">{breakEven.clientesParaPagar}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            clientes de MRR pagam o custo fixo de {brl(breakEven.custoFixoTotal)} · ticket médio{" "}
            <strong className="font-medium">líquido {brl(breakEven.ticketMedioMrr)}</strong> (bruto{" "}
            {brl(breakEven.ticketMedioBruto)}) em {breakEven.contratosMrr}{" "}
            {breakEven.contratosMrr === 1 ? "contrato" : "contratos"}
          </p>
        </>
      )}
    </Moldura>
  );
}

function CardQueda({ queda, estado }: { queda: QuedaDeCusto | null; estado: EstadoDaConsulta }) {
  const mes = queda === null ? null : mesEAno(queda.ultimoMes);
  const naoSabe = estadoAntesDeAfirmar(estado);

  return (
    <Moldura icone={TrendingDown} titulo="Custo temporário que sai">
      {naoSabe ??
        (queda === null || mes === null ? (
          <>
            <p className="text-2xl font-semibold tabular-nums">-</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Nenhum parcelamento termina nos próximos 12 meses.
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums">{brl(queda.valorQueSai)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              última parcela em {mes}
              {queda.caiuDeFato === false &&
                " · mas o mês seguinte custa MAIS: outra despesa entrou nele"}
            </p>
          </>
        ))}
    </Moldura>
  );
}

function CardMeta({
  meta,
  mrrFirme,
  estado,
}: {
  meta: MetaDeMrr | undefined;
  mrrFirme: number | null;
  estado: EstadoDaConsulta;
}) {
  const progresso =
    meta?.valor == null || mrrFirme === null ? null : progressoDaMeta(mrrFirme, meta.valor);
  const naoSabe = estadoAntesDeAfirmar(estado);

  return (
    <Moldura icone={Target} titulo="Meta de MRR" alerta={meta?.confirmada === false}>
      {naoSabe ??
        (meta?.valor == null ? (
          <>
            <p className="text-2xl font-semibold tabular-nums">-</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Nenhuma meta em <code>app_settings.metas</code>.
            </p>
          </>
        ) : (
          <>
            <p className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums">
                {progresso === null ? "-" : `${Math.round(progresso * 100)}%`}
              </span>
              {!meta.confirmada && (
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 text-[10px] font-normal text-warning"
                >
                  meta não confirmada
                </Badge>
              )}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full", meta.confirmada ? "bg-primary" : "bg-warning/70")}
                style={{ width: `${Math.min(100, Math.max(0, (progresso ?? 0) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {mrrFirme === null ? "MRR firme desconhecido" : brl(mrrFirme)} de {brl(meta.valor)}
              {!meta.confirmada && " · o alvo ainda não foi confirmado por ninguém"}
            </p>
          </>
        ))}
    </Moldura>
  );
}

function CardAtrasados({
  projetos,
  estado,
}: {
  projetos: readonly ProjetoAtrasado[];
  estado: EstadoDaConsulta;
}) {
  const pior = projetos.reduce<ProjetoAtrasado | null>(
    (maior, p) => (maior === null || p.diasDeAtraso > maior.diasDeAtraso ? p : maior),
    null,
  );

  const naoSabe = estadoAntesDeAfirmar(estado);

  return (
    <Moldura icone={Clock} titulo="Projeto atrasado" alerta={pior !== null}>
      {naoSabe ??
        (pior === null ? (
          <>
            <p className="text-2xl font-semibold tabular-nums">0</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Nenhum projeto além do prazo de entrega.
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums">{projetos.length}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              pior: {pior.cliente} · {pior.diasDeAtraso} {pior.diasDeAtraso === 1 ? "dia" : "dias"}{" "}
              · {brl(pior.parcelaMensal)} de custo por mês além do prazo
            </p>
          </>
        ))}
    </Moldura>
  );
}

function CardEncerramentos({
  encerramentos,
  estado,
  onReverter,
  revertendo,
}: {
  encerramentos: readonly EncerramentoAutomatico[];
  estado: EstadoDaConsulta;
  onReverter: (contractId: string) => void;
  revertendo: string | undefined;
}) {
  const naoSabe = estadoAntesDeAfirmar(estado);

  return (
    <Moldura
      icone={encerramentos.length > 0 ? AlertTriangle : CalendarClock}
      titulo="Encerrados pelo sistema"
      alerta={encerramentos.length > 0}
    >
      {naoSabe ??
        (encerramentos.length === 0 ? (
          <>
            <p className="text-2xl font-semibold tabular-nums">0</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Nenhum TCV foi fechado automaticamente. O job roda às 06:00.
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums">{encerramentos.length}</p>
            <ul className="mt-0.5 space-y-0.5">
              {encerramentos.map((e) => (
                <li
                  key={e.contractId}
                  className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                >
                  <span className="truncate">
                    {e.cliente} · {ROTULO_DA_BU[e.bu as keyof typeof ROTULO_DA_BU] ?? e.bu}
                    {e.valorTotal !== null && ` · ${brl(e.valorTotal)}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-2 text-xs"
                    aria-label={`Reverter ${e.cliente} · ${e.contrato}`}
                    disabled={revertendo === e.contractId}
                    onClick={() => onReverter(e.contractId)}
                  >
                    {revertendo === e.contractId ? "Revertendo…" : "Reverter (renovou)"}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ))}
    </Moldura>
  );
}
