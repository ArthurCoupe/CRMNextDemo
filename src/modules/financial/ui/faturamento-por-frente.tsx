import { frenteLabel, linhaDeNegocioLabel } from "@/modules/contracts/domain/contract";
import { EmptyState } from "@/shared/ui/empty-state";
import { Money } from "@/shared/ui/money";

import type { LinhaDeFaturamento } from "../domain/receita";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

interface FaturamentoPorFrenteProps {
  readonly linhas: readonly LinhaDeFaturamento[];
  readonly totalDeCaixaDoMes: number;
  readonly estado: EstadoDaConsulta;
}

export function FaturamentoPorFrente({
  linhas,
  totalDeCaixaDoMes,
  estado,
}: FaturamentoPorFrenteProps) {
  if (estado === "erro") {
    return <FalhaAoLer oQue="o faturamento por frente" />;
  }

  if (estado === "carregando") {
    return <div className="h-40 animate-pulse rounded-xl border bg-card" />;
  }

  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma frente faturando"
        description="Nenhum contrato ativo com cobrança em andamento. Feche um negócio no Pipeline para a primeira linha aparecer."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 pb-1 pt-3 text-left font-medium" />
            <th className="px-3 pb-1 pt-3 text-center font-medium" colSpan={2}>
              não somáveis entre si
            </th>
            <th className="border-l px-3 pb-1 pt-3 text-center font-medium text-foreground">
              comparável entre frentes
            </th>
          </tr>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Frente</th>
            <th className="px-3 py-2 text-right font-medium">MRR mensal</th>
            <th className="px-3 py-2 text-right font-medium">TCV contratado</th>
            <th className="border-l px-3 py-2 text-right font-medium text-foreground">
              Caixa do mês
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={`${linha.frente}-${linha.linhaDeNegocio}`} className="border-b last:border-0">
              <td className="px-3 py-2.5">
                <span className="font-medium">{frenteLabel(linha.frente)}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {linhaDeNegocioLabel(linha.linhaDeNegocio)}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right">
                <ValorComUnidade valor={linha.mrrMensal} unidade="/mês" />
              </td>
              <td className="px-3 py-2.5 text-right">
                <ValorComUnidade valor={linha.tcvTotal} unidade="total" />
              </td>
              <td className="border-l px-3 py-2.5 text-right">
                <ValorComUnidade valor={linha.caixaMes} unidade="/mês" destaque />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/30 text-sm">
            <td className="px-3 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Total
            </td>
            <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground/60">-</td>
            <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground/60">-</td>
            <td className="border-l px-3 py-2.5 text-right font-semibold">
              <ValorComUnidade valor={totalDeCaixaDoMes} unidade="/mês" destaque />
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Só o caixa do mês soma. MRR é fluxo mensal e TCV é estoque contratado: grandezas diferentes,
        e o total delas não significaria nada.
      </p>
    </div>
  );
}

function ValorComUnidade({
  valor,
  unidade,
  destaque = false,
}: {
  valor: number;
  unidade: string;
  destaque?: boolean;
}) {
  if (valor === 0) {
    return <span className="text-muted-foreground/50">-</span>;
  }
  return (
    <span className={destaque ? "font-medium" : undefined}>
      <Money value={valor} />
      <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unidade}</span>
    </span>
  );
}
