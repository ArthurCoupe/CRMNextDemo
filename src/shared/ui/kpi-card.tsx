import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Acento = "neutro" | "primario" | "sucesso" | "atencao" | "erro";

const COR_DO_ACENTO: Record<Acento, string> = {
  neutro: "text-foreground",
  primario: "text-primary-texto",
  sucesso: "text-success",
  atencao: "text-warning",
  erro: "text-destructive",
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: Acento;
  className?: string;
}

export function KpiCard({ label, value, detail, accent = "neutro", className }: KpiCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3.5", className)}>
      <p className="kicker">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-[23px] font-medium leading-tight tracking-tight tabular-nums",
          COR_DO_ACENTO[accent],
        )}
      >
        {value}
      </p>
      {detail !== undefined && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}
