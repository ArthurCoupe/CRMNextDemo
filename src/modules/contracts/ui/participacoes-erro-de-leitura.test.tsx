import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContratoListado } from "../api/contracts.repository";
import { ContractSharesSection } from "./contract-shares-section";
import { DefaultSharesSettings } from "./default-shares-settings";
import {
  useAdicionarPadrao,
  useAtualizarPadrao,
  useContratosSemParticipacao,
  useDesativarPadrao,
  useGravarParticipacoes,
  useLimiarDeAlerta,
  useParticipacoes,
  usePessoasParaParticipacao,
  useSalvarLimiarDeAlerta,
  useTodosOsPadroes,
} from "../hooks/use-shares";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: vi.fn(() => ({ perfil: null, papel: "owner", meuId: "u1", carregando: false })),
}));

vi.mock("../hooks/use-shares", () => ({
  useParticipacoes: vi.fn(),
  usePessoasParaParticipacao: vi.fn(),
  useLimiarDeAlerta: vi.fn(),
  useSalvarLimiarDeAlerta: vi.fn(),
  useGravarParticipacoes: vi.fn(),
  useTodosOsPadroes: vi.fn(),
  useAtualizarPadrao: vi.fn(),
  useAdicionarPadrao: vi.fn(),
  useDesativarPadrao: vi.fn(),
  useContratosSemParticipacao: vi.fn(),
}));

const EM_ERRO = { data: undefined, isError: true, isPending: false };
const pronto = (data: unknown) => ({ data, isError: false, isPending: false });
const mutacao = () => ({ mutateAsync: vi.fn(), isPending: false });

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

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useParticipacoes).mockReturnValue(pronto([]) as never);
  vi.mocked(usePessoasParaParticipacao).mockReturnValue(pronto([]) as never);
  vi.mocked(useLimiarDeAlerta).mockReturnValue(
    pronto({ percentual: 50, confirmado: true }) as never,
  );
  vi.mocked(useGravarParticipacoes).mockReturnValue(mutacao() as never);
  vi.mocked(useTodosOsPadroes).mockReturnValue(pronto([]) as never);
  vi.mocked(useAtualizarPadrao).mockReturnValue(mutacao() as never);
  vi.mocked(useAdicionarPadrao).mockReturnValue(mutacao() as never);
  vi.mocked(useDesativarPadrao).mockReturnValue(mutacao() as never);
  vi.mocked(useSalvarLimiarDeAlerta).mockReturnValue(mutacao() as never);
  vi.mocked(useContratosSemParticipacao).mockReturnValue(
    pronto({ contratos: [], truncado: false }) as never,
  );
});

describe("ContractSharesSection — falha de leitura", () => {
  it("não exibe R$ 0,00 nem oferece gravar quando as participações não foram lidas", () => {
    vi.mocked(useParticipacoes).mockReturnValue(EM_ERRO as never);

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(screen.getByText(/não foi possível ler/i)).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/R\$/);
    expect(screen.queryByRole("button", { name: /gravar participações/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /acrescentar/i })).toBeNull();
  });

  it("bloqueia a edição também quando quem falha é a lista de pessoas", () => {
    vi.mocked(usePessoasParaParticipacao).mockReturnValue(EM_ERRO as never);

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(screen.getByText(/não foi possível ler/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gravar participações/i })).toBeNull();
  });

  it("com leitura pronta e nenhuma participação, aí sim mostra o total zerado", () => {
    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(screen.getByRole("button", { name: /gravar participações/i })).toBeInTheDocument();
    expect(document.body.textContent ?? "").toMatch(/0,00/);
    expect(screen.queryByText(/não foi possível ler/i)).toBeNull();
  });
});

describe("DefaultSharesSettings — falha de leitura", () => {
  it("não afirma 'nenhum padrão configurado' nem a decisão da Demanda quando a leitura falha", () => {
    vi.mocked(useTodosOsPadroes).mockReturnValue(EM_ERRO as never);

    render(<DefaultSharesSettings />);

    expect(screen.getByText(/não foi possível ler/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhuma participação padrão configurada/i)).toBeNull();
    expect(screen.queryByText(/demanda não tem participação padrão/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^gravar$/i })).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("não atesta 'todo contrato ativo tem participação' quando o backfill falha", () => {
    vi.mocked(useContratosSemParticipacao).mockReturnValue(EM_ERRO as never);

    render(<DefaultSharesSettings />);

    expect(screen.queryByText(/todo contrato ativo tem ao menos uma participação/i)).toBeNull();
    expect(screen.getByText(/os contratos ativos sem participação/i)).toBeInTheDocument();
  });

  it("🔴 com padrão cadastrado, o campo e o Gravar EXISTEM — sem isto as negativas acima passam sozinhas", () => {
    vi.mocked(useTodosOsPadroes).mockReturnValue(
      pronto([
        {
          id: "p1",
          linhaDeNegocio: "sistemas",
          perfilId: "33333333-3333-4333-8333-333333333333",
          beneficiario: "Produção",
          tipo: "producao",
          percentual: 10,
        },
      ]) as never,
    );

    render(<DefaultSharesSettings />);

    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^gravar$/i })).toBeInTheDocument();
    expect(screen.queryByText(/nenhuma participação padrão configurada/i)).toBeNull();
  });

  it("🔴 padrões lidos e pessoas em erro: o aviso entra e a edição NÃO (o Select abriria vazio)", () => {
    vi.mocked(useTodosOsPadroes).mockReturnValue(
      pronto([
        {
          id: "p1",
          linhaDeNegocio: "sistemas",
          perfilId: "33333333-3333-4333-8333-333333333333",
          beneficiario: "Produção",
          tipo: "producao",
          percentual: 10,
        },
      ]) as never,
    );
    vi.mocked(usePessoasParaParticipacao).mockReturnValue(EM_ERRO as never);

    render(<DefaultSharesSettings />);

    expect(screen.getByText(/não foi possível ler as pessoas do time/i)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("button", { name: /^gravar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /adicionar participação padrão/i })).toBeNull();
  });

  it("🔴 dado velho no cache + refetch com erro: o aviso entra e os campos NÃO", () => {
    vi.mocked(useTodosOsPadroes).mockReturnValue({
      data: [
        {
          id: "p1",
          linhaDeNegocio: "sistemas",
          perfilId: "33333333-3333-4333-8333-333333333333",
          beneficiario: "Produção",
          tipo: "producao",
          percentual: 10,
        },
      ],
      isError: true,
      isPending: false,
    } as never);

    render(<DefaultSharesSettings />);

    expect(screen.getByText(/não foi possível ler/i)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("button", { name: /^gravar$/i })).toBeNull();
  });

  it("com leitura pronta e nenhum padrão, aí sim afirma o vazio e a decisão da Demanda", () => {
    render(<DefaultSharesSettings />);

    expect(screen.getByText(/nenhuma participação padrão configurada/i)).toBeInTheDocument();
    expect(screen.getByText(/demanda não tem participação padrão/i)).toBeInTheDocument();
    expect(
      screen.getByText(/todo contrato ativo tem ao menos uma participação/i),
    ).toBeInTheDocument();
  });
});

const DESATIVADO = "4b7c2e19-8d05-4f36-a1e2-9c3b6d8f0a52";
const ATIVO = "e2f9a173-5c48-4b20-9d6f-1a7e3c8b5042";

const GRAVADA = {
  id: "s1",
  contratoId: "contrato-1",
  perfilId: DESATIVADO,
  nomeExterno: null,
  tipo: "producao",
  percentual: 15,
  beneficiario: "Ana Souza",
  perfilDesativado: true,
};

const beneficiario = () => screen.getAllByRole("combobox")[0];

describe("ContractSharesSection — beneficiário desativado", () => {
  it("🔴 desativado aparece rotulado, e o campo NÃO abre em branco", async () => {
    vi.mocked(useParticipacoes).mockReturnValue(pronto([GRAVADA]) as never);
    vi.mocked(usePessoasParaParticipacao).mockReturnValue(
      pronto([{ id: DESATIVADO, nome: "Ana Souza", ativo: false }]) as never,
    );

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(beneficiario()).toHaveTextContent("Ana Souza (desativada)");
    expect(beneficiario()).not.toHaveTextContent("Quem recebe");

    const user = userEvent.setup();
    await user.click(beneficiario());
    expect(screen.getByRole("option", { name: "Ana Souza (desativada)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("o positivo ao lado: pessoa ATIVA sai só com o nome, e escolhível", async () => {
    vi.mocked(useParticipacoes).mockReturnValue(
      pronto([
        { ...GRAVADA, perfilId: ATIVO, beneficiario: "Bia Lima", perfilDesativado: false },
      ]) as never,
    );
    vi.mocked(usePessoasParaParticipacao).mockReturnValue(
      pronto([{ id: ATIVO, nome: "Bia Lima", ativo: true }]) as never,
    );

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(beneficiario()).toHaveTextContent("Bia Lima");
    expect(screen.queryByText(/desativada/i)).toBeNull();

    const user = userEvent.setup();
    await user.click(beneficiario());
    expect(screen.getByRole("option", { name: "Bia Lima" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("🔴 pessoa SEM o campo `ativo` (o formato do fechamento) não vira 'desativada'", async () => {
    vi.mocked(useParticipacoes).mockReturnValue(
      pronto([
        { ...GRAVADA, perfilId: ATIVO, beneficiario: "Bia Lima", perfilDesativado: false },
      ]) as never,
    );
    vi.mocked(usePessoasParaParticipacao).mockReturnValue(
      pronto([{ id: ATIVO, nome: "Bia Lima" }]) as never,
    );

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(screen.queryByText(/desativada/i)).toBeNull();

    const user = userEvent.setup();
    await user.click(beneficiario());
    expect(screen.getByRole("option", { name: "Bia Lima" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  const conjuntosPedidos = () => {
    const distintos = new Map<string, readonly (string | null)[]>();
    for (const [perfis] of vi.mocked(usePessoasParaParticipacao).mock.calls) {
      distintos.set(JSON.stringify(perfis ?? []), perfis ?? []);
    }
    return [...distintos.values()];
  };

  it("🔴 a tela passa o perfil DESATIVADO já gravado para a consulta de pessoas", () => {
    vi.mocked(useParticipacoes).mockReturnValue(pronto([GRAVADA]) as never);

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(conjuntosPedidos()).toEqual([[DESATIVADO]]);
  });

  it("🔴 beneficiário ATIVO gravado NÃO entra: a chave de cache fica a mesma", () => {
    vi.mocked(useParticipacoes).mockReturnValue(
      pronto([
        { ...GRAVADA, perfilId: ATIVO, beneficiario: "Bia Lima", perfilDesativado: false },
      ]) as never,
    );

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(conjuntosPedidos()).toEqual([[]]);
  });

  it("o positivo ao lado: sem participação gravada, a consulta vai sem ninguém a preservar", () => {
    vi.mocked(useParticipacoes).mockReturnValue(pronto([]) as never);

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(conjuntosPedidos()).toEqual([[]]);
  });

  it("beneficiário externo não entra na lista a preservar — ele não tem perfil", () => {
    vi.mocked(useParticipacoes).mockReturnValue(
      pronto([
        { ...GRAVADA, perfilId: null, nomeExterno: "Quem Indicou", perfilDesativado: false },
      ]) as never,
    );

    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(conjuntosPedidos()).toEqual([[]]);
  });
});
