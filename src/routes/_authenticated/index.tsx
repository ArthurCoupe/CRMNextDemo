import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/hooks/use-profile";
import { exigirPapel } from "@/integrations/supabase/papel";
import { useMrrPorUnidade } from "@/modules/financial/hooks/use-financial";
import { LIMITE_DO_BOARD } from "@/modules/pipeline/domain/limites";
import { ORDEM_DOS_ESTAGIOS, rotuloDoEstagio } from "@/modules/pipeline/domain/stage";
import { useOportunidadesDeTodosOsPipelines } from "@/modules/pipeline/hooks/use-pipeline";
import { PlacarDeMetas } from "@/modules/financial/ui/placar-de-metas";
import { useTarefas } from "@/modules/tasks/hooks/use-tasks";
import { brl } from "@/shared/lib/format";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { KpiCard } from "@/shared/ui/kpi-card";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: Dashboard,
});

export function Dashboard() {
  const { papel, meuId } = useProfile();
  const ehOwner = papel === "owner";

  const pipeline = useOportunidadesDeTodosOsPipelines();
  const estadoDoPipeline = estadoDaConsulta(pipeline);
  const oportunidades = pipeline.data ?? [];
  const mrr = useMrrPorUnidade({ habilitado: ehOwner });

  const tarefas = useTarefas({ responsavelId: meuId }, meuId !== null);

  const mrrTotal = (mrr.data?.celulas ?? []).reduce((soma, c) => soma + c.total, 0);

  const contagemPorEstagio = ORDEM_DOS_ESTAGIOS.map((estagio) => ({
    estagio,
    total: oportunidades.filter((o) => o.estagio === estagio).length,
  }));

  return (
    <>
      <PageHeader title="Dashboard" description="Visão geral do seu negócio em tempo real" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Oportunidades"
          value={
            estadoDoPipeline === "erro"
              ? "não foi possível ler"
              : estadoDoPipeline === "carregando"
                ? "-"
                : oportunidades.length
          }
          accent={estadoDoPipeline === "erro" ? "erro" : "neutro"}
          detail={
            estadoDoPipeline === "erro"
              ? "o número é desconhecido, não zero"
              : "em todos os pipelines"
          }
        />

        {ehOwner && (
          <KpiCard
            label="MRR ativo"
            value={mrr.isError ? "não foi possível ler" : mrr.isPending ? "-" : brl(mrrTotal)}
            accent={mrr.isError ? "erro" : "sucesso"}
            detail={
              mrr.isError
                ? "o valor é desconhecido, não zero"
                : "todo contrato de MRR ativo, firme ou não · mesma fonte do Financeiro"
            }
          />
        )}

        <KpiCard
          label="Tarefas"
          value={
            tarefas.isError
              ? "não foi possível ler"
              : tarefas.isPending
                ? "-"
                : tarefas.data?.temMais === true
                  ? `${tarefas.data.tarefas.length}+`
                  : (tarefas.data?.tarefas.length ?? 0)
          }
          accent={tarefas.isError ? "erro" : "neutro"}
          detail={tarefas.isError ? "o número é desconhecido, não zero" : "suas, em aberto"}
        />
      </div>

      {oportunidades.length >= LIMITE_DO_BOARD && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          A leitura do pipeline atingiu o teto de {LIMITE_DO_BOARD} oportunidades. As mais paradas
          não entram nos números acima.
        </p>
      )}

      {ehOwner && <PlacarDeMetas />}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline por estágio
        </h2>
        {estadoDoPipeline === "erro" ? (
          <FalhaAoLer oQue="as oportunidades por estágio" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {contagemPorEstagio.map(({ estagio, total }) => (
              <div key={estagio} className="rounded-lg border bg-card p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  {rotuloDoEstagio(estagio)}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {estadoDoPipeline === "carregando" ? "-" : total}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
