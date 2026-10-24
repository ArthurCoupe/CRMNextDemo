import { formatDate, inicioDaSemanaSP } from "@/shared/lib/date";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import { totalDaSemana } from "../domain/funnel";
import { useAtividadeSemanal } from "../hooks/use-pipeline";

export function PlacarSemanal() {
  const semana = inicioDaSemanaSP();
  const atividade = useAtividadeSemanal(semana);
  const estado = estadoDaConsulta(atividade);

  if (estado === "erro") return <FalhaAoLer oQue="a atividade desta semana" />;
  if (estado === "carregando") {
    return <div className="h-[54px] animate-pulse rounded-lg border bg-card" />;
  }

  const total = totalDaSemana(atividade.data ?? [], semana);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-lg border bg-card px-3.5 py-2.5">
      <span className="kicker">Motor da semana</span>

      <Contagem valor={total.toques} rotulo="toques" />
      <Contagem valor={total.r1Marcadas} rotulo="R1 marcadas" />

      <span className="text-[11px] text-muted-foreground">semana de {formatDate(semana)}</span>

      <span className="ml-auto text-[10.5px] text-muted-foreground">
        Atividade é o que você controla. Resultado é consequência.
      </span>
    </div>
  );
}

function Contagem({ valor, rotulo }: { readonly valor: number; readonly rotulo: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <b className="text-[15px] font-bold leading-none tabular-nums">{valor}</b>
      <span className="text-[11px] text-muted-foreground">{rotulo}</span>
    </span>
  );
}
