import { AlertTriangle } from "lucide-react";

import { brl } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

import { ROTULO_DA_BU } from "../domain/expenses";
import {
  conferirResultado,
  rateioFecha,
  ROTULO_DA_SITUACAO,
  type ResultadoDaBu,
  type SituacaoDoMes,
} from "../domain/result";
import type { ResultadoConsolidado } from "../api/result.repository";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

interface MatrizDeResultadoProps {
  readonly linhas: readonly ResultadoDaBu[];
  readonly consolidado: ResultadoConsolidado | null;
  readonly custoCompartilhado: number | null;
  readonly situacao: SituacaoDoMes;
  readonly estado: EstadoDaConsulta;
}

export function MatrizDeResultado({
  linhas,
  consolidado,
  custoCompartilhado,
  situacao,
  estado,
}: MatrizDeResultadoProps) {
  if (estado === "erro") return <FalhaAoLer oQue="o resultado do mês" />;
  if (estado === "carregando")
    return <div className="h-80 animate-pulse rounded-xl border bg-card" />;

  if (linhas.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma linha de negócio com movimento neste mês.
      </div>
    );
  }

  const baseDaConferencia = situacao === "congelado" ? null : custoCompartilhado;
  const divergencias =
    baseDaConferencia === null ? [] : conferirResultado(linhas, baseDaConferencia);
  const fecha = baseDaConferencia === null ? true : rateioFecha(linhas, baseDaConferencia);

  return (
    <div className="space-y-3">
      <SeloDaSituacao situacao={situacao} />

      {divergencias.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="text-[11px] text-destructive">
            <p className="font-medium">
              O que o banco devolveu não bate com a fórmula recalculada aqui.
            </p>
            <ul className="mt-1 space-y-0.5">
              {divergencias.map((d) => (
                <li key={`${d.bu}-${d.grandeza}`} className="tabular-nums">
                  {ROTULO_DA_BU[d.bu]} · {d.grandeza}: banco {d.doBanco ?? "-"}, recalculado{" "}
                  {d.recalculado ?? "-"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!fecha && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[11px] text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            As parcelas do rateio não somam o custo compartilhado do mês. Falta ou sobra dinheiro na
            distribuição entre as frentes.
          </p>
        </div>
      )}

      {baseDaConferencia === null && situacao === "congelado" && (
        <p className="px-0.5 text-[11px] text-muted-foreground">
          A conferência do rateio não roda aqui: estes números são o registro do dia 1º, e o custo
          compartilhado disponível é o de hoje. Silêncio nesta faixa, num mês congelado, não é
          &ldquo;confere&rdquo;, é &ldquo;não há o que reconstruir&rdquo;.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3.5 py-2 text-left font-medium">&nbsp;</th>
              {linhas.map((linha) => (
                <th key={linha.bu} className="px-3.5 py-2 text-right font-medium">
                  {ROTULO_DA_BU[linha.bu]}
                </th>
              ))}
              <th className="px-3.5 py-2 text-right font-semibold text-foreground">Consolidado</th>
            </tr>
          </thead>
          <tbody>
            <Linha
              rotulo="Receita bruta"
              valores={linhas.map((l) => l.receitaBruta)}
              total={consolidado?.receitaBruta ?? null}
            />
            <Linha
              rotulo="(−) Imposto"
              valores={linhas.map((l) => -l.imposto)}
              total={consolidado === null ? null : -consolidado.imposto}
              discreta
            />
            <Linha
              rotulo="(−) Taxas"
              valores={linhas.map((l) => -l.taxas)}
              total={consolidado === null ? null : -consolidado.taxas}
              discreta
            />
            <Linha
              rotulo="= Receita líquida"
              valores={linhas.map((l) => l.receitaLiquida)}
              total={consolidado?.receitaLiquida ?? null}
              forte
            />

            <Linha
              rotulo="(−) Custo direto"
              valores={linhas.map((l) => -l.custoDireto)}
              total={consolidado === null ? null : -consolidado.custoDireto}
            />
            <Linha
              rotulo="gastos"
              valores={linhas.map((l) => -l.custoGastos)}
              total={null}
              discreta
              recuada
            />
            <Linha
              rotulo="folha"
              valores={linhas.map((l) => -l.custoFolha)}
              total={null}
              discreta
              recuada
            />
            <Linha
              rotulo="participação em contratos"
              valores={linhas.map((l) => -l.custoParticipacao)}
              total={null}
              discreta
              recuada
            />

            <Linha
              rotulo="(−) Custo rateado"
              valores={linhas.map((l) => -l.custoRateado)}
              total={consolidado === null ? null : -consolidado.custoRateado}
            />
            <tr className="border-b text-[11px] text-muted-foreground">
              <td className="px-3.5 py-1.5 pl-8">proporção de caixa</td>
              {linhas.map((l) => (
                <td key={l.bu} className="px-3.5 py-1.5 text-right tabular-nums">
                  {l.proporcaoPct === null ? "-" : `${l.proporcaoPct.toFixed(1)}%`}
                </td>
              ))}
              <td className="px-3.5 py-1.5 text-right tabular-nums">
                {baseDaConferencia === null ? "-" : brl(baseDaConferencia)}
              </td>
            </tr>

            {consolidado !== null && consolidado.custoCompartilhadoNaoRateado > 0 && (
              <tr className="border-b text-[11px] text-warning">
                <td className="px-3.5 py-1.5 pl-8">
                  compartilhado que não coube em frente nenhuma
                </td>
                {linhas.map((l) => (
                  <td key={l.bu} className="px-3.5 py-1.5 text-right tabular-nums">
                    -
                  </td>
                ))}
                <td className="px-3.5 py-1.5 text-right tabular-nums">
                  {brl(-consolidado.custoCompartilhadoNaoRateado)}
                </td>
              </tr>
            )}

            <Linha
              rotulo="= Resultado"
              valores={linhas.map((l) => l.resultado)}
              total={consolidado?.resultado ?? null}
              forte
              colorido
            />
            <tr className="bg-muted/20 text-sm font-semibold">
              <td className="px-3.5 py-2">Margem</td>
              {linhas.map((l) => (
                <td
                  key={l.bu}
                  className={cn(
                    "px-3.5 py-2 text-right tabular-nums",
                    l.margemPct === null
                      ? "text-muted-foreground"
                      : l.margemPct >= 0
                        ? "text-success"
                        : "text-destructive",
                  )}
                >
                  {l.margemPct === null ? "-" : `${l.margemPct.toFixed(1)}%`}
                </td>
              ))}
              <td
                className={cn(
                  "px-3.5 py-2 text-right tabular-nums",
                  consolidado?.margemPct == null
                    ? "text-muted-foreground"
                    : consolidado.margemPct >= 0
                      ? "text-success"
                      : "text-destructive",
                )}
              >
                {consolidado?.margemPct == null ? "-" : `${consolidado.margemPct.toFixed(1)}%`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cada célula vem somada do Postgres: a tela não soma nada. O custo compartilhado do mês é
        distribuído entre as frentes pela proporção de <strong>caixa bruto</strong>, e a
        participação em contratos aparece <strong>uma vez só</strong>, dentro do custo direto.
      </p>
    </div>
  );
}

function SeloDaSituacao({ situacao }: { situacao: SituacaoDoMes }) {
  const cor =
    situacao === "congelado"
      ? "border-success/40 bg-success/10 text-success"
      : situacao === "parcial"
        ? "border-primary/40 bg-primary/10 text-primary-texto"
        : "border-warning/40 bg-warning/10 text-warning";

  return (
    <p className={cn("inline-flex rounded-md border px-2 py-0.5 text-[11px]", cor)}>
      {ROTULO_DA_SITUACAO[situacao]}
    </p>
  );
}

function Linha({
  rotulo,
  valores,
  total,
  forte = false,
  discreta = false,
  recuada = false,
  colorido = false,
}: {
  rotulo: string;
  valores: readonly number[];
  total: number | null;
  forte?: boolean;
  discreta?: boolean;
  recuada?: boolean;
  colorido?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b last:border-0",
        forte && "bg-muted/20 font-semibold",
        discreta && "text-[11px] text-muted-foreground",
        recuada && "text-[11px]",
      )}
    >
      <td className={cn("px-3.5 py-2", recuada && "pl-8")}>{rotulo}</td>
      {valores.map((valor, i) => (
        <td
          key={i}
          className={cn(
            "px-3.5 py-2 text-right tabular-nums",
            colorido && (valor >= 0 ? "text-success" : "text-destructive"),
          )}
        >
          {brl(valor)}
        </td>
      ))}
      <td
        className={cn(
          "px-3.5 py-2 text-right tabular-nums",
          colorido && total !== null && (total >= 0 ? "text-success" : "text-destructive"),
        )}
      >
        {total === null ? "-" : brl(total)}
      </td>
    </tr>
  );
}
