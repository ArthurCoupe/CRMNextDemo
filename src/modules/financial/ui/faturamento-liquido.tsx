import { brl } from "@/shared/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/ui/empty-state";
import { Money } from "@/shared/ui/money";

import type { LiquidoDoContrato, TotalDoLiquido } from "../api/fiscal.repository";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

const ROTULO_DO_MEIO: Record<string, string> = {
  pix: "Pix",
  credito: "Cartão",
  transferencia: "Transferência",
};

interface FaturamentoLiquidoProps {
  readonly linhas: readonly LiquidoDoContrato[];
  readonly total: TotalDoLiquido | null;
  readonly estado: EstadoDaConsulta;
}

export function FaturamentoLiquido({ linhas, total, estado }: FaturamentoLiquidoProps) {
  if (estado === "erro") return <FalhaAoLer oQue="o faturamento líquido" />;
  if (estado === "carregando")
    return <div className="h-40 animate-pulse rounded-xl border bg-card" />;

  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Nenhum contrato com cobrança ativa"
        description="Feche um negócio no Pipeline para ver quanto entra depois de imposto e taxa."
      />
    );
  }

  const pctTotal = total === null || total.bruto === 0 ? 0 : (total.deducoes / total.bruto) * 100;
  const algumaProvisoria = linhas.some((l) => l.provisoria);
  const foraDaJanela = linhas.filter((l) => !l.faturaNoMes);
  const aindaNaoComecaram = foraDaJanela.filter((l) => l.inicioFuturo).length;
  const encerrados = foraDaJanela.filter((l) => !l.inicioFuturo);
  const algumTcvEncerrado = encerrados.some((l) => l.tipo === "tcv");

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Cliente</th>
            <th className="px-3 py-2 text-right font-medium">Bruto/mês</th>
            <th className="px-3 py-2 text-right font-medium">Deduções</th>
            <th className="px-3 py-2 text-right font-medium text-foreground">Líquido/mês</th>
            <th className="px-3 py-2 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const deducoes = linha.imposto + linha.taxaVariavel + linha.taxaFixa;
            const pct = linha.bruto === 0 ? 0 : (deducoes / linha.bruto) * 100;
            return (
              <tr
                key={linha.contratoId}
                className={cn("border-b last:border-0", !linha.faturaNoMes && "opacity-55")}
              >
                <td className="px-3 py-2.5">
                  <span className="font-medium">{linha.cliente}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    {ROTULO_DO_MEIO[linha.meioDePagamento] ?? linha.meioDePagamento}
                    {linha.meioDePagamento === "credito" && ` ${linha.parcelas}×`}
                  </span>
                  {!linha.faturaNoMes && (
                    <span className="ml-2 text-[11px] font-medium text-warning">
                      {linha.inicioFuturo ? "ainda não começou" : "não fatura neste mês"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Money value={linha.bruto} />
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">
                  − <Money value={deducoes} />
                </td>
                <td className="px-3 py-2.5 text-right font-medium">
                  <Money value={linha.liquido} />
                </td>
                <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground tabular-nums">
                  {pct.toFixed(1).replace(".", ",")}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/30">
            <td className="px-3 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Total
              {foraDaJanela.length > 0 && <span className="normal-case"> · só quem fatura</span>}
            </td>
            <td className="px-3 py-2.5 text-right font-medium">
              {total === null ? "-" : <Money value={total.bruto} />}
            </td>
            <td className="px-3 py-2.5 text-right text-muted-foreground">
              {total === null ? (
                "-"
              ) : (
                <>
                  − <Money value={total.deducoes} />
                </>
              )}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold text-success">
              {total === null ? "-" : brl(total.liquido)}
            </td>
            <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-muted-foreground">
              {total === null ? "-" : `${pctTotal.toFixed(1).replace(".", ",")}%`}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Participação de equipe não está deduzida aqui: ela é custo, e entra no resultado (F15).
        Deduzi-la da receita <em>e</em> somá-la ao custo contaria o mesmo dinheiro duas vezes.
        {aindaNaoComecaram > 0 && (
          <>
            {" "}
            <strong className="text-warning">
              {aindaNaoComecaram === 1
                ? "Um contrato ainda não começou a faturar e não entra no total"
                : `${aindaNaoComecaram} contratos ainda não começaram a faturar e não entram no total`}
              : o início está num mês futuro.
            </strong>
          </>
        )}
        {encerrados.length > 0 && (
          <>
            {" "}
            <strong className="text-warning">
              {encerrados.length === 1
                ? "Um contrato já encerrou a janela de cobrança e não entra no total"
                : `${encerrados.length} contratos já encerraram a janela de cobrança e não entram no total`}
              : a cobrança acabou.{" "}
              {algumTcvEncerrado
                ? "TCV vencido é fechado pelo encerramento automático das 06:00 (salvo o que foi revertido); MRR encerra pela ficha do contrato."
                : "MRR encerra pela ficha do contrato. O encerramento automático só fecha TCV."}
            </strong>
          </>
        )}
        {algumaProvisoria && (
          <>
            {" "}
            <strong className="text-warning">
              A alíquota vigente está marcada como provisória: estes números são estimativa.
            </strong>
          </>
        )}
      </p>
    </div>
  );
}
