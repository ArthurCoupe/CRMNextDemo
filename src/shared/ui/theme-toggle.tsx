import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { aplicarTema, type Tema } from "@/shared/ui/tema";

export function ThemeToggle({ temaInicial, className }: { temaInicial: Tema; className?: string }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  const alternar = () => {
    const proximo: Tema = tema === "dark" ? "light" : "dark";
    aplicarTema(proximo);
    setTema(proximo);
  };

  return (
    <button
      type="button"
      onClick={alternar}
      className={className}
      aria-label={tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={tema === "dark" ? "Tema claro" : "Tema escuro"}
    >
      {tema === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
