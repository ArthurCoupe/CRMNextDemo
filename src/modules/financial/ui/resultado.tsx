import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageSection } from "@/shared/ui/page-section";
import { brl } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

import { mesEAno, proximaQueda } from "../domain/expenses";
import { hojeEmSaoPaulo, indiceDoMes, primeiroDiaDoMes, type DataISO } from "../domain/mes-civil";
import { situacaoDoMes } from "../domain/result";
import { useProjetosAtrasados } from "../hooks/use-financial";
import { useProjecaoDeCusto, useQuedaDeCusto } from "../hooks/use-expenses";
import {
  useBreakEven,
  useCustoPorBu,
  useEncerramentosAutomaticos,
  useHistoricoDeResultado,
  useMetaDeMrr,
  useResultadoConsolidado,
  useResultadoPorBu,
  useReverterEncerramento,
} from "../hooks/use-result";
import { CardsDoResultado } from "./cards-do-resultado";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { MatrizDeResultado } from "./matriz-de-resultado";
import { RegravarMes } from "./regravar-mes";

export function Resultado() {
  const projecao = useProjecaoDeCusto();

  const mesCorrente = useMemo<DataISO | null>(() => {
    const indice = indiceDoMes(hojeEmSaoPaulo());
    return indice === null ? null : primeiroDiaDoMes(indice);
  }, []);

  const [deslocamento, setDeslocamento] = useState(0);

  const mes = useMemo<DataISO | null>(() => {
    if (mesCorrente === null) return null;
    const indice = indiceDoMes(mesCorrente);
    if (indice === null) return null;
    return primeiroDiaDoMes(indice + deslocamento);
  }, [mesCorrente, deslocamento]);

  const porBu = useResultadoPorBu(mes);
  const consolidado = useResultadoConsolidado(mes);
  const custoPorBu = useCustoPorBu(mes);
  const breakEven = useBreakEven(mesCorrente);
  const historico = useHistoricoDeResultado(12);
  const meta = useMetaDeMrr();
  const queda = useQuedaDeCusto();
  const atrasados = useProjetosAtrasados();
  const encerramentos = useEncerramentosAutomaticos();
  const reverter = useReverterEncerramento();

  const proxima = useMemo(() => proximaQueda(queda.data ?? []), [queda.data]);

  const compartilhado =
    custoPorBu.data === undefined
      ? null
      : (custoPorBu.data.find((c) => c.bu === "compartilhado")?.custoTotal ?? 0);

  const mrrFirme = breakEven.data?.mrrFirmeTotal ?? null;

  const situacao =
    mes === null || mesCorrente === null
      ? "parcial"
      : situacaoDoMes(mes, mesCorrente, porBu.data?.congelado ?? false);

  const rotulo = mes === null ? "-" : (mesEAno(mes) ?? "-");

  return (
    <>
      <PageSection
        title="A estrutura, hoje"
        lede="Estes cinco números são do estado atual da operação e não mudam ao navegar entre meses: ninguém pergunta quantos clientes faltavam em julho."
      >
        <CardsDoResultado
          breakEven={breakEven.data ?? null}
          estadoDoBreakEven={estadoDaConsulta(breakEven)}
          queda={proxima}
          estadoDaQueda={estadoDaConsulta(queda)}
          meta={meta.data}
          estadoDaMeta={estadoDaConsulta(meta)}
          mrrFirme={mrrFirme}
          atrasados={atrasados.data ?? []}
          estadoDosAtrasados={estadoDaConsulta(atrasados)}
          encerramentos={encerramentos.data ?? []}
          estadoDosEncerramentos={estadoDaConsulta(encerramentos)}
          onReverter={(id) => reverter.mutate(id)}
          revertendo={reverter.isPending ? reverter.variables : undefined}
        />
      </PageSection>

      <PageSection
        title="Resultado do mês"
        lede="Receita líquida menos custo, por linha de negócio. O custo compartilhado é rateado pela proporção de caixa de cada frente."
        actions={
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setDeslocamento((d) => d - 1)}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-sm font-medium tabular-nums">
              {rotulo}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={deslocamento >= 0}
              onClick={() => setDeslocamento((d) => Math.min(0, d + 1))}
              aria-label="Mês seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        {estadoDaConsulta(projecao) === "erro" && (
          <div className="mb-3">
            <FalhaAoLer
              oQue="a projeção de custo"
              mensagem="Recarregue a página e tente de novo."
            />
          </div>
        )}
        <MatrizDeResultado
          linhas={porBu.data?.linhas ?? []}
          consolidado={consolidado.data ?? null}
          custoCompartilhado={compartilhado}
          situacao={situacao}
          estado={estadoDaConsulta(porBu)}
        />
      </PageSection>

      <PageSection
        title="Fechamento mês a mês"
        lede="O mês corrente é parcial e muda até o dia 31. Mês fechado com snapshot é o que era verdade no dia 1º; sem snapshot, é reconstrução com os parâmetros de hoje."
      >
        <HistoricoDeResultado
          meses={historico.data ?? []}
          estado={estadoDaConsulta(historico)}
          mesSelecionado={mes}
          onSelecionar={(alvo) => {
            if (mesCorrente === null) return;
            const de = indiceDoMes(mesCorrente);
            const para = indiceDoMes(alvo);
            if (de === null || para === null) return;
            setDeslocamento(Math.min(0, para - de));
          }}
        />
      </PageSection>
    </>
  );
}

function HistoricoDeResultado({
  meses,
  estado,
  mesSelecionado,
  onSelecionar,
}: {
  readonly meses: readonly {
    mes: DataISO;
    receitaLiquida: number;
    custoTotal: number;
    resultado: number;
    congelado: boolean;
    parcial: boolean;
  }[];
  readonly estado: ReturnType<typeof estadoDaConsulta>;
  readonly mesSelecionado: DataISO | null;
  readonly onSelecionar: (mes: DataISO) => void;
}) {
  if (estado === "erro") {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-destructive">
        Não foi possível ler o histórico.
      </div>
    );
  }
  if (estado === "carregando") {
    return <div className="h-48 animate-pulse rounded-xl border bg-card" />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3.5 py-2 text-left font-medium">Mês</th>
            <th className="px-3.5 py-2 text-right font-medium">Receita líquida</th>
            <th className="px-3.5 py-2 text-right font-medium">Custo</th>
            <th className="px-3.5 py-2 text-right font-medium">Resultado</th>
            <th className="px-3.5 py-2 text-left font-medium">Origem</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((linha) => (
            <tr
              key={linha.mes}
              className={cn(
                "cursor-pointer border-b last:border-0 hover:bg-muted/20",
                linha.mes === mesSelecionado && "bg-primary/5",
              )}
              onClick={() => onSelecionar(linha.mes)}
            >
              <td className="px-3.5 py-2 tabular-nums">{mesEAno(linha.mes) ?? linha.mes}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{brl(linha.receitaLiquida)}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{brl(linha.custoTotal)}</td>
              <td
                className={cn(
                  "px-3.5 py-2 text-right font-medium tabular-nums",
                  linha.resultado >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {brl(linha.resultado)}
              </td>
              <td className="px-3.5 py-2 text-[11px] text-muted-foreground">
                {linha.parcial ? "parcial" : linha.congelado ? "snapshot" : "reconstruído"}
                {linha.congelado && !linha.parcial && (
                  <RegravarMes mes={linha.mes} rotulo={mesEAno(linha.mes) ?? linha.mes} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-3.5 py-2 text-[11px] text-muted-foreground">
        <strong>snapshot</strong> não muda se alguém editar um contrato antigo;{" "}
        <strong>reconstruído</strong> muda, porque é recalculado com as alíquotas e o estado de
        hoje. É por isso que os dois não podem ter o mesmo rótulo.
      </p>
    </div>
  );
}
