import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/shared/types/database.types";

type Papel = Database["public"]["Enums"]["app_role"];

let papel: Papel | null = null;

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  useRouterState: () => "/",
  getRouteApi: () => ({ useLoaderData: () => ({ tema: "dark" as const }) }),
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock("@/integrations/supabase/sair", () => ({
  sairDaConta: vi.fn(),
  sairSoDesteNavegador: vi.fn(),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ perfil: null, papel }),
}));

vi.mock("@/modules/settings/ui/dialogo-meu-perfil", () => ({ DialogoMeuPerfil: () => null }));

const { SidebarNav } = await import("./sidebar-nav");

afterEach(cleanup);

const STAFF = [
  "/",
  "/pipeline",
  "/clients",
  "/tasks",
  "/meetings",
  "/conteudo",
  "/onboarding",
  "/products",
  "/reports",
  "/ai",
  "/scripts",
  "/playbook",
];
const DE_TODO_MUNDO = ["/notificacoes", "/seguranca"];

const ESPERADO: Record<Papel, readonly string[]> = {
  owner: [...STAFF, "/contracts", "/financial", "/settings", ...DE_TODO_MUNDO],
  manager: [...STAFF, "/contracts", ...DE_TODO_MUNDO],
  member: [...STAFF, ...DE_TODO_MUNDO],
  client: DE_TODO_MUNDO,
};
const PAPEIS = Object.keys(ESPERADO) as Papel[];

function menuDo(p: Papel | null): string[] {
  papel = p;
  render(<SidebarNav compactaInicial={false} />);
  const hrefs = screen.queryAllByRole("link").map((a) => a.getAttribute("href") ?? "");
  cleanup();
  const vezes = new Map<string, number>();
  for (const h of hrefs) vezes.set(h, (vezes.get(h) ?? 0) + 1);
  expect([...vezes].filter(([, n]) => n !== 2)).toEqual([]);
  return [...vezes.keys()].sort();
}

function lerGuarda(fonte: string): string[] | null {
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const chamadas = codigo.match(/exigirPapel\s*\(/g) ?? [];
  if (chamadas.length === 0) return null;
  const casou = /exigirPapel\s*\(\s*\[([^\]]*)\]/.exec(codigo);
  if (chamadas.length > 1 || !casou) throw new Error("guarda de papel que o leitor não lê");
  return [...casou[1].matchAll(/["'](\w+)["']/g)].map((m) => m[1]);
}

function guardaDaRota(href: string): string[] | null {
  const arquivo = resolve(
    "src/routes/_authenticated",
    `${href === "/" ? "index" : href.slice(1)}.tsx`,
  );
  let fonte: string;
  try {
    fonte = readFileSync(arquivo, "utf8");
  } catch {
    throw new Error(`item de menu ${href} sem arquivo de rota em ${arquivo}`);
  }
  return lerGuarda(fonte);
}

describe("leitor de guarda (controle do teste de paridade)", () => {
  it.each([
    [
      "guarda em uma linha",
      `beforeLoad: ({ context }) => exigirPapel(["owner"], context.papel),`,
      ["owner"],
    ],
    [
      "guarda quebrada em linhas pelo prettier",
      `beforeLoad: ({ context }) =>\n    exigirPapel(\n      ["owner", "manager"],\n      context.papel,\n    ),`,
      ["owner", "manager"],
    ],
    [
      "guarda em bloco",
      `beforeLoad: ({ context }) => {\n  exigirPapel(["member"], context.papel);\n},`,
      ["member"],
    ],
    [
      "sem guarda, só o import",
      `import { exigirPapel } from "@/integrations/supabase/papel";`,
      null,
    ],
    ["guarda citada em JSDoc", `/**\n * \`/settings\` é \`exigirPapel(["owner"])\`\n */`, null],
    [
      "guarda comentada",
      `// beforeLoad: ({ context }) => exigirPapel(["owner"], context.papel),`,
      null,
    ],
  ])("%s", (_nome, fonte, esperado) => {
    expect(lerGuarda(fonte)).toEqual(esperado);
  });

  it("array em constante ou duas chamadas lançam, em vez de virar 'abre para todos'", () => {
    expect(() =>
      lerGuarda(`beforeLoad: ({ context }) => exigirPapel(SO_OWNER, context.papel),`),
    ).toThrow(/não lê/);
    expect(() => lerGuarda(`exigirPapel(["owner"], a); exigirPapel(["member"], b);`)).toThrow(
      /não lê/,
    );
  });
});

describe("menu lateral por papel", () => {
  it.each(PAPEIS)("%s vê exatamente os itens da tabela", (p) => {
    expect(menuDo(p)).toEqual([...ESPERADO[p]].sort());
  });

  it("sem papel ainda (perfil carregando) só aparecem os itens sem `papeis`", () => {
    expect(menuDo(null)).toEqual([...DE_TODO_MUNDO].sort());
  });

  it("todo item concorda com a guarda da rota, nos quatro papéis", () => {
    const todos = [...new Set(PAPEIS.flatMap((p) => menuDo(p)))].sort();
    const guardas = new Map(todos.map((href) => [href, guardaDaRota(href)]));

    expect(guardas.get("/financial")).toEqual(["owner"]);
    expect(guardas.get("/contracts")).toEqual(["owner", "manager"]);
    expect(guardas.get("/seguranca")).toBeNull();

    for (const p of PAPEIS) {
      const abre = todos.filter((href) => {
        const g = guardas.get(href) ?? null;
        return g === null || g.includes(p);
      });
      expect({ papel: p, menu: menuDo(p) }).toEqual({ papel: p, menu: abre });
    }
  });
});
