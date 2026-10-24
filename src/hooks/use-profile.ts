import { erroDoBanco } from "@/shared/lib/erro-do-banco";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client.browser";
import { useAuth } from "@/hooks/use-auth";

export type PapelDoUsuario = "owner" | "manager" | "member" | "client";

export interface PerfilDoUsuario {
  readonly full_name: string;
  readonly email: string;
  readonly role: PapelDoUsuario;
  readonly active: boolean;
  readonly job_title: string | null;
}

export function useProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: user !== null,
    queryFn: async (): Promise<PerfilDoUsuario | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, role, active, job_title")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      if (error) throw erroDoBanco(error);
      return data as PerfilDoUsuario | null;
    },
  });

  const perfil = query.data ?? null;

  return {
    perfil,
    papel: perfil !== null && perfil.active ? perfil.role : null,
    meuId: user?.id ?? null,
    carregando: query.isLoading,
  };
}
