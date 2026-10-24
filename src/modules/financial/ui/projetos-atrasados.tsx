import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Money } from "@/shared/ui/money";

import type { ProjetoAtrasado } from "../domain/receita";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

interface ProjetosAtrasadosProps {
  readonly projetos: readonly ProjetoAtrasado[];
  readonly estado: EstadoDaConsulta;
  readonly onMarcarEntregue: (contractId: string) => void;
  readonly marcando: string | undefined;
}

export function ProjetosAtrasados({
  projetos,
  estado,
  onMarcarEntregue,
  marcando,
}: ProjetosAtrasadosProps) {
  if (estado === "erro") {
    return <FalhaAoLer oQue="os projetos com entrega vencida" />;
  }

  if (estado === "carregando") {
    return <div className="h-14 animate-pulse rounded-xl border bg-card" />;
  }

  if (projetos.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
        Nenhum projeto além do prazo de entrega.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {projetos.map((projeto) => (
        <div
          key={projeto.id}
          className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs"
        >
          <p className="flex items-start gap-2 font-medium text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {projeto.cliente} · {projeto.projeto}: <strong>{projeto.diasDeAtraso} dias</strong>{" "}
              além do prazo
            </span>
          </p>
          <p className="mt-1 pl-[22px] text-muted-foreground">
            Receita de <Money value={projeto.valorTotal} /> já integralmente reconhecida; custo de
            equipe segue correndo. Equivale a{" "}
            <strong>
              <Money value={projeto.parcelaMensal} />
            </strong>{" "}
            por mês de entrega adicional.
          </p>
          <div className="mt-2 pl-[22px]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={marcando === projeto.id}
              onClick={() => onMarcarEntregue(projeto.id)}
            >
              {marcando === projeto.id ? "Registrando…" : "Marcar como entregue"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
