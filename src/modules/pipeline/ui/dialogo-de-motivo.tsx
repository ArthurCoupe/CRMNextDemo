import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { plural } from "@/shared/lib/format";

import type { OportunidadeListada } from "../api/pipeline.repository";
import type { EstagioDoPipeline, MotivoDeSaida } from "../domain/pipeline";
import { motivoExigidoPor, type MotivoDeSaidaEscolhido } from "../domain/saida";
import { useMotivos, useMoverEstagio } from "../hooks/use-pipeline";

export function SeletorDeMotivo({
  id,
  exigido,
  motivos,
  valor,
  disabled,
  className,
  aoEscolher,
}: {
  id: string;
  exigido: "descarte" | "perda";
  motivos: readonly MotivoDeSaida[];
  valor: string | null;
  disabled: boolean;
  className?: string;
  aoEscolher: (motivoId: string) => void;
}) {
  const opcoes = motivos.filter((m) => m.tipo === exigido && (m.ativo || m.id === valor));

  return (
    <Select
      value={valor ?? ""}
      disabled={disabled}
      onValueChange={(escolha) => {
        if (!opcoes.some((m) => m.id === escolha)) return;
        aoEscolher(escolha);
      }}
    >
      <SelectTrigger id={id} aria-label="Motivo" className={className}>
        <SelectValue placeholder="Escolha o motivo" />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type SaidaPendente =
  | {
      oportunidade: OportunidadeListada;
      destino: EstagioDoPipeline;
      lote?: undefined;
    }
  | {
      oportunidade?: undefined;
      destino: EstagioDoPipeline;
      lote: { pipelineId: string; quantidade: number };
    };

export function DialogoDeMotivo({
  saindo,
  aoFechar,
  aoConfirmarLote,
  pendente = false,
}: {
  saindo: SaidaPendente | null;
  aoFechar: () => void;
  aoConfirmarLote?: (motivo: MotivoDeSaidaEscolhido) => void;
  pendente?: boolean;
}) {
  const mover = useMoverEstagio();
  const motivos = useMotivos(
    saindo === null ? null : (saindo.oportunidade?.pipelineId ?? saindo.lote?.pipelineId ?? null),
  );
  const [motivoId, setMotivoId] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const emVoo = mover.isPending || pendente;

  const chaveDeAbertura =
    saindo === null ? null : (saindo.oportunidade?.id ?? `lote:${saindo.destino.id}`);
  const [ultimaAbertura, setUltimaAbertura] = useState<string | null>(null);
  if (chaveDeAbertura !== ultimaAbertura) {
    setUltimaAbertura(chaveDeAbertura);
    setMotivoId(null);
    setObs("");
  }

  const exigido = saindo !== null ? motivoExigidoPor(saindo.destino.tipo) : null;

  const opcoes = (motivos.data ?? []).filter((m) => m.tipo === exigido && m.ativo);
  const semMotivoAtivo = motivos.data !== undefined && opcoes.length === 0;

  function aoConfirmar() {
    if (saindo === null || exigido === null || motivoId === null) return;
    const motivoDeSaida: MotivoDeSaidaEscolhido = {
      tipo: exigido,
      motivoId,
      obs: obs.trim() || null,
    };

    if (saindo.lote !== undefined) {
      aoConfirmarLote?.(motivoDeSaida);
      return;
    }

    mover.mutate(
      {
        oportunidadeId: saindo.oportunidade.id,
        destino: saindo.destino,
        estagioAtualId: saindo.oportunidade.estagioId,
        motivo: motivoDeSaida,
        pipelineId: saindo.oportunidade.pipelineId,
      },
      {
        onSuccess: () => aoFechar(),
        onError: (erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível mover."),
      },
    );
  }

  return (
    <Dialog open={saindo !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-w-md">
        {saindo !== null && exigido !== null && (
          <>
            <DialogHeader>
              <DialogTitle>
                {exigido === "descarte" ? "Descartar oportunidade" : "Marcar como perdida"}
              </DialogTitle>
              <DialogDescription>
                {saindo.lote !== undefined
                  ? `${plural(saindo.lote.quantidade, "oportunidade", "oportunidades")}: o motivo é obrigatório e vale para todas. Cancelar não move nenhuma.`
                  : `${saindo.oportunidade.nome}: o motivo é obrigatório. Cancelar não move o card.`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-1">
                {motivos.isError ? (
                  <p
                    role="status"
                    className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                  >
                    Não foi possível ler os motivos deste pipeline. Recarregue a página; se
                    persistir, é falha de conexão com o banco.
                  </p>
                ) : semMotivoAtivo ? (
                  <p
                    role="status"
                    className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500"
                  >
                    Este pipeline não tem motivo de {exigido} ativo. Cadastre em Configurações para
                    poder mover o card para este estágio.
                  </p>
                ) : (
                  <>
                    <Label htmlFor="motivo-de-saida">Motivo</Label>
                    <SeletorDeMotivo
                      id="motivo-de-saida"
                      exigido={exigido}
                      motivos={opcoes}
                      valor={motivoId}
                      disabled={emVoo || motivos.isPending}
                      aoEscolher={setMotivoId}
                    />
                  </>
                )}
              </div>

              <div className="grid gap-1">
                <Label htmlFor="motivo-obs">Observação (opcional)</Label>
                <Textarea
                  id="motivo-obs"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="min-h-16 text-xs"
                />
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={aoFechar} disabled={emVoo}>
                Cancelar
              </Button>
              <Button type="button" onClick={aoConfirmar} disabled={motivoId === null || emVoo}>
                {emVoo ? "Movendo…" : "Confirmar"}
              </Button>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
