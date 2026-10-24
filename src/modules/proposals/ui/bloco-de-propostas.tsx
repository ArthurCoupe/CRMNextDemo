import { useIsMutating } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import type { OportunidadeListada } from "@/modules/pipeline/api/pipeline.repository";
import { formatDate } from "@/shared/lib/date";
import { brl } from "@/shared/lib/format";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { PropostaListada } from "../api/proposals.repository";
import { acoes, ROTULO_DO_STATUS, rotuloDaProposta } from "../domain/ciclo";
import {
  CHAVE_DA_LIGACAO,
  useCriarProposta,
  useEnviarProposta,
  useExcluirRascunho,
  useItensDaProposta,
  useLigacoesPendentes,
  useNovaVersao,
  usePodeVerPropostas,
  usePropostas,
  useRecusarProposta,
  useRegistrarContratoDaProposta,
} from "../hooks/use-proposals";
import { AceiteDaProposta } from "./aceite-da-proposta";
import { EditorDeProposta } from "./editor-de-proposta";

const AVISO_DO_EDITAR =
  "Cria uma nova versão com os mesmos itens. Enquanto ela existir, a enviada não pode ser aceita nem recusada.";

export function BlocoDePropostas({ oportunidade }: { readonly oportunidade: OportunidadeListada }) {
  const { papel } = useProfile();
  const consulta = usePropostas(oportunidade.id);
  const escondidas = usePodeVerPropostas(oportunidade.id).data === false;
  const criar = useCriarProposta();
  const registrar = useRegistrarContratoDaProposta();
  const { pendentes, limpar } = useLigacoesPendentes();
  const ligacaoEmVoo = useIsMutating({ mutationKey: CHAVE_DA_LIGACAO }) > 0;

  const [aberta, setAberta] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState<PropostaListada | null>(null);
  const [aceitando, setAceitando] = useState<PropostaListada | null>(null);

  if (papel === null || papel === "client") return null;

  let corpo: ReactNode = null;
  if (escondidas) {
    corpo = (
      <p className="text-xs text-muted-foreground">
        Depois do fechamento, as propostas ficam visíveis só para o owner e para o manager dono do
        cliente.
      </p>
    );
  } else if (consulta.data !== undefined) {
    corpo =
      consulta.data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma proposta nesta oportunidade.</p>
      ) : (
        <ul className="grid gap-2">
          {consulta.data.map((proposta) => (
            <LinhaDaProposta
              key={proposta.id}
              proposta={proposta}
              oportunidadeId={oportunidade.id}
              papel={papel}
              aberta={aberta === proposta.id}
              aoAlternar={() => setAberta((atual) => (atual === proposta.id ? null : proposta.id))}
              aoBaixar={() => {
                if (proposta.status === "rascunho") setPergunta(proposta);
              }}
              aoAceitar={() => setAceitando(proposta)}
              aoCriarVersao={(id) => setAberta(id)}
              ligacaoPendente={pendentes[proposta.id] ?? null}
              ligacaoEmVoo={ligacaoEmVoo}
              listaAtualizando={consulta.isFetching}
              aoRepetirLigacao={(contratoId) =>
                registrar.mutate({ propostaId: proposta.id, contratoId })
              }
              aoDispensarLigacao={() => limpar(proposta.id)}
              repetindo={registrar.isPending || ligacaoEmVoo}
            />
          ))}
        </ul>
      );
  } else if (consulta.isError) {
    const mensagem = consulta.error instanceof Error ? consulta.error.message : undefined;
    corpo = <FalhaAoLer oQue="as propostas" mensagem={mensagem} />;
  }

  return (
    <section className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Propostas
        </h3>
        {!escondidas && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={criar.isPending}
            onClick={() =>
              criar.mutate(
                { oportunidadeId: oportunidade.id },
                { onSuccess: (id) => setAberta(id) },
              )
            }
          >
            Nova proposta
          </Button>
        )}
      </div>

      {corpo}

      {pergunta !== null && (
        <PerguntaDeEnvio
          proposta={pergunta}
          oportunidadeId={oportunidade.id}
          aoFechar={() => setPergunta(null)}
        />
      )}

      <AceiteDaProposta
        proposta={aceitando}
        oportunidade={oportunidade}
        aoFechar={() => setAceitando(null)}
      />
    </section>
  );
}

function LinhaDaProposta({
  proposta,
  oportunidadeId,
  papel,
  aberta,
  aoAlternar,
  aoBaixar,
  aoAceitar,
  aoCriarVersao,
  ligacaoPendente,
  ligacaoEmVoo,
  listaAtualizando,
  aoRepetirLigacao,
  aoDispensarLigacao,
  repetindo,
}: {
  readonly proposta: PropostaListada;
  readonly oportunidadeId: string;
  readonly papel: "owner" | "manager" | "member";
  readonly aberta: boolean;
  readonly aoAlternar: () => void;
  readonly aoBaixar: () => void;
  readonly aoAceitar: () => void;
  readonly aoCriarVersao: (id: string) => void;
  readonly ligacaoPendente: string | null;
  readonly ligacaoEmVoo: boolean;
  readonly listaAtualizando: boolean;
  readonly aoRepetirLigacao: (contratoId: string) => void;
  readonly aoDispensarLigacao: () => void;
  readonly repetindo: boolean;
}) {
  const recusar = useRecusarProposta();
  const novaVersao = useNovaVersao();
  const excluir = useExcluirRascunho();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [confirmandoDispensa, setConfirmandoDispensa] = useState(false);
  const idDoAviso = useId();
  const enviada = proposta.status === "enviada";
  const alvo = { propostaId: proposta.id, oportunidadeId };
  const rotulo = rotuloDaProposta(proposta.numero, proposta.versao);
  const disponiveis = acoes(proposta.status, papel, proposta.ultima);

  return (
    <li className="grid gap-1.5 rounded-md border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="font-semibold hover:underline"
          aria-expanded={aberta}
          onClick={aoAlternar}
        >
          {rotulo}
        </button>
        <Badge variant="outline">{ROTULO_DO_STATUS[proposta.status]}</Badge>
        {proposta.vencida && (
          <Badge variant="destructive">
            venceu em {formatDate(proposta.validaAte).slice(0, 5)}
          </Badge>
        )}
        <span className="text-muted-foreground">Validade {formatDate(proposta.validaAte)}</span>
        <span className="ml-auto tabular-nums">Mensal {brl(proposta.totalMensal)}</span>
        <span className="tabular-nums">Projeto {brl(proposta.totalProjeto)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {disponiveis.includes("baixar_pdf") && (
          <a
            href={`/propostas/${proposta.id}/imprimir`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "sm", variant: "outline" })}
            onClick={aoBaixar}
          >
            Baixar PDF
          </a>
        )}
        {disponiveis.includes("recusar") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={recusar.isPending}
            onClick={() => recusar.mutate(alvo)}
          >
            Recusada
          </Button>
        )}
        {disponiveis.includes("nova_versao") && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={novaVersao.isPending}
              title={enviada ? AVISO_DO_EDITAR : undefined}
              aria-describedby={enviada ? idDoAviso : undefined}
              onClick={() => novaVersao.mutate(alvo, { onSuccess: aoCriarVersao })}
            >
              {enviada ? "Editar" : "Nova versão"}
            </Button>
            {enviada && (
              <span id={idDoAviso} className="sr-only">
                {AVISO_DO_EDITAR}
              </span>
            )}
          </>
        )}
        {disponiveis.includes("aceitar") && (
          <Button
            type="button"
            size="sm"
            disabled={ligacaoPendente !== null || ligacaoEmVoo || listaAtualizando}
            onClick={aoAceitar}
          >
            Aceita: fechar negócio
          </Button>
        )}
        {disponiveis.includes("excluir") &&
          (confirmandoExclusao ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={excluir.isPending}
                onClick={() => excluir.mutate(alvo)}
              >
                Sim, excluir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmandoExclusao(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmandoExclusao(true)}
            >
              Excluir rascunho
            </Button>
          ))}
      </div>

      {ligacaoPendente !== null && (
        <div className="grid gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2">
          <p>O contrato foi criado, mas a proposta não foi ligada a ele.</p>
          {confirmandoDispensa ? (
            <>
              <p>
                Dispensar o aviso? O contrato já criado continua no cliente. Aceitar de novo cria
                outro contrato.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={repetindo}
                  onClick={() => {
                    setConfirmandoDispensa(false);
                    aoDispensarLigacao();
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
                disabled={repetindo}
                onClick={() => aoRepetirLigacao(ligacaoPendente)}
              >
                Marcar proposta como aceita
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={repetindo}
                onClick={() => setConfirmandoDispensa(true)}
              >
                Dispensar
              </Button>
            </div>
          )}
        </div>
      )}

      {aberta && <EditorDeProposta proposta={proposta} oportunidadeId={oportunidadeId} />}
    </li>
  );
}

function PerguntaDeEnvio({
  proposta,
  oportunidadeId,
  aoFechar,
}: {
  readonly proposta: PropostaListada;
  readonly oportunidadeId: string;
  readonly aoFechar: () => void;
}) {
  const enviar = useEnviarProposta();
  const itens = useItensDaProposta(proposta.id);
  const temItem = (itens.data?.length ?? 0) > 0;
  const itensIlegiveis = itens.data === undefined && itens.isError;

  return (
    <div className="grid gap-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-xs">
      <p role="status">
        Enviou a proposta {rotuloDaProposta(proposta.numero, proposta.versao)} ao cliente?
      </p>
      {itensIlegiveis && (
        <FalhaAoLer
          oQue="os itens da proposta"
          mensagem={itens.error instanceof Error ? itens.error.message : undefined}
        />
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!temItem || enviar.isPending}
          onClick={() =>
            enviar.mutate({ propostaId: proposta.id, oportunidadeId }, { onSuccess: aoFechar })
          }
        >
          Sim, enviei
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={aoFechar}>
          Não
        </Button>
      </div>
      {itens.data !== undefined && !temItem && (
        <p className="text-muted-foreground">Adicione ao menos um item antes de enviar.</p>
      )}
    </div>
  );
}
