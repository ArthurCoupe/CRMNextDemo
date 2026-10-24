import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate, formatDateTime, horaSP, somaDias, todaySP } from "@/shared/lib/date";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { PlacarDaPassada } from "../domain/passada";
import { useUltimaPassada } from "../hooks/use-notifications";

const HORA_DE_CORTE_DO_CRON = 9;

export function UltimaPassada() {
  const { papel } = useProfile();
  const consulta = useUltimaPassada();
  const estado = estadoDaConsulta(consulta);

  if (estado === "erro") return <FalhaAoLer oQue="a última passada de avisos" />;
  if (estado === "carregando") {
    return <div className="h-14 animate-pulse rounded-xl border bg-card" />;
  }

  const data = consulta.data ?? null;
  if (data === null) {
    return papel === "owner" ? <NuncaCarimbou /> : null;
  }

  const hoje = todaySP();
  const ontem = somaDias(hoje, -1);
  const rodouHojeOk = data.dia === hoje && data.ok;
  const eDeOntem = data.dia === ontem;
  const maisDeUmDiaAtras = data.dia !== hoje && !eDeOntem;
  const cronJaDeveriaTerRodado = horaSP() >= HORA_DE_CORTE_DO_CRON;
  const estaAtrasada = maisDeUmDiaAtras || (eDeOntem && cronJaDeveriaTerRodado);
  const aindaNaJanelaDoCron = eDeOntem && !cronJaDeveriaTerRodado;

  return (
    <Card className="space-y-2 p-4 shadow-card">
      {rodouHojeOk && <LinhaEmDia terminouEm={data.terminouEm} contadores={data.contadores} />}
      {estaAtrasada && <LinhaAtrasada dia={data.dia} />}
      {aindaNaJanelaDoCron && <LinhaAindaNaoRodou />}
      {!data.ok && <LinhaComErro erro={data.erro} />}
      {data.problemas.length > 0 && <ListaDeProblemas problemas={data.problemas} />}
    </Card>
  );
}

function NuncaCarimbou() {
  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-start gap-2 text-xs font-medium text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Nenhuma passada de avisos foi registrada ainda. Isto não é uma leitura tranquila do banco.
          É o alarme: ou a passada nunca rodou, ou morreu antes de conseguir gravar o carimbo.
        </span>
      </div>
    </Card>
  );
}

function LinhaEmDia({
  terminouEm,
  contadores,
}: {
  readonly terminouEm: string;
  readonly contadores: Readonly<Record<string, PlacarDaPassada>>;
}) {
  const totais = Object.values(contadores).reduce(
    (soma, placar) => ({
      enviados: soma.enviados + placar.enviados,
      duplicados: soma.duplicados + placar.duplicados,
      falhas: soma.falhas + placar.falhas,
    }),
    { enviados: 0, duplicados: 0, falhas: 0 },
  );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
      <span>Última passada: {formatDateTime(terminouEm)}.</span>
      <span className="tabular-nums">
        <strong className="text-foreground">{totais.enviados}</strong> enviados ·{" "}
        <strong className="text-foreground">{totais.duplicados}</strong> duplicados ·{" "}
        <strong className="text-foreground">{totais.falhas}</strong> falhas
      </span>
    </div>
  );
}

function LinhaAindaNaoRodou() {
  return (
    <p className="text-xs text-muted-foreground">
      A passada de hoje ainda não rodou. O cron dispara por volta das 8h de São Paulo.
    </p>
  );
}

function LinhaAtrasada({ dia }: { readonly dia: string }) {
  return (
    <div className="flex items-start gap-2 text-xs font-medium text-warning">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        A última passada foi em {formatDate(dia)}. O cron roda às 8h de São Paulo, e hoje não gravou
        nada.
      </span>
    </div>
  );
}

function LinhaComErro({ erro }: { readonly erro: string | null }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
      <div>
        <Badge variant="destructive">A última passada falhou</Badge>
        <p className="mt-1 text-muted-foreground">
          {erro ?? "Um ou mais alertas caíram. As linhas em vermelho abaixo dizem quais."}
        </p>
      </div>
    </div>
  );
}

function ListaDeProblemas({ problemas }: { readonly problemas: readonly string[] }) {
  return (
    <ul className="space-y-1 border-t pt-2 text-[12px] text-muted-foreground">
      {problemas.map((problema, indice) => (
        <li
          key={`${indice}-${problema}`}
          className={problema.startsWith("falha:") ? "text-destructive" : undefined}
        >
          · {problema}
        </li>
      ))}
    </ul>
  );
}
