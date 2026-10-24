import { Link } from "@tanstack/react-router";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { SituacaoDoSegundoFator } from "@/shared/lib/mfa";

import { lerSituacaoDoSegundoFator } from "../api/mfa.repository";

export function AvisoSegundoFator() {
  const [situacao, setSituacao] = useState<SituacaoDoSegundoFator | null>(null);

  useEffect(() => {
    let vivo = true;
    void lerSituacaoDoSegundoFator().then((s) => {
      if (vivo) setSituacao(s);
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (situacao === "sem-fator") {
    return (
      <Alert className="mb-4">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Proteja o financeiro com o app autenticador</AlertTitle>
        <AlertDescription>
          Com ele ativo, ler e editar dinheiro passa a pedir o código de 6 dígitos a cada login.{" "}
          <Link to="/seguranca" className="font-medium underline underline-offset-4">
            Ativar em Segurança
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (situacao === "falta-codigo") {
    return (
      <Alert variant="destructive" className="mb-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Falta o código do app autenticador</AlertTitle>
        <AlertDescription>
          Esta sessão entrou sem o código, e o financeiro só abre com ele. Saia e entre de novo
          digitando o código de 6 dígitos.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
