import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageSection } from "@/shared/ui/page-section";

import type { DespesaCadastrada } from "../api/expenses.repository";
import { proximaQueda } from "../domain/expenses";
import {
  useDespesasCadastradas,
  useDespesasEfetivas,
  useProjecaoDeCusto,
  useQuedaDeCusto,
} from "../hooks/use-expenses";
import { useVeFolha } from "../hooks/use-payroll";
import { ArvoreDeGastos } from "./arvore-de-gastos";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FormularioDeDespesa } from "./formulario-de-despesa";
import { ListaDeCadastro } from "./lista-de-cadastro";
import { ProjecaoDeCusto } from "./projecao-de-custo";
import { QuedaDeCusto } from "./queda-de-custo";

export function Gastos() {
  const efetivas = useDespesasEfetivas();
  const projecao = useProjecaoDeCusto();
  const queda = useQuedaDeCusto();
  const veFolha = useVeFolha();

  const [mostrarInativas, setMostrarInativas] = useState(false);
  const cadastradas = useDespesasCadastradas({ incluirInativas: mostrarInativas });

  const [formularioAberto, setFormularioAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<DespesaCadastrada | null>(null);

  const proxima = useMemo(() => proximaQueda(queda.data ?? []), [queda.data]);

  const mesCorrente = projecao.data?.[0] ?? null;
  const estadoDoCadastro = estadoDaConsulta(cadastradas);

  function abrirNovo() {
    setEmEdicao(null);
    setFormularioAberto(true);
  }

  function abrirEdicao(id: string) {
    const registro = (cadastradas.data?.linhas ?? []).find((d) => d.id === id);
    if (registro === undefined) {
      toast.error(
        "Esta despesa não está na lista de cadastro carregada. Use a seção Cadastro abaixo para encontrá-la.",
      );
      return;
    }
    setEmEdicao(registro);
    setFormularioAberto(true);
  }

  return (
    <>
      <PageSection
        title="Gastos do mês"
        lede="O que a agência paga neste mês. Cartão de crédito entra como agrupador e não soma: quem soma são as despesas penduradas nele."
        actions={
          <Button type="button" size="sm" onClick={abrirNovo}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Nova despesa
          </Button>
        }
      >
        <div className="space-y-3">
          <QuedaDeCusto queda={proxima} estado={estadoDaConsulta(queda)} />
          <ArvoreDeGastos
            despesas={efetivas.data ?? []}
            mesCorrente={mesCorrente}
            estado={estadoDaConsulta(efetivas)}
            estadoDoTotal={estadoDaConsulta(projecao)}
            estadoDoCadastro={estadoDoCadastro}
            onEditar={abrirEdicao}
            mostraOrigemDaFolha={veFolha.data === true}
          />
        </div>
      </PageSection>

      <PageSection
        title="Projeção de 12 meses"
        lede="As parcelas caem nas datas certas porque a vigência é derivada do início e do número de parcelas, não de um contador que alguém, ou um job, precise lembrar de atualizar."
      >
        <ProjecaoDeCusto meses={projecao.data ?? []} estado={estadoDaConsulta(projecao)} />
      </PageSection>

      <PageSection
        title="Cadastro"
        lede="Tudo que está registrado, inclusive os agrupadores e o que não conta neste mês. É por aqui que se tira uma despesa do custo sem apagar o histórico."
      >
        <ListaDeCadastro
          despesas={cadastradas.data?.linhas ?? []}
          truncada={cadastradas.data?.truncada ?? false}
          estado={estadoDoCadastro}
          mostrarInativas={mostrarInativas}
          onAlternarInativas={setMostrarInativas}
          onEditar={abrirEdicao}
          mesReferencia={mesCorrente?.mes ?? null}
        />
      </PageSection>

      <FormularioDeDespesa
        aberto={formularioAberto}
        despesa={emEdicao}
        onFechar={() => setFormularioAberto(false)}
      />
    </>
  );
}
