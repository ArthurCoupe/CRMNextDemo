import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { colunasPedidas } = vi.hoisted(() => ({ colunasPedidas: [] as string[] }));

const LINHA: Readonly<Record<string, unknown>> = {
  full_name: "Marina Silva",
  email: "marina@example.com",
  role: "member",
  active: true,
  job_title: "SDR",
};

vi.mock("@/integrations/supabase/client.browser", () => ({
  supabase: {
    from: () => ({
      select: (colunas: string) => {
        colunasPedidas.push(colunas);
        const projetada = Object.fromEntries(
          colunas.split(",").map((c) => [c.trim(), LINHA[c.trim()]]),
        );
        return {
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: projetada, error: null }),
          }),
        };
      },
    }),
  },
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

const { useProfile } = await import("./use-profile");

describe("useProfile traz o cargo (A1.5)", () => {
  it("projeta job_title e entrega o cargo junto do papel", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useProfile(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children),
    });

    await waitFor(() => expect(result.current.perfil).not.toBeNull());

    expect(colunasPedidas[0]).toContain("job_title");
    expect(result.current.perfil?.job_title).toBe("SDR");
    expect(result.current.papel).toBe("member");
  });
});
