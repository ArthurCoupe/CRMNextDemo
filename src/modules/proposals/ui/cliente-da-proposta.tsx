import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GanhaSemContrato } from "@/modules/clients/domain/vinculo";
import { FormularioDeCliente } from "@/modules/clients/ui/formulario-de-cliente";
import { useClientesParaSelecao } from "@/modules/contracts/hooks/use-contracts";
import type { OportunidadeListada } from "@/modules/pipeline/api/pipeline.repository";
import { useEstagios, useMoverEstagio } from "@/modules/pipeline/hooks/use-pipeline";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

interface ClienteDaPropostaProps {
  readonly oportunidade: OportunidadeListada;
  readonly aoClienteEscolhido: (clienteId: string) => void;
  readonly aoFechar: () => void;
}

function comoGanha(oportunidade: OportunidadeListada): GanhaSemContrato {
  return {
    id: oportunidade.id,
    nome: oportunidade.nome,
    contatoNome: oportunidade.contatoNome,
    contatoEmail: oportunidade.contatoEmail,
    contatoTelefone: oportunidade.contatoTelefone,
    segmento: oportunidade.segmento,
    nicho: oportunidade.nicho,
    ganhaEm: oportunidade.estagioMudouEm,
  };
}

export function ClienteDaProposta({
  oportunidade,
  aoClienteEscolhido,
  aoFechar,
}: ClienteDaPropostaProps) {
  const [marcada, setMarcada] = useState(false);
  const jaGanha = oportunidade.estagio === "fechado" || marcada;
  const estagios = useEstagios(jaGanha ? null : oportunidade.pipelineId);
  const mover = useMoverEstagio();
  const clientes = useClientesParaSelecao();
  const [formAberto, setFormAberto] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [clienteId, setClienteId] = useState("");

  function marcarGanhaE(seguir: () => void) {
    if (jaGanha) {
      seguir();
      return;
    }
    const destino = (estagios.data ?? []).find((estagio) => estagio.tipo === "fechado");
    if (destino === undefined) {
      toast.error(
        "Este pipeline não tem estágio Fechado. Cadastre em Configurações para marcar a ganha.",
      );
      return;
    }
    mover.mutate(
      {
        oportunidadeId: oportunidade.id,
        destino,
        estagioAtualId: oportunidade.estagioId,
        pipelineId: oportunidade.pipelineId,
      },
      {
        onSuccess: () => {
          setMarcada(true);
          seguir();
        },
        onError: (erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível marcar como ganha."),
      },
    );
  }

  const estagiosFalharam = !jaGanha && estagios.data === undefined && estagios.isError;
  const esperando = mover.isPending || (!jaGanha && estagios.data === undefined);
  const clientesFalharam = estadoDaConsulta(clientes) === "erro";

  return (
    <div className="grid gap-2 rounded-lg border border-border px-3 py-2.5 text-xs">
      <p>
        Esta venda ainda não tem contrato. Escolha o cliente, um que já existe ou um novo; o
        contrato desta proposta vem em seguida.
      </p>
      {estagiosFalharam && (
        <p role="status" className="text-destructive">
          Não foi possível ler os estágios do pipeline para marcar a ganha. Recarregue a página.
        </p>
      )}
      {escolhendo &&
        (clientesFalharam ? (
          <FalhaAoLer
            oQue="os clientes"
            mensagem="Recarregue a página, ou cadastre um cliente novo."
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={clienteId}
              onValueChange={setClienteId}
              disabled={clientes.data === undefined}
            >
              <SelectTrigger aria-label="Cliente" className="h-8 w-64">
                <SelectValue placeholder="Escolha o cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clientes.data ?? []).map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={clienteId === ""}
              onClick={() => aoClienteEscolhido(clienteId)}
            >
              Seguir para o contrato
            </Button>
          </div>
        ))}
      <div className="flex flex-wrap gap-2">
        {!escolhendo && (
          <Button
            type="button"
            size="sm"
            disabled={esperando}
            onClick={() => marcarGanhaE(() => setEscolhendo(true))}
          >
            Usar cliente existente
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant={escolhendo ? "outline" : "default"}
          disabled={esperando}
          onClick={() => marcarGanhaE(() => setFormAberto(true))}
        >
          {mover.isPending ? "Marcando como ganha…" : "Cadastrar cliente novo"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>

      <FormularioDeCliente
        aberto={formAberto}
        aoFechar={() => setFormAberto(false)}
        ganhaInicial={comoGanha(oportunidade)}
        aoCriar={(novoId) => aoClienteEscolhido(novoId)}
      />
    </div>
  );
}
