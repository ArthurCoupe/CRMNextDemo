import { Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AccessDeniedProps {
  exigido?: string;
  className?: string;
}

function saidaPara(exigido: string | undefined): { to: "/" | "/notificacoes"; texto: string } {
  return exigido !== undefined && exigido.split(",").some((p) => p.trim() === "member")
    ? { to: "/notificacoes", texto: "Ir para Notificações" }
    : { to: "/", texto: "Voltar ao início" };
}

export function AccessDenied({ exigido, className }: AccessDeniedProps) {
  const saida = saidaPara(exigido);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      <ShieldOff className="h-10 w-10 text-muted-foreground/60" aria-hidden />
      <p className="text-base font-semibold">Área restrita</p>
      <p className="max-w-md text-xs text-muted-foreground">
        {exigido !== undefined && exigido !== ""
          ? `Esta área é exclusiva de quem tem papel de ${exigido}. Seu acesso atual não inclui esse papel.`
          : "Seu acesso atual não inclui esta área."}
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        Se você deveria ter acesso, peça a um sócio para ajustar seu papel em Configurações.
      </p>
      <Button asChild size="sm" className="mt-2">
        <Link to={saida.to}>{saida.texto}</Link>
      </Button>
    </div>
  );
}
