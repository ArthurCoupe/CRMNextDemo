import { AlertTriangle } from "lucide-react";

import { brl } from "@/shared/lib/format";
import { Money } from "@/shared/ui/money";

import type { BaseDoLiquido } from "../domain/fiscal";
import { useConfiguracaoFiscal, useSimulacaoDeLiquido } from "../hooks/use-fiscal";

export function SimuladorDeLiquido({ base }: { base: BaseDoLiquido | null }) {
  const { liquido, carregando, erro } = useSimulacaoDeLiquido(base);
  const { data: config } = useConfiguracaoFiscal();

  if (carregando) {
    return <div className="h-24 animate-pulse rounded-lg border bg-card" />;
  }

  if (erro) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong>Não foi possível ler as taxas.</strong> O líquido é desconhecido, não é igual ao
          bruto.
        </span>
      </p>
    );
  }

  if (liquido === null) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
        Preencha valor, tipo e meio de pagamento para ver quanto entra de fato.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-baseline justify-between border-b px-3 py-2">
        <span className="kicker">Quanto entra de fato</span>
        <span className="text-[11px] text-muted-foreground">
          {liquido.percentualDeDeducao.toFixed(2).replace(".", ",")}% sai em deduções
        </span>
      </div>

      <dl className="divide-y text-xs">
        <Linha rotulo="Bruto do mês" valor={liquido.bruto} />
        <Linha
          rotulo={`Imposto · ${config?.aliquotaPct.toFixed(2).replace(".", ",") ?? "-"}%`}
          valor={-liquido.imposto}
        />
        <Linha
          rotulo={`Taxa · ${liquido.percentualVariavel.toFixed(2).replace(".", ",")}%`}
          valor={-liquido.taxaVariavel}
        />
        {liquido.taxaFixa > 0 && (
          <Linha rotulo="Taxa fixa por transação" valor={-liquido.taxaFixa} />
        )}
        <div className="flex items-baseline justify-between bg-muted/30 px-3 py-2">
          <dt className="font-medium">Líquido do mês</dt>
          <dd className="text-sm font-semibold tabular-nums text-success">
            {brl(liquido.liquido)}
          </dd>
        </div>
      </dl>

      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Participação de equipe não entra aqui: ela é custo, não dedução de receita.
        {config?.provisoria === true && (
          <>
            {" "}
            <strong className="text-warning">A alíquota está marcada como provisória.</strong>
          </>
        )}
      </p>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  const negativo = valor < 0;
  return (
    <div className="flex items-baseline justify-between px-3 py-1.5">
      <dt className={negativo ? "text-muted-foreground" : undefined}>{rotulo}</dt>
      <dd className={negativo ? "tabular-nums text-muted-foreground" : "tabular-nums"}>
        {negativo && "− "}
        <Money value={Math.abs(valor)} />
      </dd>
    </div>
  );
}
