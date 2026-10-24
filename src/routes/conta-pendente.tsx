import { createFileRoute } from "@tanstack/react-router";

import { avisarFalhaAoSair } from "@/components/layout/falha-ao-sair";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sairDaConta } from "@/integrations/supabase/sair";

interface BuscaContaPendente {
  motivo?: "falha";
}

export const Route = createFileRoute("/conta-pendente")({
  validateSearch: (busca: Record<string, unknown>): BuscaContaPendente => ({
    motivo: busca.motivo === "falha" ? "falha" : undefined,
  }),
  component: ContaPendentePage,
});

function ContaPendentePage() {
  const { motivo } = Route.useSearch();
  if (motivo === "falha") return <FalhaAoLerOPapel />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-4 p-8 text-center shadow-lg">
        <div>
          <h1 className="text-xl font-semibold">Não foi possível confirmar seu acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu login funcionou e sua conta existe, mas não deu para confirmar agora que o acesso ao
            CRM está liberado. Duas causas possíveis:
          </p>
        </div>
        <ul className="space-y-1.5 text-left text-xs text-muted-foreground">
          <li>
            <strong className="text-foreground">A conta ainda não foi liberada</strong>: quem libera
            é um owner, em Configurações → Equipe.
          </li>
          <li>
            <strong className="text-foreground">Foi uma falha momentânea de leitura</strong>: clique
            em "Tentar de novo" abaixo.
          </li>
        </ul>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => window.location.assign("/")}
          >
            Tentar de novo
          </Button>
          <Button
            type="button"
            className="w-full"
            onClick={async () => {
              const { error } = await sairDaConta();
              if (error) return avisarFalhaAoSair();
              window.location.assign("/auth");
            }}
          >
            Sair
          </Button>
        </div>
      </Card>
    </div>
  );
}

function FalhaAoLerOPapel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-4 p-8 text-center shadow-lg">
        <div>
          <h1 className="text-xl font-semibold">Não foi possível confirmar seu acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Não conseguimos ler seu papel agora. Tente de novo em instantes.
          </p>
        </div>
        <Button type="button" className="w-full" onClick={() => window.location.assign("/")}>
          Tentar de novo
        </Button>
      </Card>
    </div>
  );
}
