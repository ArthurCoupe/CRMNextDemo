import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContratoListado } from "../api/contracts.repository";
import { ContractSharesSection } from "./contract-shares-section";
import {
  useGravarParticipacoes,
  useLimiarDeAlerta,
  useParticipacoes,
  usePessoasParaParticipacao,
} from "../hooks/use-shares";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: vi.fn(() => ({ perfil: null, papel: "owner", meuId: "u1", carregando: false })),
}));

vi.mock("../hooks/use-shares", () => ({
  useParticipacoes: vi.fn(),
  usePessoasParaParticipacao: vi.fn(),
  useLimiarDeAlerta: vi.fn(),
  useGravarParticipacoes: vi.fn(),
}));

const pronto = (data: unknown) => ({ data, isError: false, isPending: false });

const MARINA = "22222222-2222-4222-8222-222222222222";
const MEIRE = "44444444-4444-4444-8444-444444444444";

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

function gravadas(pctA: number, pctB: number) {
  return [
    {
      id: "a",
      contratoId: "contrato-1",
      perfilId: MARINA,
      nomeExterno: null,
      tipo: "venda",
      percentual: pctA,
      beneficiario: "Marina",
      perfilDesativado: false,
    },
    {
      id: "b",
      contratoId: "contrato-1",
      perfilId: MEIRE,
      nomeExterno: null,
      tipo: "producao",
      percentual: pctB,
      beneficiario: "Meire",
      perfilDesativado: false,
    },
  ];
}

const gravar = { mutateAsync: vi.fn(async () => undefined), isPending: false };

const botaoGravar = () => screen.getByRole("button", { name: /gravar participações/i });

async function acrescentarLinha(
  user: ReturnType<typeof userEvent.setup>,
  nome: string,
  pct: number,
) {
  await user.click(screen.getByRole("button", { name: /acrescentar/i }));
  if (nome !== "") {
    await user.type(screen.getByPlaceholderText(/nome de quem indicou/i), nome);
  }
  const campos = screen.getAllByRole("spinbutton");
  await user.type(campos[campos.length - 1] as HTMLElement, String(pct));
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useParticipacoes).mockReturnValue(pronto(gravadas(50, 50)) as never);
  vi.mocked(usePessoasParaParticipacao).mockReturnValue(
    pronto([
      { id: MARINA, nome: "Marina", ativo: true },
      { id: MEIRE, nome: "Meire", ativo: true },
    ]) as never,
  );
  vi.mocked(useLimiarDeAlerta).mockReturnValue(
    pronto({ percentual: null, confirmado: false }) as never,
  );
  vi.mocked(useGravarParticipacoes).mockReturnValue(gravar as never);
});

describe("ContractSharesSection — Gravar respeita o que o painel acusa", () => {
  it("🔴 acima do teto: Gravar desabilitado, com o motivo escrito, e nada vai ao banco", async () => {
    vi.mocked(useParticipacoes).mockReturnValue(pronto(gravadas(40, 40)) as never);
    const user = userEvent.setup();
    render(<ContractSharesSection contrato={CONTRATO} />);

    await acrescentarLinha(user, "Carla Indicou", 60);

    expect(botaoGravar()).toBeDisabled();
    expect(screen.getByText(/gravar fica travado.*teto/i)).toBeInTheDocument();

    await user.click(botaoGravar());
    expect(gravar.mutateAsync).not.toHaveBeenCalled();
  });

  it("🔴 linha inválida (sem beneficiário) dentro do teto: Gravar desabilitado, com o motivo", async () => {
    vi.mocked(useParticipacoes).mockReturnValue(pronto(gravadas(40, 40)) as never);
    const user = userEvent.setup();
    render(<ContractSharesSection contrato={CONTRATO} />);

    await acrescentarLinha(user, "", 10);

    expect(botaoGravar()).toBeDisabled();
    expect(screen.getByText(/gravar fica travado.*linhas apontadas/i)).toBeInTheDocument();
    expect(screen.queryByText(/teto/i, { selector: "p" })).toBeNull();

    await user.click(botaoGravar());
    expect(gravar.mutateAsync).not.toHaveBeenCalled();
  });

  it("o positivo ao lado: remover A e criar C=50% grava UMA vez, com B e C e sem A", async () => {
    const user = userEvent.setup();
    render(<ContractSharesSection contrato={CONTRATO} />);

    await user.click(
      screen.getAllByRole("button", { name: /remover participação/i })[0] as HTMLElement,
    );
    await acrescentarLinha(user, "Carla Indicou", 50);

    expect(botaoGravar()).toBeEnabled();
    expect(screen.queryByText(/gravar fica travado/i)).toBeNull();

    await user.click(botaoGravar());

    expect(gravar.mutateAsync).toHaveBeenCalledTimes(1);
    expect(gravar.mutateAsync).toHaveBeenCalledWith({
      contratoId: "contrato-1",
      linhas: [
        { id: "b", perfilId: MEIRE, nomeExterno: null, tipo: "producao", percentual: 50 },
        {
          id: undefined,
          perfilId: null,
          nomeExterno: "Carla Indicou",
          tipo: "venda",
          percentual: 50,
        },
      ],
    });
  });

  it("CONTR-4: realocar 40/60 → 60/40 grava numa chamada só, com as duas linhas", async () => {
    vi.mocked(useParticipacoes).mockReturnValue(pronto(gravadas(40, 60)) as never);
    const user = userEvent.setup();
    render(<ContractSharesSection contrato={CONTRATO} />);

    const campos = screen.getAllByRole("spinbutton");
    await user.clear(campos[0] as HTMLElement);
    await user.type(campos[0] as HTMLElement, "60");
    await user.clear(campos[1] as HTMLElement);
    await user.type(campos[1] as HTMLElement, "40");

    expect(botaoGravar()).toBeEnabled();
    await user.click(botaoGravar());

    expect(gravar.mutateAsync).toHaveBeenCalledTimes(1);
    expect(gravar.mutateAsync).toHaveBeenCalledWith({
      contratoId: "contrato-1",
      linhas: [
        { id: "a", perfilId: MARINA, nomeExterno: null, tipo: "venda", percentual: 60 },
        { id: "b", perfilId: MEIRE, nomeExterno: null, tipo: "producao", percentual: 40 },
      ],
    });
  });

  it("sem mudança nenhuma, Gravar está habilitado — o portão só fecha por problema", () => {
    render(<ContractSharesSection contrato={CONTRATO} />);

    expect(botaoGravar()).toBeEnabled();
    expect(screen.queryByText(/gravar fica travado/i)).toBeNull();
  });

  it("em curso: botão desabilitado com 'Gravando…' e SEM o motivo — o texto é só para bloqueio por problema", () => {
    vi.mocked(useGravarParticipacoes).mockReturnValue({ ...gravar, isPending: true } as never);

    render(<ContractSharesSection contrato={CONTRATO} />);

    const botao = screen.getByRole("button", { name: /gravando/i });
    expect(botao).toBeDisabled();
    expect(botao).toHaveTextContent("Gravando…");
    expect(screen.queryByText(/gravar fica travado/i)).toBeNull();
  });
});

describe("ContractSharesSection — o banco recusou", () => {
  const MENSAGEM =
    "Participações deste contrato somariam 110%. O teto é 100% somando venda, produção e indicação.";

  it("🔴 rascunho volta ao lido (A e B de novo, C fora) e o toast traz a mensagem do banco", async () => {
    vi.mocked(useParticipacoes).mockReturnValue(pronto(gravadas(40, 50)) as never);
    gravar.mutateAsync.mockRejectedValueOnce(new Error(MENSAGEM));
    const user = userEvent.setup();
    render(<ContractSharesSection contrato={CONTRATO} />);

    await user.click(
      screen.getAllByRole("button", { name: /remover participação/i })[0] as HTMLElement,
    );
    await acrescentarLinha(user, "Carla Indicou", 50);
    expect(screen.queryByText("Marina")).toBeNull();
    expect(screen.getByPlaceholderText(/nome de quem indicou/i)).toBeInTheDocument();

    await user.click(botaoGravar());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(MENSAGEM));
    expect(toast.error).toHaveBeenCalledTimes(1);

    const beneficiarios = screen.getAllByRole("combobox").filter((_, i) => i % 2 === 0);
    expect(beneficiarios.map((c) => c.textContent)).toEqual(["Marina", "Meire"]);
    expect(screen.getAllByRole("spinbutton").map((i) => (i as HTMLInputElement).value)).toEqual([
      "40",
      "50",
    ]);
    expect(screen.queryByPlaceholderText(/nome de quem indicou/i)).toBeNull();
  });
});

describe("ContractSharesSection — o rascunho acompanha a leitura", () => {
  const percentuais = () =>
    screen.getAllByRole("spinbutton").map((i) => (i as HTMLInputElement).value);

  it("releitura com valores novos substitui o rascunho", () => {
    const { rerender } = render(<ContractSharesSection contrato={CONTRATO} />);
    expect(percentuais()).toEqual(["50", "50"]);

    vi.mocked(useParticipacoes).mockReturnValue(pronto(gravadas(30, 70)) as never);
    rerender(<ContractSharesSection contrato={CONTRATO} />);

    expect(percentuais()).toEqual(["30", "70"]);
  });

  it("leitura que chega depois de montar preenche o painel", () => {
    vi.mocked(useParticipacoes).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as never);
    const { rerender } = render(<ContractSharesSection contrato={CONTRATO} />);

    vi.mocked(useParticipacoes).mockReturnValue(pronto(gravadas(40, 60)) as never);
    rerender(<ContractSharesSection contrato={CONTRATO} />);

    expect(percentuais()).toEqual(["40", "60"]);
  });
});
