import { AlertTriangle, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EntradaDeSaude, SinalDeSaude, Severidade } from "../domain/health";

const ESTILO: Record<Severidade, string> = {
  critico: "border-destructive/40 bg-destructive/10 text-destructive",
  atencao: "border-amber-500/40 bg-amber-500/10 text-amber-500",
};

const AVISO_PARCIAL =
  "Avaliação incompleta: os sinais de renovação e de cobrança encerrada vêm dos contratos, e seu papel não lê os contratos deste cliente.";

export function ResumoDeSaude({
  sinais,
  parcial = false,
}: {
  sinais: readonly SinalDeSaude[];
  parcial?: boolean;
}) {
  if (sinais.length === 0) {
    return parcial ? (
      <span className="text-[11px] text-muted-foreground italic" title={AVISO_PARCIAL}>
        Sem sinais visíveis
      </span>
    ) : (
      <span className="text-[11px] text-muted-foreground">Sem sinais</span>
    );
  }
  const pior = sinais[0]!;
  const Icone = pior.severidade === "critico" ? ShieldAlert : AlertTriangle;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        ESTILO[pior.severidade],
      )}
      title={sinais.map((sinal) => `${sinal.rotulo}: ${sinal.detalhe}`).join("\n\n")}
    >
      <Icone className="h-3 w-3" aria-hidden />
      {pior.rotulo}
      {sinais.length > 1 && <span className="opacity-70">+{sinais.length - 1}</span>}
      {parcial && (
        <span className="opacity-70" title={AVISO_PARCIAL}>
          ·parcial
        </span>
      )}
    </span>
  );
}

function fraseSemSinais(entrada: EntradaDeSaude): string {
  const partes = ["Nenhum sinal de risco."];
  partes.push(entrada.diasSemContato !== null ? "Contato recente." : "Sem timeline registrada.");
  if (entrada.contratosAtivos > 0) partes.push("Cobrança em dia.");
  if (entrada.temResponsavel) partes.push("Responsável definido.");
  return partes.join(" ");
}

export function ListaDeSinais({
  sinais,
  entrada,
  parcial = false,
}: {
  sinais: readonly SinalDeSaude[];
  entrada: EntradaDeSaude;
  parcial?: boolean;
}) {
  if (sinais.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {parcial ? AVISO_PARCIAL : fraseSemSinais(entrada)}
      </p>
    );
  }

  return (
    <ul className="grid gap-1.5">
      {parcial && <li className="text-[11px] italic text-muted-foreground">{AVISO_PARCIAL}</li>}
      {sinais.map((sinal) => {
        const Icone = sinal.severidade === "critico" ? ShieldAlert : AlertTriangle;
        return (
          <li
            key={sinal.chave}
            className={cn("grid gap-0.5 rounded-md border px-2.5 py-1.5", ESTILO[sinal.severidade])}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <Icone className="h-3.5 w-3.5" aria-hidden />
              {sinal.rotulo}
            </span>
            <span className="text-[11px] opacity-90">{sinal.detalhe}</span>
          </li>
        );
      })}
    </ul>
  );
}
