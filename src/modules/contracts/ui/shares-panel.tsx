import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

import {
  atingiuOAlerta,
  custoMensalDaParticipacao,
  excedeOTeto,
  problemasDasParticipacoes,
  rotuloDoTipoDeParticipacao,
  somaDasParticipacoes,
  TETO_DE_PARTICIPACAO,
  type BaseDeCusto,
  type Participacao,
  type TipoDeParticipacao,
} from "../domain/shares";

const TIPOS: readonly TipoDeParticipacao[] = ["producao", "venda", "indicacao"];

export interface LinhaDeParticipacao extends Participacao {
  readonly id?: string;
  readonly doPadrao: boolean;
}

interface SharesPanelProps {
  readonly participacoes: readonly LinhaDeParticipacao[];
  readonly aoMudar: (participacoes: readonly LinhaDeParticipacao[]) => void;
  readonly base: BaseDeCusto | null;
  readonly pessoas: ReadonlyArray<{
    readonly id: string;
    readonly nome: string;
    readonly ativo?: boolean;
  }>;
  readonly limiarDeAlerta: number | null;
  readonly limiarConfirmado: boolean;
  readonly somenteLeitura?: boolean;
}

export function SharesPanel({
  participacoes,
  aoMudar,
  base,
  pessoas,
  limiarDeAlerta,
  limiarConfirmado,
  somenteLeitura = false,
}: SharesPanelProps) {
  const soma = somaDasParticipacoes(participacoes);
  const estourou = excedeOTeto(participacoes);
  const alerta = atingiuOAlerta(participacoes, limiarDeAlerta);

  const problemas = problemasDasParticipacoes(participacoes);
  const problemasPorLinha = new Map<number, string[]>();
  for (const problema of problemas) {
    const atuais = problemasPorLinha.get(problema.indice) ?? [];
    atuais.push(problema.mensagem);
    problemasPorLinha.set(problema.indice, atuais);
  }

  function definir(indice: number, mudanca: Partial<LinhaDeParticipacao>) {
    aoMudar(participacoes.map((p, i) => (i === indice ? { ...p, ...mudanca } : p)));
  }

  function remover(indice: number) {
    aoMudar(participacoes.filter((_, i) => i !== indice));
  }

  function acrescentar() {
    aoMudar([
      ...participacoes,
      { perfilId: null, nomeExterno: null, tipo: "venda", percentual: 0, doPadrao: false },
    ]);
  }

  return (
    <section className="grid gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Participações
        </h3>
        {!somenteLeitura && (
          <Button type="button" variant="outline" size="sm" onClick={acrescentar}>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Acrescentar
          </Button>
        )}
      </header>

      {participacoes.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhuma participação. Este contrato não gera custo de comissão.
        </p>
      )}

      {participacoes.map((p, indice) => {
        const custo = base === null ? null : custoMensalDaParticipacao(base, p.percentual);
        return (
          <div
            key={indice}
            className="grid gap-2 rounded-md border p-2.5 sm:grid-cols-[1fr_9rem_7rem_auto] sm:items-end"
          >
            <div className="grid gap-1">
              <Label className="text-[11px]">Beneficiário</Label>
              <Select
                value={p.perfilId ?? "externo"}
                disabled={somenteLeitura}
                onValueChange={(valor) =>
                  definir(indice, {
                    perfilId: valor === "externo" ? null : valor,
                    nomeExterno: valor === "externo" ? (p.nomeExterno ?? "") : null,
                  })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Quem recebe" />
                </SelectTrigger>
                <SelectContent>
                  {pessoas.map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id} disabled={pessoa.ativo === false}>
                      {pessoa.ativo === false ? `${pessoa.nome} (desativada)` : pessoa.nome}
                    </SelectItem>
                  ))}
                  <SelectItem value="externo">De fora do time…</SelectItem>
                </SelectContent>
              </Select>
              {p.perfilId === null && (
                <Input
                  className="mt-1 h-8"
                  placeholder="Nome de quem indicou"
                  value={p.nomeExterno ?? ""}
                  disabled={somenteLeitura}
                  onChange={(e) => definir(indice, { nomeExterno: e.target.value })}
                />
              )}
            </div>

            <div className="grid gap-1">
              <Label className="text-[11px]">Tipo</Label>
              <Select
                value={p.tipo}
                disabled={somenteLeitura}
                onValueChange={(valor) => definir(indice, { tipo: valor as TipoDeParticipacao })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {rotuloDoTipoDeParticipacao(tipo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label className="text-[11px]">%</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                className="h-8 tabular-nums"
                value={p.percentual === 0 ? "" : String(p.percentual)}
                disabled={somenteLeitura}
                onChange={(e) => definir(indice, { percentual: Number(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center gap-2 sm:pb-1">
              <span className="min-w-[5.5rem] text-right text-xs tabular-nums text-muted-foreground">
                {custo === null ? "-" : `${brl(custo)}/mês`}
              </span>
              {!somenteLeitura && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => remover(indice)}
                  aria-label="Remover participação"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
            </div>

            {p.doPadrao && (
              <p className="text-[10.5px] text-muted-foreground sm:col-span-4">
                Sugerida pelo padrão desta linha de negócio. Editar ou remover aqui vale só para
                este contrato.
              </p>
            )}

            {(problemasPorLinha.get(indice) ?? []).map((mensagem) => (
              <p
                key={mensagem}
                className="flex items-start gap-1.5 text-[10.5px] text-destructive sm:col-span-4"
              >
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
                {mensagem}
              </p>
            ))}
          </div>
        );
      })}

      <div
        className={cn(
          "flex items-center justify-between rounded-md border px-3 py-2 text-xs",
          estourou && "border-destructive/40 bg-destructive/10",
          !estourou && alerta && "border-amber-500/40 bg-amber-500/10",
        )}
      >
        <span className="text-muted-foreground">
          Total: venda + produção + indicação
          <span className="ml-1 text-[10.5px]">(teto {TETO_DE_PARTICIPACAO}%)</span>
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            estourou && "text-destructive",
            !estourou && alerta && "text-amber-400",
          )}
        >
          {soma.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
        </span>
      </div>

      {estourou && (
        <p className="flex items-start gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Acima do teto. O banco recusa: os três tipos incidem sobre o mesmo valor do contrato.
        </p>
      )}

      {!estourou && alerta && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-400">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {limiarDeAlerta}% ou mais do contrato sai em participação.
          {!limiarConfirmado && (
            <span className="text-muted-foreground">
              {" "}
              Este limiar veio do protótipo e ainda não foi confirmado.
            </span>
          )}
        </p>
      )}
    </section>
  );
}
