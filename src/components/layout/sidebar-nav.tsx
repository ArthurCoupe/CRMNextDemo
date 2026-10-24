import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareText,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { sairDaConta } from "@/integrations/supabase/sair";
import { iniciais } from "@/shared/lib/iniciais";
import { cn } from "@/lib/utils";
import { useProfile, type PapelDoUsuario } from "@/hooks/use-profile";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { gravarSidebarCompacta } from "@/shared/ui/sidebar-estado";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { avisarFalhaAoSair, fecharAvisoDeFalhaAoSair } from "./falha-ao-sair";
import { DialogoMeuPerfil } from "@/modules/settings/ui/dialogo-meu-perfil";

interface ItemDeNav {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly papeis?: readonly PapelDoUsuario[];
}

interface GrupoDeNav {
  readonly rotulo: string;
  readonly itens: readonly ItemDeNav[];
}

const GRUPOS: readonly GrupoDeNav[] = [
  {
    rotulo: "Operação",
    itens: [
      {
        to: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/pipeline",
        label: "Pipeline",
        icon: KanbanSquare,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/clients",
        label: "Clientes",
        icon: Building2,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/tasks",
        label: "Tarefas Internas",
        icon: ListTodo,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/meetings",
        label: "Reuniões",
        icon: Calendar,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/conteudo",
        label: "Conteúdo",
        icon: Megaphone,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/onboarding",
        label: "Onboarding",
        icon: Rocket,
        papeis: ["owner", "manager", "member"],
      },
    ],
  },
  {
    rotulo: "Gestão",
    itens: [
      { to: "/contracts", label: "Contratos", icon: FileText, papeis: ["owner", "manager"] },
      { to: "/financial", label: "Financeiro", icon: DollarSign, papeis: ["owner"] },
      {
        to: "/products",
        label: "Produtos",
        icon: Package,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/reports",
        label: "Relatórios",
        icon: BarChart3,
        papeis: ["owner", "manager", "member"],
      },
      { to: "/notificacoes", label: "Notificações", icon: Bell },
      { to: "/settings", label: "Configurações", icon: Settings, papeis: ["owner"] },
      { to: "/seguranca", label: "Segurança", icon: ShieldCheck },
    ],
  },
  {
    rotulo: "Conhecimento",
    itens: [
      {
        to: "/ai",
        label: "Assistente",
        icon: Sparkles,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/scripts",
        label: "Scripts",
        icon: MessageSquareText,
        papeis: ["owner", "manager", "member"],
      },
      {
        to: "/playbook",
        label: "Playbook",
        icon: BookOpen,
        papeis: ["owner", "manager", "member"],
      },
    ],
  },
];

const ROTULO_DO_PAPEL: Record<PapelDoUsuario, string> = {
  owner: "Sócio",
  manager: "Gestor",
  member: "Time",
  client: "Cliente",
};

const rootRouteApi = getRouteApi("__root__");

function ItemLink({
  item,
  ativo,
  compacta,
  aoNavegar,
}: {
  item: ItemDeNav;
  ativo: boolean;
  compacta: boolean;
  aoNavegar?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={aoNavegar}
      title={compacta ? item.label : undefined}
      className={cn(
        "relative flex min-h-[44px] md:min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
        compacta && "justify-center px-0",
        ativo
          ? "bg-sidebar-accent font-medium text-primary-texto before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-r-sm before:bg-primary"
          : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!compacta && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function ConteudoDaNav({ compacta, aoNavegar }: { compacta: boolean; aoNavegar?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { perfil, papel } = useProfile();
  const { tema } = rootRouteApi.useLoaderData();
  const ehStaff = papel === "owner" || papel === "manager" || papel === "member";
  const [perfilAberto, setPerfilAberto] = useState(false);

  const grupos = GRUPOS.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter(
      (item) => item.papeis === undefined || (papel !== null && item.papeis.includes(papel)),
    ),
  })).filter((grupo) => grupo.itens.length > 0);

  async function sair() {
    const { error } = await sairDaConta();
    if (error) avisarFalhaAoSair();
    else fecharAvisoDeFalhaAoSair();
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 border-b border-sidebar-border p-4",
          compacta && "justify-center p-3",
        )}
      >
        <img src="/logo.png" alt="Next Business" className="h-8 w-8 rounded-[7px] object-cover" />
        {!compacta && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Next CRM</p>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-sidebar-muted">
              Next Business
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {grupos.map((grupo) => (
          <div key={grupo.rotulo}>
            {!compacta && (
              <p className="px-2.5 pb-1 pt-3 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-sidebar-muted/70">
                {grupo.rotulo}
              </p>
            )}
            {compacta && <div className="my-2 border-t border-sidebar-border/60" />}
            {grupo.itens.map((item) => (
              <ItemLink
                key={item.to}
                item={item}
                compacta={compacta}
                aoNavegar={aoNavegar}
                ativo={item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {!compacta && perfil !== null && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-primary/30 bg-sidebar-accent text-[11px] font-semibold text-primary-texto">
              {iniciais(perfil.full_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{perfil.full_name}</p>
              <p className="text-[10px] text-sidebar-muted">{ROTULO_DO_PAPEL[perfil.role]}</p>
            </div>
          </div>
        )}
        {ehStaff && (
          <button
            type="button"
            onClick={() => setPerfilAberto(true)}
            aria-label="Meu perfil"
            title="Meu perfil"
            className={cn(
              "mb-1 flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground md:min-h-[38px]",
              compacta && "justify-center",
            )}
          >
            <UserRound className="h-4 w-4" aria-hidden /> {!compacta && "Meu perfil"}
          </button>
        )}
        {perfilAberto && <DialogoMeuPerfil onFechar={() => setPerfilAberto(false)} />}
        <div className={cn("flex items-center gap-1", compacta && "flex-col")}>
          <button
            type="button"
            onClick={() => void sair()}
            title="Sair"
            className={cn(
              "flex min-h-[44px] md:min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              compacta ? "justify-center" : "flex-1",
            )}
          >
            <LogOut className="h-4 w-4" /> {!compacta && "Sair"}
          </button>
          <ThemeToggle
            temaInicial={tema}
            className="grid min-h-[44px] md:min-h-[38px] min-w-[44px] md:min-w-[38px] place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          />
        </div>
      </div>
    </>
  );
}

export function SidebarNav({ compactaInicial }: { compactaInicial: boolean }) {
  const [compacta, setCompacta] = useState(compactaInicial);
  const [drawerAberto, setDrawerAberto] = useState(false);

  const alternarCompacta = () => {
    const proximo = !compacta;
    gravarSidebarCompacta(proximo);
    setCompacta(proximo);
  };

  return (
    <>
      <aside
        className={cn(
          "relative hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
          compacta ? "md:w-16" : "md:w-16 lg:w-[236px]",
        )}
      >
        <div className={cn("hidden h-full flex-col", !compacta && "lg:flex")}>
          <ConteudoDaNav compacta={false} />
        </div>
        <div className={cn("flex h-full flex-col", !compacta && "lg:hidden")}>
          <ConteudoDaNav compacta />
        </div>

        <button
          type="button"
          onClick={alternarCompacta}
          title={compacta ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3 top-[18px] z-50 hidden h-6 w-6 place-items-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-muted shadow-sm transition-colors hover:text-sidebar-foreground lg:grid"
        >
          {compacta ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      <Sheet open={drawerAberto} onOpenChange={setDrawerAberto}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menu"
            className="fixed left-3 top-3 z-50 grid h-11 w-11 place-items-center rounded-lg border border-sidebar-border bg-sidebar/90 text-sidebar-foreground backdrop-blur md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-[260px] flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <ConteudoDaNav compacta={false} aoNavegar={() => setDrawerAberto(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
