import { useIsMutating } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ContratoInicial } from "@/modules/contracts/domain/contract";
import type { VendaDeOrigem } from "@/modules/contracts/domain/venda-de-origem";
import { useProdutosAtivos } from "@/modules/contracts/hooks/use-contracts";
import { ContractForm } from "@/modules/contracts/ui/contract-form";
import { brl } from "@/shared/lib/format";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { ContratoACriar } from "../api/proposals.repository";
import { rotuloDaProposta } from "../domain/ciclo";
import { agruparParaContratos, contratoInicialDoGrupo, rotuloDoGrupo } from "../domain/grupos";
import {
  CHAVE_DA_LIGACAO,
  useContratosACriar,
  useItensDaProposta,
  useLigacoesPendentes,
  useRegistrarContratoDaProposta,
} from "../hooks/use-proposals";

interface Props {
  readonly clienteId: string;
  readonly clienteNome: string;
  readonly vendas: readonly VendaDeOrigem[];
}

export function ContratosDaPropostaACriar({ clienteId, clienteNome, vendas }: Props) {
  const consulta = useContratosACriar(clienteId);
  if (consulta.data === undefined) {
    if (!consulta.isError) return null;
    const mensagem = consulta.error instanceof Error ? consulta.error.message : undefined;
    return <FalhaAoLer oQue="os contratos da proposta a criar" mensagem={mensagem} />;
  }
  const grupos = consulta.data;
  if (grupos.length === 0) return null;

  const porProposta = new Map<string, ContratoACriar[]>();
  for (const grupo of grupos) {
    porProposta.set(grupo.propostaId, [...(porProposta.get(grupo.propostaId) ?? []), grupo]);
  }
  return (
    <>
      {[...porProposta].map(([propostaId, lista]) => (
        <PropostaACriar
          key={propostaId}
          grupos={lista}
          clienteId={clienteId}
          clienteNome={clienteNome}
          vendas={vendas}
          listaAtualizando={consulta.isFetching}
        />
      ))}
    </>
  );
}

function PropostaACriar({
  grupos,
  clienteId,
  clienteNome,
  vendas,
  listaAtualizando,
}: Props & { readonly grupos: ContratoACriar[]; readonly listaAtualizando: boolean }) {
  const primeira = grupos[0]!;
  const propostaId = primeira.propostaId;
  const venda: VendaDeOrigem = {
    id: primeira.oportunidadeId,
    nome: vendas.find((v) => v.id === primeira.oportunidadeId)?.nome ?? "Venda da proposta",
  };
  const itens = useItensDaProposta(propostaId);
  const catalogo = useProdutosAtivos();
  const registrar = useRegistrarContratoDaProposta();
  const ligacoes = useLigacoesPendentes();
  const [abertoPara, setAbertoPara] = useState<ContratoInicial | null>(null);
  const [confirmandoDispensa, setConfirmandoDispensa] = useState(false);
  const pendente = ligacoes.pendentes[propostaId];
  const ligacaoEmVoo = useIsMutating({ mutationKey: CHAVE_DA_LIGACAO }) > 0;
  const ocupado = ligacaoEmVoo || itens.isFetching || listaAtualizando;

  const calculados =
    itens.data !== undefined && catalogo.data !== undefined
      ? agruparParaContratos(itens.data, catalogo.data)
      : null;

  function ligar(contratoId: string) {
    registrar.mutate({ propostaId, contratoId });
  }

  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Contratos da proposta {rotuloDaProposta(primeira.numero, primeira.versao)} a criar
      </h3>

      {((itens.isError && itens.data === undefined) ||
        (catalogo.isError && catalogo.data === undefined)) && (
        <FalhaAoLer
          oQue="os itens da proposta ou o catálogo"
          mensagem="Sem eles o contrato não tem como ser preenchido. Recarregue a página."
        />
      )}

      {pendente !== undefined && (
        <div className="grid gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
          <p>O contrato foi criado, mas a proposta não foi ligada a ele.</p>
          {confirmandoDispensa ? (
            <>
              <p>
                Dispensar o aviso? O contrato já criado continua no cliente. Criar de novo cria
                outro contrato.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={registrar.isPending || ligacaoEmVoo}
                  onClick={() => {
                    setConfirmandoDispensa(false);
                    ligacoes.limpar(propostaId);
                  }}
                >
                  Sim, dispensar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmandoDispensa(false)}
                >
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={registrar.isPending || ligacaoEmVoo}
                onClick={() => ligar(pendente)}
              >
                Ligar o contrato criado à proposta
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={registrar.isPending || ligacaoEmVoo}
                onClick={() => setConfirmandoDispensa(true)}
              >
                Dispensar
              </Button>
            </div>
          )}
        </div>
      )}

      <ul className="grid gap-1.5">
        {grupos.map((g) => {
          const grupo = calculados?.find(
            (c) => c.tipo === g.tipo && c.linhaDeNegocio === g.linhaDeNegocio,
          );
          return (
            <li
              key={`${g.tipo}-${g.linhaDeNegocio}`}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span>{rotuloDoGrupo(g)}</span>
              <span className="ml-auto tabular-nums">{brl(g.valor)}</span>
              <Button
                type="button"
                size="sm"
                disabled={grupo === undefined || pendente !== undefined || ocupado}
                onClick={() => {
                  if (grupo !== undefined)
                    setAbertoPara(contratoInicialDoGrupo(grupo, g, clienteNome));
                }}
              >
                Criar contrato
              </Button>
            </li>
          );
        })}
      </ul>

      <ContractForm
        aberto={abertoPara !== null}
        inicial={abertoPara === null ? null : { clienteId, contrato: abertoPara, venda }}
        aoContratoCriado={ligar}
        aoFechar={() => setAbertoPara(null)}
      />
    </section>
  );
}
