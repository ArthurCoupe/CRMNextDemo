import { AlertTriangle } from "lucide-react";

import { linhaDeNegocioLabel } from "@/modules/contracts/domain/contract";
import { brl } from "@/shared/lib/format";
import { KpiCard } from "@/shared/ui/kpi-card";
import type { LinhaDeNegocio } from "@/modules/contracts/domain/contract";

import type { CelulaDeMrr, CelulaDeTcv } from "../domain/receita";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

interface MatrizDeReceitaProps {
  readonly mrr: readonly CelulaDeMrr[];
  readonly tcv: readonly CelulaDeTcv[];
  readonly foraDaMatriz: readonly LinhaDeNegocio[];
  readonly estado: EstadoDaConsulta;
}

export function MatrizDeReceita({ mrr, tcv, foraDaMatriz, estado }: MatrizDeReceitaProps) {
  if (estado === "erro") {
    return <FalhaAoLer oQue="a receita contratada" />;
  }

  if (estado === "carregando") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Faixa
        titulo="MRR"
        grandeza="por mês · fluxo"
        explicacao="Entra todo mês, sem fim programado."
      >
        {mrr.map((celula) => (
          <KpiCard
            key={celula.linhaDeNegocio}
            label={`MRR · ${linhaDeNegocioLabel(celula.linhaDeNegocio)}`}
            value={brl(celula.total)}
            accent={celula.total > 0 ? "sucesso" : "neutro"}
            detail={
              <>
                firme <span className="tabular-nums">{brl(celula.firme)}</span> · {celula.contratos}{" "}
                {celula.contratos === 1 ? "contrato" : "contratos"}
              </>
            }
          />
        ))}
      </Faixa>

      <Faixa
        titulo="TCV"
        grandeza="contratado · estoque"
        explicacao="O contrato inteiro, uma vez. Não é comparável com o MRR acima."
      >
        {tcv.map((celula) => (
          <KpiCard
            key={celula.linhaDeNegocio}
            label={`TCV · ${linhaDeNegocioLabel(celula.linhaDeNegocio)}`}
            value={brl(celula.total)}
            accent={celula.total > 0 ? "primario" : "neutro"}
            detail={`${celula.projetos} ${celula.projetos === 1 ? "projeto" : "projetos"}`}
          />
        ))}
      </Faixa>

      {foraDaMatriz.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            O banco devolveu {foraDaMatriz.length === 1 ? "a linha" : "as linhas"}{" "}
            <strong>{foraDaMatriz.join(", ")}</strong>, que esta matriz não exibe. Os cards acima
            estão <strong>incompletos</strong>.
          </span>
        </p>
      )}
    </div>
  );
}

function Faixa({
  titulo,
  grandeza,
  explicacao,
  children,
}: {
  titulo: string;
  grandeza: string;
  explicacao: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="kicker">{titulo}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{grandeza}</span>
        <span className="text-[11px] text-muted-foreground/70">{explicacao}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}
