import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { brl } from "@/shared/lib/format";
import { useMudou } from "@/shared/lib/use-mudou";
import { estadoDaConsulta, piorEstado } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import {
  custoMensalTotal,
  excedeOTeto,
  geraCustoAgora,
  problemasDasParticipacoes,
  TETO_DE_PARTICIPACAO,
  type BaseDeCusto,
} from "../domain/shares";
import type { ContratoListado } from "../api/contracts.repository";
import type { ParticipacaoGravada } from "../api/shares.repository";
import {
  useGravarParticipacoes,
  useParticipacoes,
  useLimiarDeAlerta,
  usePessoasParaParticipacao,
} from "../hooks/use-shares";
import { SharesPanel, type LinhaDeParticipacao } from "./shares-panel";

interface ContractSharesSectionProps {
  readonly contrato: ContratoListado;
}

function rascunhoDoLido(gravadas: readonly ParticipacaoGravada[]): LinhaDeParticipacao[] {
  return gravadas.map((g) => ({ ...g, doPadrao: false }));
}

export function ContractSharesSection({ contrato }: ContractSharesSectionProps) {
  const { papel } = useProfile();
  const consultaDeParticipacoes = useParticipacoes(contrato.id);
  const perfisAPreservar = (consultaDeParticipacoes.data ?? [])
    .filter((gravada) => gravada.perfilDesativado)
    .map((gravada) => gravada.perfilId)
    .filter((perfilId): perfilId is string => perfilId !== null);
  const consultaDePessoas = usePessoasParaParticipacao(perfisAPreservar);
  const consultaDoLimiar = useLimiarDeAlerta();
  const gravar = useGravarParticipacoes();

  const gravadas = consultaDeParticipacoes.data;
  const pessoas = consultaDePessoas.data ?? [];
  const limiar = consultaDoLimiar.data;

  const estado = piorEstado(
    estadoDaConsulta(consultaDeParticipacoes),
    estadoDaConsulta(consultaDePessoas),
    estadoDaConsulta(consultaDoLimiar),
  );

  const [rascunho, setRascunho] = useState<LinhaDeParticipacao[]>(() =>
    gravadas === undefined ? [] : rascunhoDoLido(gravadas),
  );
  const leuDeNovo = useMudou(gravadas);
  if (leuDeNovo && gravadas !== undefined) setRascunho(rascunhoDoLido(gravadas));

  const base: BaseDeCusto = {
    tipo: contrato.tipo,
    valorMensal: contrato.valorMensal,
    valorTotal: contrato.valorTotal,
    mesesDeCobranca: contrato.mesesDeCobranca,
    comissionavel: contrato.comissionavel,
    status: contrato.status,
    cobrancaAtiva: contrato.cobrancaAtiva,
  };

  const total = custoMensalTotal(base, rascunho);
  const emCurso = gravar.isPending;

  const motivoDoBloqueio = excedeOTeto(rascunho)
    ? `Gravar fica travado: o total passa do teto de ${TETO_DE_PARTICIPACAO}%.`
    : problemasDasParticipacoes(rascunho).length > 0
      ? "Gravar fica travado: corrija ou remova as linhas apontadas acima."
      : null;
  const podeGravar = motivoDoBloqueio === null && !emCurso;

  async function sincronizar(novas: readonly LinhaDeParticipacao[]) {
    if (gravadas === undefined) {
      toast.error("As participações deste contrato não foram lidas. Recarregue antes de gravar.");
      return;
    }

    const anterior = rascunhoDoLido(gravadas);
    setRascunho([...novas]);

    try {
      await gravar.mutateAsync({
        contratoId: contrato.id,
        linhas: novas
          .filter((nova) => nova.percentual > 0)
          .map((nova) => ({
            id: nova.id,
            perfilId: nova.perfilId,
            nomeExterno: nova.nomeExterno,
            tipo: nova.tipo,
            percentual: nova.percentual,
          })),
      });
    } catch (erro) {
      setRascunho(anterior);
      toast.error(
        erro instanceof Error ? erro.message : "Não foi possível gravar as participações.",
      );
    }
  }

  if (papel !== "owner") {
    return (
      <div className="grid gap-2 border-t pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Participações
        </h3>
        <p className="rounded-md border border-dashed px-3 py-3 text-center text-[11px] text-muted-foreground">
          Seu papel não lê participações deste contrato. Isto <strong>não</strong> quer dizer que
          não há nenhuma, quer dizer que a informação não está visível para você.
        </p>
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <div className="grid gap-2 border-t pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Participações
        </h3>
        <FalhaAoLer oQue="as participações deste contrato" />
        <p className="text-[11px] text-muted-foreground">
          A edição fica bloqueada até a leitura voltar. Gravar por cima de um rascunho que nasceu de
          uma leitura falha apagaria participações que o banco ainda tem.
        </p>
      </div>
    );
  }

  if (estado === "carregando") {
    return <div className="h-24 animate-pulse rounded-xl border bg-card" />;
  }

  return (
    <div className="grid gap-3 border-t pt-4">
      <SharesPanel
        participacoes={rascunho}
        aoMudar={(novas) => setRascunho([...novas])}
        base={base}
        pessoas={pessoas}
        limiarDeAlerta={limiar?.percentual ?? null}
        limiarConfirmado={limiar?.confirmado ?? false}
      />

      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          Custo mensal das participações
          {!geraCustoAgora(base) && (
            <span className="ml-1 text-[10.5px]">
              (este contrato não gera custo agora: cancelado, sem cobrança ou não comissionável)
            </span>
          )}
        </span>
        <span className="font-semibold tabular-nums">{total === null ? "-" : brl(total)}</span>
      </div>

      <div className="flex items-center justify-end gap-3">
        {motivoDoBloqueio !== null && (
          <p className="flex items-start gap-1.5 text-[11px] text-destructive">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {motivoDoBloqueio}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!podeGravar}
          onClick={() => void sincronizar(rascunho)}
        >
          {emCurso ? "Gravando…" : "Gravar participações"}
        </Button>
      </div>
    </div>
  );
}
