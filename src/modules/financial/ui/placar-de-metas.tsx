import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  hojeEmSaoPaulo,
  indiceDoMes,
  primeiroDiaDoMes,
  type DataISO,
} from "@/modules/financial/domain/mes-civil";
import { progressoParaBarra } from "@/modules/financial/domain/result";
import { useBreakEven } from "@/modules/financial/hooks/use-result";
import { useMetasFinanceiras } from "@/modules/settings/hooks/use-settings";
import { brl } from "@/shared/lib/format";
import { estadoDaConsulta, piorEstado } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

function mesCorrente(): DataISO | null {
  const indice = indiceDoMes(hojeEmSaoPaulo());
  return indice === null ? null : primeiroDiaDoMes(indice);
}

export function PlacarDeMetas() {
  const breakEven = useBreakEven(mesCorrente());
  const metas = useMetasFinanceiras();
  const estado = piorEstado(estadoDaConsulta(breakEven), estadoDaConsulta(metas));

  if (estado === "erro") {
    return (
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Placar de metas
        </h2>
        <FalhaAoLer oQue="o placar de metas" />
      </Card>
    );
  }

  if (estado === "carregando") {
    return (
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Placar de metas
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-[84px] animate-pulse rounded-lg border bg-card" />
          <div className="h-[84px] animate-pulse rounded-lg border bg-card" />
        </div>
      </Card>
    );
  }

  const firme = breakEven.data?.mrrFirmeTotal ?? null;
  const confirmado = metas.data?.confirmado ?? false;
  const progresso =
    firme === null ? null : progressoParaBarra(firme, metas.data?.mrrMensal ?? null);
  const clientes = breakEven.data?.clientesParaPagar ?? null;

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Placar de metas
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="kicker text-muted-foreground">Meta de MRR firme</p>
          {progresso === null ? (
            <>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {firme === null ? "-" : brl(firme)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Meta não definida. Configure em Configurações.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums">{brl(firme ?? 0)}</span>
                {!confirmado && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 text-[10px] font-normal text-warning"
                  >
                    meta não confirmada
                  </Badge>
                )}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", confirmado ? "bg-primary" : "bg-warning/70")}
                  style={{ width: `${progresso.percentual}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {progresso.percentual}% da meta ·{" "}
                {progresso.falta === 0 ? "meta batida" : `faltam ${brl(progresso.falta)}`}
                {!confirmado && " · o alvo ainda não foi confirmado por ninguém"}
              </p>
            </>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Conta só a receita <strong>firme</strong> que fatura neste mês: é um subconjunto do card
            MRR ativo, que não filtra firme nem mês. Firme é receita garantida: promoção, valor
            reduzido e período de teste ficam de fora.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="kicker text-muted-foreground">Break-even em clientes MRR</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {clientes === null ? "-" : clientes}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {clientes === null
              ? "sem contrato MRR faturando: não há ticket para dividir"
              : `custo fixo ${brl(breakEven.data?.custoFixoTotal ?? 0)} ÷ ticket líquido ${brl(
                  breakEven.data?.ticketMedioMrr ?? 0,
                )} · você tem ${breakEven.data?.contratosMrr ?? 0}`}
          </p>
        </div>
      </div>
    </Card>
  );
}
