import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { estadoDaConsulta, type EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { PageSection } from "@/shared/ui/page-section";

import type { LinhaDeCampanha, LinhaDoMix } from "../api/pipeline.repository";
import { rotuloDaChaveDeCanal, SEM_ATRIBUICAO } from "../domain/channel";
import { somarBaldesDisjuntos } from "../domain/funnel";
import {
  useFechamentosPorCampanha,
  useFunilPorCanal,
  useMixDeOportunidades,
  useTempoAtePrimeiroContato,
} from "../hooks/use-pipeline";
import { ComparativoPorCanal } from "./comparativo-por-canal";
import { FunilPorEtapa } from "./funil-por-etapa";
import { TempoAtePrimeiroContato } from "./tempo-ate-primeiro-contato";

export function ReportsPage() {
  const funil = useFunilPorCanal();
  const campanhas = useFechamentosPorCampanha();
  const mix = useMixDeOportunidades();
  const tempo = useTempoAtePrimeiroContato();

  const estadoDoFunil = estadoDaConsulta(funil);

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Funil, canais e campanhas: contagem de oportunidades e de contratos, sem valor."
      />

      <PageSection
        title="Funil por etapa"
        lede="Quantas oportunidades alcançaram cada degrau e quanto passou da etapa anterior. Conta quem passou, não quem está parado ali."
      >
        <FunilPorEtapa linhas={funil.data ?? []} estado={estadoDoFunil} />
      </PageSection>

      <PageSection
        title="Comparativo por canal"
        lede="Cada canal com a tese que justifica ele existir. Sem atribuição aparece separado: não é canal, e nunca é somado a um."
      >
        <ComparativoPorCanal linhas={funil.data ?? []} estado={estadoDoFunil} />
      </PageSection>

      <PageSection
        title="Tempo até o primeiro contato"
        lede="Quanto cada lead novo esperou pelo primeiro toque registrado, em horas úteis, e quantos foram tocados dentro do prazo do canal."
      >
        <TempoAtePrimeiroContato linhas={tempo.data ?? []} estado={estadoDaConsulta(tempo)} />
      </PageSection>

      <PageSection
        title="Fechamentos por campanha"
        lede="Quantos contratos cada campanha gerou. Contagem, nunca valor: a RPC não devolve dinheiro, e é isso que permite o time inteiro ler esta tabela (D-036)."
      >
        <FechamentosPorCampanha
          linhas={campanhas.data ?? []}
          estado={estadoDaConsulta(campanhas)}
        />
      </PageSection>

      <PageSection
        title="Distribuição das oportunidades"
        lede="Por nicho, tier e canal. Oportunidade descartada fica de fora: nunca foi lead."
      >
        <DistribuicaoDasOportunidades linhas={mix.data ?? []} estado={estadoDaConsulta(mix)} />
      </PageSection>
    </>
  );
}

function FechamentosPorCampanha({
  linhas,
  estado,
}: {
  readonly linhas: readonly LinhaDeCampanha[];
  readonly estado: EstadoDaConsulta;
}) {
  if (estado === "erro") {
    return <FalhaAoLer oQue="os fechamentos por campanha" />;
  }
  if (estado === "carregando") {
    return <div className="h-40 animate-pulse rounded-xl border bg-card" />;
  }
  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Nenhum contrato fechado ainda"
        description="A primeira linha aparece quando um negócio for fechado no Pipeline. Contrato de cliente sem oportunidade vinculada entra como sem atribuição."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Campanha</th>
            <th className="px-3 py-2 text-left font-medium">Origem</th>
            <th className="px-3 py-2 text-left font-medium">Canal</th>
            <th className="px-3 py-2 text-right font-medium">Contratos</th>
            <th className="px-3 py-2 text-right font-medium">Cancelados</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr
              key={`${linha.campanha}/${linha.origem}/${linha.canal}`}
              className="border-b last:border-0"
            >
              <td className="px-3 py-2.5">
                <NomeDaCampanha campanha={linha.campanha} />
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{linha.origem}</td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {rotuloDaChaveDeCanal(linha.canal)}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">{linha.contratos}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {linha.cancelados === 0 ? (
                  <span className="text-muted-foreground/50">-</span>
                ) : (
                  <span className="text-destructive">{linha.cancelados}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Contagem de contratos, não receita: quanto cada campanha trouxe é dado financeiro e só o
        sócio o lê. Cancelado fica em coluna própria porque a campanha ter gerado o contrato e o
        contrato ter sobrevivido são duas perguntas.
      </p>
    </div>
  );
}

function DistribuicaoDasOportunidades({
  linhas,
  estado,
}: {
  readonly linhas: readonly LinhaDoMix[];
  readonly estado: EstadoDaConsulta;
}) {
  if (estado === "erro") {
    return <FalhaAoLer oQue="a distribuição das oportunidades" />;
  }
  if (estado === "carregando") {
    return <div className="h-40 animate-pulse rounded-xl border bg-card" />;
  }
  if (linhas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma oportunidade na carteira"
        description="Crie a primeira no Pipeline. Oportunidade sem qualificação respondida aparece como sem tier, nunca como C."
      />
    );
  }

  const ordenadas = [...linhas].sort(
    (a, b) => b.oportunidades - a.oportunidades || a.nicho.localeCompare(b.nicho, "pt-BR"),
  );
  const total = somarBaldesDisjuntos(ordenadas);

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Nicho</th>
            <th className="px-3 py-2 text-left font-medium">Tier</th>
            <th className="px-3 py-2 text-left font-medium">Canal</th>
            <th className="px-3 py-2 text-right font-medium">Oportunidades</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((linha) => (
            <tr
              key={`${linha.nicho}/${linha.tier}/${linha.canal}`}
              className="border-b last:border-0"
            >
              <td className="px-3 py-2.5 font-medium">{linha.nicho}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{linha.tier}</td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {rotuloDaChaveDeCanal(linha.canal)}
              </td>
              <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                {linha.oportunidades}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/30">
            <td
              className="px-3 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground"
              colSpan={3}
            >
              Total na carteira
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function NomeDaCampanha({ campanha }: { campanha: string }) {
  if (campanha === "sem atribuicao" || campanha === SEM_ATRIBUICAO) {
    return (
      <span className="italic text-muted-foreground">
        Sem atribuição
        <span className="ml-1 text-[11px]">(fechamento sem campanha de origem)</span>
      </span>
    );
  }
  return <span className="font-medium">{campanha}</span>;
}
