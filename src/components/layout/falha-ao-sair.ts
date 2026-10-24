import { toast } from "sonner";

import { sairSoDesteNavegador } from "@/integrations/supabase/sair";

const ID_DO_AVISO = "falha-ao-sair";

export function avisarFalhaAoSair(): void {
  toast.error("Não foi possível sair. Verifique a conexão e tente de novo.", {
    id: ID_DO_AVISO,
    description: "Se não der, saia só deste navegador. A sessão pode continuar ativa no servidor.",
    duration: 15_000,
    action: {
      label: "Sair só deste navegador",
      onClick: (evento) => {
        evento.preventDefault();
        toast.loading("Saindo deste navegador…", {
          id: ID_DO_AVISO,
          description: undefined,
          action: undefined,
        });
        void sairSoDesteNavegador().then(() => window.location.replace("/auth"));
      },
    },
  });
}

export function fecharAvisoDeFalhaAoSair(): void {
  toast.dismiss(ID_DO_AVISO);
}
