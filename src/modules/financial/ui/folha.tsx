import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageSection } from "@/shared/ui/page-section";

import type { PessoaCadastrada } from "../api/payroll.repository";
import { useProjecaoDeCusto } from "../hooks/use-expenses";
import { useCustoDeFolhaPorBu, useEquipe, usePessoasCadastradas } from "../hooks/use-payroll";
import { EquipePorBu } from "./equipe-por-bu";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FormularioDePessoa } from "./formulario-de-pessoa";
import { ListaDePessoas } from "./lista-de-pessoas";

export function Folha() {
  const equipe = useEquipe();
  const custoPorBu = useCustoDeFolhaPorBu();
  const projecao = useProjecaoDeCusto();

  const [mostrarInativas, setMostrarInativas] = useState(false);
  const cadastro = usePessoasCadastradas({ incluirInativas: mostrarInativas });

  const [formularioAberto, setFormularioAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<PessoaCadastrada | null>(null);

  const estadoDoCadastro = estadoDaConsulta(cadastro);
  const mesCorrente = projecao.data?.[0] ?? null;

  function abrirNova() {
    setEmEdicao(null);
    setFormularioAberto(true);
  }

  function abrirEdicao(id: string) {
    const registro = (cadastro.data?.linhas ?? []).find((p) => p.id === id);
    if (registro === undefined) {
      toast.error(
        "Esta pessoa não está na lista de cadastro carregada. Se ela foi tirada da folha, ligue “Mostrar também quem foi tirado da folha” na seção Cadastro.",
      );
      return;
    }
    setEmEdicao(registro);
    setFormularioAberto(true);
  }

  return (
    <>
      <PageSection
        title="Equipe e custo"
        lede="Cadastrar alguém é cadastrar o custo. O fixo vem daqui; a participação em contratos entra por fora, com o percentual congelado na assinatura."
        actions={
          <Button type="button" size="sm" onClick={abrirNova}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Nova pessoa
          </Button>
        }
      >
        <EquipePorBu
          equipe={equipe.data ?? []}
          custoPorBu={custoPorBu.data ?? []}
          estado={estadoDaConsulta(equipe)}
          estadoDoCusto={estadoDaConsulta(custoPorBu)}
          mesReferencia={mesCorrente?.mes ?? null}
          podeEditar={estadoDoCadastro === "pronto"}
          onEditar={abrirEdicao}
        />

        {estadoDoCadastro !== "pronto" && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {estadoDoCadastro === "erro"
              ? "Não foi possível ler o cadastro, então Editar está indisponível: abrir agora criaria uma pessoa nova em vez de corrigir esta."
              : "Carregando o cadastro para poder editar…"}
          </p>
        )}
      </PageSection>

      <PageSection
        title="Cadastro"
        lede="Quem está registrado, inclusive quem ainda não começou, quem já saiu e quem foi tirado da folha. É por aqui que se tira alguém do custo sem apagar o histórico."
      >
        <ListaDePessoas
          pessoas={cadastro.data?.linhas ?? []}
          truncada={cadastro.data?.truncada ?? false}
          estado={estadoDoCadastro}
          mostrarInativas={mostrarInativas}
          onAlternarInativas={setMostrarInativas}
          onEditar={abrirEdicao}
          mesReferencia={mesCorrente?.mes ?? null}
        />
      </PageSection>

      <FormularioDePessoa
        aberto={formularioAberto}
        pessoa={emEdicao}
        onFechar={() => setFormularioAberto(false)}
      />
    </>
  );
}
