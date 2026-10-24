import { brl } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/empty-state";
import { Money } from "@/shared/ui/money";

import { mesEAno, type MesProjetado } from "../domain/expenses";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

interface ProjecaoDeCustoProps {
  readonly meses: readonly MesProjetado[];
  readonly estado: EstadoDaConsulta;
}

export function ProjecaoDeCusto({ meses, estado }: ProjecaoDeCustoProps) {
  if (estado === "erro") return <FalhaAoLer oQue="a projeção de custo" />;
  if (estado === "carregando")
    return <div className="h-56 animate-pulse rounded-xl border bg-card" />;

  if (meses.length === 0) {
    return (
      <EmptyState
        title="Nada a projetar"
        description="Sem despesa cadastrada não há custo para os próximos meses."
      />
    );
  }

  const teto = Math.max(...meses.map((m) => m.custoTotal), 0);
  const primeiro = meses[0].custoTotal;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Mês</th>
            <th className="px-3 py-2 text-right font-medium">Demanda</th>
            <th className="px-3 py-2 text-right font-medium">Sistemas</th>
            <th className="px-3 py-2 text-right font-medium">Compartilhado</th>
            <th className="px-3 py-2 text-right font-medium text-foreground">Total</th>
            <th className="w-28 px-3 py-2 text-left font-medium">vs. este mês</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((mes, indice) => {
            const rotulo = mesEAno(mes.mes) ?? mes.mes;
            const diferenca = mes.custoTotal - primeiro;
            return (
              <tr key={mes.mes} className="border-b last:border-0">
                <td className="px-3 py-2 tabular-nums">
                  {rotulo}
                  {indice === 0 && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      atual
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  <Money value={mes.custoDemanda} />
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  <Money value={mes.custoSistemas} />
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  <Money value={mes.custoCompartilhado} />
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  <Money value={mes.custoTotal} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: teto === 0 ? "0%" : `${(mes.custoTotal / teto) * 100}%` }}
                      />
                    </div>
                    <span
                      className={
                        diferenca < 0
                          ? "w-16 shrink-0 text-right text-[11px] tabular-nums text-success"
                          : diferenca > 0
                            ? "w-16 shrink-0 text-right text-[11px] tabular-nums text-warning"
                            : "w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
                      }
                    >
                      {diferenca === 0
                        ? "-"
                        : `${diferenca > 0 ? "+" : "−"}${brl(Math.abs(diferenca))}`}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Gastos <strong>mais folha</strong>: a F14 fez a folha entrar nesta conta por view, sem
        digitação dupla. O que ainda não entra é a participação em contratos (a terceira parcela do
        custo), e o resultado (receita líquida menos custo) é a F15.
      </p>
    </div>
  );
}
