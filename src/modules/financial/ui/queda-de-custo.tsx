import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { brl } from "@/shared/lib/format";

import { mesEAno, type QuedaDeCusto as Queda } from "../domain/expenses";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

interface QuedaDeCustoProps {
  readonly queda: Queda | null;
  readonly estado: EstadoDaConsulta;
}

export function QuedaDeCusto({ queda, estado }: QuedaDeCustoProps) {
  if (estado === "erro") return <FalhaAoLer oQue="as parcelas em curso" />;
  if (estado === "carregando")
    return <div className="h-16 animate-pulse rounded-xl border bg-card" />;

  if (queda === null) return null;

  const quando = mesEAno(queda.ultimoMes);
  if (quando === null) return null;

  const { moldura, Icone, cor } = aparencia(queda.caiuDeFato);

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${moldura}`}>
      <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${cor}`} aria-hidden />
      <div className="text-xs">
        <p className="font-medium">
          <span className="tabular-nums">{brl(queda.valorQueSai)}</span> em parcelas terminam em{" "}
          <span className="tabular-nums">{quando}</span>.
        </p>
        <Consequencia queda={queda} />
      </div>
    </div>
  );
}

function Consequencia({ queda }: { queda: Queda }) {
  if (queda.caiuDeFato === null) {
    return (
      <p className="mt-0.5 text-muted-foreground">
        O mês seguinte está além da projeção de 12 meses, então o custo de lá ainda não foi
        calculado. Não dá para afirmar que o custo cai.
      </p>
    );
  }

  if (queda.caiuDeFato) {
    return (
      <p className="mt-0.5 text-muted-foreground">
        A partir do mês seguinte o custo do mês cai para{" "}
        <strong className="tabular-nums text-foreground">{brl(queda.custoDepois)}</strong>.
      </p>
    );
  }

  return (
    <p className="mt-0.5 text-muted-foreground">
      Mas o custo <strong className="text-foreground">não cai</strong>: o mês seguinte custa{" "}
      <strong className="tabular-nums text-foreground">{brl(queda.custoDepois)}</strong> contra{" "}
      <span className="tabular-nums">{brl(queda.custoNoMesDoFim)}</span>, porque outras despesas
      entram nele.
    </p>
  );
}

function aparencia(caiu: boolean | null) {
  if (caiu === null) {
    return { moldura: "border-border bg-muted/30", Icone: Minus, cor: "text-muted-foreground" };
  }
  if (caiu) {
    return { moldura: "border-success/40 bg-success/5", Icone: TrendingDown, cor: "text-success" };
  }
  return { moldura: "border-warning/40 bg-warning/5", Icone: TrendingUp, cor: "text-warning" };
}
