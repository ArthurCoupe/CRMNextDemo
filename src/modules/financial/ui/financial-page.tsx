import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/shared/ui/page-section";
import { AvisoSegundoFator } from "@/modules/seguranca/ui/aviso-segundo-fator";

import {
  useMrrPorUnidade,
  useProjetosAtrasados,
  useReceitaPorFrente,
  useTcvPorUnidade,
} from "../hooks/use-financial";
import { useLiquidoPorContrato, useLiquidoTotal } from "../hooks/use-fiscal";
import { useVeFolha } from "../hooks/use-payroll";
import { hojeParaEntrega, useDefinirEntrega } from "../hooks/use-result";
import { estadoDaConsulta, piorEstado } from "@/shared/ui/estado-da-consulta";
import { FaturamentoLiquido } from "./faturamento-liquido";
import { FaturamentoPorFrente } from "./faturamento-por-frente";
import { Folha } from "./folha";
import { Gastos } from "./gastos";
import { MatrizDeReceita } from "./matriz-de-receita";
import { ProjetosAtrasados } from "./projetos-atrasados";
import { Resultado } from "./resultado";

export function FinancialPage() {
  const veFolha = useVeFolha();
  const mostraFolha = veFolha.data === true;

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Contratos ativos, faturamento por frente e o que ainda não entrou."
      />
      <AvisoSegundoFator />

      <Tabs defaultValue="contratos">
        <TabsList className="mb-4">
          <TabsTrigger value="contratos">Contratos ativos</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          {mostraFolha && <TabsTrigger value="folha">Folha e equipe</TabsTrigger>}
          <TabsTrigger value="resultado">Resultado</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos">
          <ContratosAtivos />
        </TabsContent>
        <TabsContent value="gastos">
          <Gastos />
        </TabsContent>
        {mostraFolha && (
          <TabsContent value="folha">
            <Folha />
          </TabsContent>
        )}
        <TabsContent value="resultado">
          <Resultado />
        </TabsContent>
      </Tabs>
    </>
  );
}

function ContratosAtivos() {
  const mrr = useMrrPorUnidade();
  const tcv = useTcvPorUnidade();
  const frentes = useReceitaPorFrente();
  const atrasados = useProjetosAtrasados();
  const entrega = useDefinirEntrega();
  const liquido = useLiquidoPorContrato();
  const liquidoTotal = useLiquidoTotal();

  return (
    <>
      <PageSection
        title="Receita contratada"
        lede="Quatro medidas independentes. MRR é fluxo mensal, TCV é estoque contratado, e as duas linhas de negócio têm as duas coisas."
      >
        <MatrizDeReceita
          mrr={mrr.data?.celulas ?? []}
          tcv={tcv.data?.celulas ?? []}
          foraDaMatriz={[...(mrr.data?.foraDaMatriz ?? []), ...(tcv.data?.foraDaMatriz ?? [])]}
          estado={piorEstado(estadoDaConsulta(mrr), estadoDaConsulta(tcv))}
        />
      </PageSection>

      <PageSection
        title="Faturamento por frente"
        lede="Para comparar frentes, use exclusivamente o caixa do mês: é a única das três colunas que mede a mesma coisa em todas as linhas."
      >
        <FaturamentoPorFrente
          linhas={frentes.data?.linhas ?? []}
          totalDeCaixaDoMes={frentes.data?.totalDeCaixaDoMes ?? 0}
          estado={estadoDaConsulta(frentes)}
        />
      </PageSection>

      <PageSection
        title="Faturamento líquido"
        lede="O que entra de fato, depois de imposto e taxa da operadora. Num projeto em 12x as duas somam quase 22%, diferença que os cards acima não mostram."
      >
        <FaturamentoLiquido
          linhas={liquido.data ?? []}
          total={liquidoTotal.data ?? null}
          estado={piorEstado(estadoDaConsulta(liquido), estadoDaConsulta(liquidoTotal))}
        />
      </PageSection>

      <PageSection
        title="Entrega"
        lede="Projeto além do prazo consome margem sem contrapartida: a receita já foi reconhecida e o custo de equipe continua."
      >
        <ProjetosAtrasados
          projetos={atrasados.data ?? []}
          estado={estadoDaConsulta(atrasados)}
          onMarcarEntregue={(contractId) => entrega.mutate({ contractId, data: hojeParaEntrega() })}
          marcando={entrega.isPending ? entrega.variables?.contractId : undefined}
        />
      </PageSection>
    </>
  );
}
