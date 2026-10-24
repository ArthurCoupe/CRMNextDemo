import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { useRealtime } from "@/hooks/use-realtime";
import { FalhaAoLerPapel, obterPapel, type PapelDoUsuario } from "@/integrations/supabase/papel";
import { obterSessao } from "@/integrations/supabase/sessao";
import { MODO_DEMO } from "@/shared/lib/demo";
import { FaixaDaDemo } from "@/shared/ui/faixa-da-demo";
import { obterSidebarCompacta } from "@/shared/ui/sidebar-estado";

const SEM_REALTIME: readonly string[] = [];

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await obterSessao();
    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    let papel: PapelDoUsuario | null;
    try {
      ({ papel } = await obterPapel());
    } catch (erro) {
      if (erro instanceof FalhaAoLerPapel) {
        throw redirect({ to: "/conta-pendente", search: { motivo: "falha" } });
      }
      throw erro;
    }
    if (papel === null) {
      throw redirect({ to: "/conta-pendente", search: {} });
    }
    return { papel };
  },
  loader: async () => ({ sidebarCompacta: await obterSidebarCompacta() }),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useRealtime(SEM_REALTIME);

  const { sidebarCompacta } = Route.useLoaderData();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="contents print:hidden">
        <SidebarNav compactaInicial={sidebarCompacta} />
      </div>
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        {MODO_DEMO && <FaixaDaDemo />}
        <div className="mx-auto max-w-7xl space-y-5 p-5 pt-16 md:pt-5 lg:px-[22px] print:max-w-none print:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
