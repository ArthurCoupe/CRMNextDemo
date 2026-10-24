import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useContratosDoCliente, useProdutosAtivos } from "@/modules/contracts/hooks/use-contracts";
import { ContractForm } from "@/modules/contracts/ui/contract-form";
import type { OportunidadeListada } from "@/modules/pipeline/api/pipeline.repository";
import { brl } from "@/shared/lib/format";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { PropostaListada } from "../api/proposals.repository";
import { agruparParaContratos, contratoInicialDoGrupo, rotuloDoGrupo } from "../domain/grupos";
import { useItensDaProposta, useRegistrarContratoDaProposta } from "../hooks/use-proposals";
import { ClienteDaProposta } from "./cliente-da-proposta";

interface AceiteDaPropostaProps {
  readonly proposta: PropostaListada | null;
  readonly oportunidade: OportunidadeListada;
  readonly aoFechar: () => void;
}

export function AceiteDaProposta({ proposta, oportunidade, aoFechar }: AceiteDaPropostaProps) {
  const [clienteEscolhido, setClienteEscolhido] = useState<string | null>(null);
  const clienteId = proposta?.clienteId ?? clienteEscolhido;
  const itens = useItensDaProposta(proposta?.id ?? null);
  const catalogo = useProdutosAtivos();
  const contratos = useContratosDoCliente(clienteId);
  const registrar = useRegistrarContratoDaProposta();
  const [criandoOutro, setCriandoOutro] = useState(false);

  if (proposta === null) return null;
  if (
    (itens.data === undefined && itens.isError) ||
    (catalogo.data === undefined && catalogo.isError)
  ) {
    return (
      <FalhaAoLer
        oQue="os itens da proposta ou o catálogo"
        mensagem="Sem eles o contrato não tem como ser preenchido. Recarregue e tente de novo."
      />
    );
  }
  if (contratos.data === undefined && contratos.isError) {
    return (
      <FalhaAoLer
        oQue="os contratos do cliente"
        mensagem="Sem eles não dá para saber se o contrato desta proposta já existe. Recarregue e tente de novo."
      />
    );
  }
  if (itens.data === undefined || catalogo.data === undefined) return null;
  if (clienteId !== null && contratos.data === undefined) return null;

  const [primeiro] = agruparParaContratos(itens.data, catalogo.data);
  if (primeiro === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta proposta não tem item pendente para virar contrato.
      </p>
    );
  }
  const inicial = contratoInicialDoGrupo(primeiro, proposta, oportunidade.nome);

  const propostaId = proposta.id;
  function ligar(contratoId: string) {
    registrar.mutate({ propostaId, contratoId });
  }
  function fechar() {
    setCriandoOutro(false);
    setClienteEscolhido(null);
    aoFechar();
  }

  if (clienteId === null) {
    return (
      <ClienteDaProposta
        oportunidade={oportunidade}
        aoClienteEscolhido={setClienteEscolhido}
        aoFechar={fechar}
      />
    );
  }

  const compativeis = (contratos.data ?? []).filter(
    (c) =>
      c.tipo === primeiro.tipo &&
      c.linhaDeNegocio === primeiro.linhaDeNegocio &&
      (c.oportunidadeId === null || c.oportunidadeId === oportunidade.id),
  );
  if (compativeis.length > 0 && !criandoOutro) {
    return (
      <div className="grid gap-2 rounded-lg border border-border px-3 py-2.5 text-xs">
        <p>
          Este cliente já tem contrato de {rotuloDoGrupo(primeiro)}. Se for o desta proposta, ligue
          em vez de criar outro.
        </p>
        <ul className="grid gap-1.5">
          {compativeis.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3">
              <span>{c.nome}</span>
              <span className="text-muted-foreground">{rotuloDoGrupo(c)}</span>
              <span className="ml-auto tabular-nums">
                {brl(c.tipo === "mrr" ? c.valorMensal : c.valorTotal)}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={contratos.isFetching}
                onClick={() => {
                  ligar(c.id);
                  fechar();
                }}
              >
                Ligar este contrato à proposta
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setCriandoOutro(true)}>
            Criar outro contrato
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ContractForm
      aberto
      inicial={{
        clienteId,
        contrato: inicial,
        venda: { id: oportunidade.id, nome: oportunidade.nome },
      }}
      aoContratoCriado={ligar}
      aoFechar={fechar}
    />
  );
}
