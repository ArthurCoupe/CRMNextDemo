import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";

import { lerMetasDeAtividade } from "../api/settings.repository";
import { MetasSettings } from "./metas-settings";

vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_de_teste");
});
afterAll(() => vi.unstubAllEnvs());

vi.mock("../api/settings.repository", () => ({
  lerMetasDeAtividade: vi.fn(async () => ({ toquesSemana: 40, r1Semana: 12, confirmado: false })),
  lerMetasFinanceiras: vi.fn(async () => ({ mrrMensal: 16000, tcvAlvo: 60000, confirmado: false })),
  salvarMetas: vi.fn(),
  lerTime: vi.fn(),
  atualizarPerfil: vi.fn(),
  definirPapelDaPessoa: vi.fn(),
  definirSituacaoDaPessoa: vi.fn(),
}));

async function digitarERefazer(qc: QueryClient): Promise<HTMLElement> {
  render(
    <QueryClientProvider client={qc}>
      <MetasSettings />
    </QueryClientProvider>,
  );
  const campo = await screen.findByLabelText("Toques por semana");
  await waitFor(() => expect(campo).toHaveValue("40"));
  const leiturasAntes = vi.mocked(lerMetasDeAtividade).mock.calls.length;

  fireEvent.change(campo, { target: { value: "55" } });
  await act(() => qc.refetchQueries());
  await act(() => new Promise<void>((pronto) => setTimeout(pronto, 50)));

  expect(vi.mocked(lerMetasDeAtividade).mock.calls.length).toBeGreaterThan(leiturasAntes);
  return campo;
}

describe("Metas: refetch com o mesmo conteúdo", () => {
  it("🔴 não apaga o que a pessoa digitou", async () => {
    const campo = await digitarERefazer(new QueryClient());

    expect(campo).toHaveValue("55");
  });

  it("controle: sem structural sharing, o mesmo refetch apaga (o teste acima enxerga a perda)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { structuralSharing: false } } });
    const campo = await digitarERefazer(qc);

    expect(campo).toHaveValue("40");
  });
});
