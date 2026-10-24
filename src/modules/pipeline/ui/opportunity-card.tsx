import { useDraggable } from "@dnd-kit/core";
import { CalendarClock, Clock } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { isOverdue } from "@/shared/lib/date";
import { cn } from "@/lib/utils";

import type { OportunidadeListada } from "../api/pipeline.repository";
import { partesDoValorFechado, temValorFechado } from "../domain/closed-value";
import { seloDoPrimeiroContato, type PrimeiroContato } from "../domain/primeiro-contato";
import { calcularTier, type Tier } from "../domain/qualification";
import { followUpVencido } from "../domain/stage";

const COR_DA_BARRA: Record<Tier, string> = {
  A: "#e8b958",
  B: "#2e8fff",
  C: "#aaaaaa",
};
const COR_SEM_TIER = "#234a73";

interface OpportunityCardProps {
  oportunidade: OportunidadeListada;
  aoAbrir: (oportunidade: OportunidadeListada) => void;
  podeArrastar: boolean;
  selecionavel?: boolean;
  selecionado?: boolean;
  aoSelecionar?: (id: string) => void;
  primeiroContato?: PrimeiroContato;
  agora?: Date;
}

export function OpportunityCard({
  oportunidade,
  aoAbrir,
  podeArrastar,
  selecionavel = false,
  selecionado = false,
  aoSelecionar,
  primeiroContato,
  agora,
}: OpportunityCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({
      id: oportunidade.id,
      disabled: !podeArrastar,
      data: { nome: oportunidade.nome },
    });
  const valorFechado = { mrr: oportunidade.fechadoMrr, tcv: oportunidade.fechadoTcv };

  const tier = calcularTier(oportunidade.respostas);
  const cobrarFollowUp = followUpVencido(
    oportunidade.estagio,
    oportunidade.proximoFollowUp,
    isOverdue,
  );
  const selo =
    primeiroContato !== undefined && agora !== undefined
      ? seloDoPrimeiroContato(primeiroContato, agora)
      : null;

  return (
    <div
      ref={setNodeRef}
      className={cn("relative", isDragging && "opacity-40")}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...(podeArrastar ? listeners : {})}
        onClick={() => aoAbrir(oportunidade)}
        style={{ borderLeftColor: tier !== null ? COR_DA_BARRA[tier] : COR_SEM_TIER }}
        className={cn(
          "w-full rounded-md border border-l-2 bg-card p-2.5 text-left transition-colors",
          podeArrastar ? "cursor-grab" : "cursor-pointer",
          "hover:bg-accent/40",
          cobrarFollowUp && "shadow-[inset_2px_0_0_#34d399]",
          selecionavel && "pr-8",
        )}
      >
        <p className="text-[12.5px] font-semibold leading-tight tracking-tight">
          {oportunidade.nome}
        </p>

        <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
          {oportunidade.contatoNome ?? "Sem contato"}
          {oportunidade.responsavelNome !== null && ` · ${oportunidade.responsavelNome}`}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {tier !== null && (
            <span className="rounded-full border px-1.5 py-px text-[9.5px] font-semibold text-muted-foreground">
              Tier {tier}
            </span>
          )}
          {oportunidade.linhaDeNegocio !== null && (
            <span className="rounded-full border px-1.5 py-px text-[9.5px] text-muted-foreground">
              {oportunidade.linhaDeNegocio === "demanda" ? "Demanda" : "Sistemas"}
            </span>
          )}
          {(oportunidade.frentesEsperadas ?? []).map((frente) => (
            <span
              key={frente}
              className="rounded-full border px-1.5 py-px text-[9.5px] text-muted-foreground"
            >
              {frente}
            </span>
          ))}
          {cobrarFollowUp && (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-emerald-400">
              <CalendarClock className="h-2.5 w-2.5" aria-hidden />
              follow-up
            </span>
          )}
        </div>

        {selo !== null && (
          <p
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold tabular-nums",
              selo.atrasado ? "text-destructive" : "text-muted-foreground",
            )}
          >
            <Clock className="h-2.5 w-2.5" aria-hidden />
            {selo.texto}
          </p>
        )}

        {oportunidade.estagio === "fechado" && temValorFechado(valorFechado) && (
          <p className="mt-1.5 text-[11px] font-semibold text-emerald-400">
            {partesDoValorFechado(valorFechado).join(" · ")}
          </p>
        )}

        {oportunidade.estagio === "fechado" && oportunidade.clienteId === null && (
          <p className="mt-1.5 text-[10.5px] font-semibold text-amber-500">Sem contrato</p>
        )}
      </button>

      {selecionavel && (
        <Checkbox
          checked={selecionado}
          onCheckedChange={() => aoSelecionar?.(oportunidade.id)}
          aria-label={`Selecionar ${oportunidade.nome}`}
          className="absolute right-2 top-2"
        />
      )}
    </div>
  );
}
