import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { ContratoListado } from "../api/contracts.repository";
import { listarParticipacoes } from "../api/shares.repository";
import { ContractSharesSection } from "./contract-shares-section";

vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_de_teste");
});
afterAll(() => vi.unstubAllEnvs());

const MARINA = "22222222-2222-4222-8222-222222222222";
const MEIRE = "44444444-4444-4444-8444-444444444444";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: vi.fn(() => ({ perfil: null, papel: "owner", meuId: "u1", carregando: false })),
}));
vi.mock("../api/shares.repository", () => ({
  listarParticipacoes: vi.fn(async () => [
    {
      id: "a",
      contratoId: "contrato-1",
      perfilId: "22222222-2222-4222-8222-222222222222",
      nomeExterno: null,
      tipo: "venda",
      percentual: 50,
      beneficiario: "Marina",
      perfilDesativado: false,
    },
    {
      id: "b",
      contratoId: "contrato-1",
      perfilId: "44444444-4444-4444-8444-444444444444",
      nomeExterno: null,
      tipo: "producao",
      percentual: 50,
      beneficiario: "Meire",
      perfilDesativado: false,
    },
  ]),
  listarPessoasParaParticipacao: vi.fn(async () => [
    { id: MARINA, nome: "Marina", ativo: true },
    { id: MEIRE, nome: "Meire", ativo: true },
  ]),
  lerLimiarDeAlerta: vi.fn(async () => ({ percentual: null, confirmado: false })),
  gravarParticipacoes: vi.fn(),
  adicionarPadrao: vi.fn(),
  atualizarPadrao: vi.fn(),
  desativarPadrao: vi.fn(),
  salvarLimiarDeAlerta: vi.fn(),
  listarContratosSemParticipacao: vi.fn(),
  listarPadroesDaLinhaDeNegocio: vi.fn(),
  listarTodosOsPadroes: vi.fn(),
}));

const CONTRATO = {
  id: "contrato-1",
  clienteId: "cliente-1",
  nome: "Contrato Teste",
  tipo: "mrr",
  linhaDeNegocio: "sistemas",
  valorMensal: 1000,
  valorTotal: null,
  mesesDeCobranca: null,
  cobrancaAtiva: true,
  firme: true,
  status: "active",
  nomeDoCliente: "Cliente Teste",
  inicio: "2026-01-01",
  fim: null,
  meioDePagamento: "pix",
  parcelas: null,
  comissionavel: true,
  prazoDeEntrega: null,
  observacoes: null,
  itens: [],
  duracaoMeses: null,
  mesesDeFidelidade: null,
  motivoDaPausa: null,
  oportunidadeId: null,
} as ContratoListado;

const percentuais = () =>
  screen.getAllByRole("spinbutton").map((i) => (i as HTMLInputElement).value);

async function digitarERefazer(qc: QueryClient): Promise<void> {
  render(
    <QueryClientProvider client={qc}>
      <ContractSharesSection contrato={CONTRATO} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(percentuais()).toEqual(["50", "50"]));
  const leiturasAntes = vi.mocked(listarParticipacoes).mock.calls.length;

  fireEvent.change(screen.getAllByRole("spinbutton")[0] as HTMLElement, {
    target: { value: "45" },
  });
  await act(() => qc.refetchQueries());
  await act(() => new Promise<void>((pronto) => setTimeout(pronto, 50)));

  expect(vi.mocked(listarParticipacoes).mock.calls.length).toBeGreaterThan(leiturasAntes);
}

describe("Participações: refetch com o mesmo conteúdo", () => {
  it("🔴 não apaga o que a pessoa digitou", async () => {
    await digitarERefazer(new QueryClient());

    expect(percentuais()).toEqual(["45", "50"]);
  });

  it("controle: sem structural sharing, o mesmo refetch apaga (o teste acima enxerga a perda)", async () => {
    await digitarERefazer(
      new QueryClient({ defaultOptions: { queries: { structuralSharing: false } } }),
    );

    expect(percentuais()).toEqual(["50", "50"]);
  });
});
