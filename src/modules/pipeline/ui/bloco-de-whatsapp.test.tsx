import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listarScriptsDeWhatsApp,
  registrarUso,
  type Script,
} from "@/modules/scripts/api/scripts.repository";

import { registrarToque } from "../api/pipeline.repository";
import { BlocoDeWhatsApp } from "./bloco-de-whatsapp";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../api/pipelines.repository", () => ({
  arquivarPipeline: vi.fn(),
  criarPipeline: vi.fn(),
  listarCampos: vi.fn(),
  listarEstagios: vi.fn(),
  listarMotivos: vi.fn(),
  listarPipelines: vi.fn(),
  renomearPipeline: vi.fn(),
  salvarCampos: vi.fn(),
  salvarEstagios: vi.fn(),
  salvarMotivos: vi.fn(),
}));

vi.mock("../api/pipeline.repository", () => ({
  atualizarDadosDaOportunidade: vi.fn(),
  atualizarDatasDeReuniao: vi.fn(),
  atualizarNutricao: vi.fn(),
  carregarCatalogo: vi.fn(),
  corrigirMotivoDeSaida: vi.fn(),
  listarEventos: vi.fn(),
  listarResponsaveis: vi.fn(),
  lerPrimeiroContato: vi.fn(),
  lerTempoAtePrimeiroContato: vi.fn(),
  moverParaEstagio: vi.fn(),
  registrarToque: vi.fn(),
  responderPergunta: vi.fn(),
  vincularRef: vi.fn(),
}));

vi.mock("@/modules/scripts/api/scripts.repository", () => ({
  atualizarScript: vi.fn(),
  criarScript: vi.fn(),
  definirSituacaoDoScript: vi.fn(),
  listarMaisUsados: vi.fn(),
  listarNichos: vi.fn(),
  listarScripts: vi.fn(),
  listarScriptsDeWhatsApp: vi.fn(),
  registrarUso: vi.fn(),
}));

document.addEventListener(
  "click",
  (evento) => {
    if (evento.target instanceof Element && evento.target.closest("a") !== null) {
      evento.preventDefault();
    }
  },
  { capture: true },
);

type Oportunidade = ComponentProps<typeof BlocoDeWhatsApp>["oportunidade"];

const OPORTUNIDADE: Oportunidade = {
  id: "oportunidade-1",
  nicho: "Advocacia",
  estagio: "qualificacao",
  contatoNome: "Zé",
  contatoTelefone: "(11) 99999-9999",
};

function script(
  parcial: Pick<Script, "id" | "title" | "body" | "nicho" | "pipelineStage"> & Partial<Script>,
): Script {
  return {
    tipo: "sdr",
    canal: "whatsapp",
    momento: "primeiro_contato",
    sortOrder: 0,
    active: true,
    updatedAt: "2026-09-30T00:00:00Z",
    ...parcial,
  };
}

const SCRIPTS: Script[] = [
  script({
    id: "script-1",
    title: "Abertura genérica",
    body: "Olá!",
    nicho: "",
    pipelineStage: null,
  }),
  script({
    id: "script-2",
    title: "Qualificação advocacia",
    body: "Oi, tudo bem?",
    nicho: "advocacia",
    pipelineStage: "qualificacao",
    tipo: "closer",
    momento: "abertura",
  }),
  script({
    id: "script-3",
    title: "Advocacia geral",
    body: "Bom dia",
    nicho: "Advocacia ",
    pipelineStage: null,
  }),
];

const RECUSA = Object.assign(new Error("Sem permissão para registrar."), { code: "42501" });

function adiado() {
  let resolver: () => void = () => undefined;
  let rejeitar: (erro: unknown) => void = () => undefined;
  const promessa = new Promise<void>((res, rej) => {
    resolver = () => res();
    rejeitar = (erro) => rej(erro);
  });
  return { promessa, resolver, rejeitar };
}

function montar(oportunidade: Oportunidade = OPORTUNIDADE) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const envolver = (filho: ReactNode) => (
    <QueryClientProvider client={qc}>{filho}</QueryClientProvider>
  );
  const tela = render(envolver(<BlocoDeWhatsApp oportunidade={oportunidade} />));
  return {
    ...tela,
    rerenderCom: (outra: Oportunidade) =>
      tela.rerender(envolver(<BlocoDeWhatsApp oportunidade={outra} />)),
  };
}

function botao() {
  return screen.getByRole("button", { name: "WhatsApp" });
}

async function abrirEEscolher(user: ReturnType<typeof userEvent.setup>, nome: RegExp | string) {
  await user.click(botao());
  await user.click(await screen.findByRole("link", { name: nome }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarScriptsDeWhatsApp).mockResolvedValue(SCRIPTS);
  vi.mocked(registrarToque).mockResolvedValue(undefined);
  vi.mocked(registrarUso).mockResolvedValue(undefined);
});

describe("telefone", () => {
  it("🔴 critério 2: telefone sem DDD desativa o botão, diz o que corrigir e não mostra link", () => {
    montar({ ...OPORTUNIDADE, contatoTelefone: "9999-9999" });

    expect(botao()).toBeDisabled();
    expect(
      screen.getByText("Telefone sem DDD ou inválido. Corrija no campo Telefone."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/fora do Brasil/)).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("🔴 número de fora do Brasil desativa o botão e diz isso, sem mandar corrigir o DDD", () => {
    montar({ ...OPORTUNIDADE, contatoTelefone: "+51 987 654 321" });

    expect(botao()).toBeDisabled();
    expect(
      screen.getByText("Número de fora do Brasil: o botão só abre conversa com número brasileiro."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Telefone sem DDD/)).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("telefone vazio também desativa", () => {
    montar({ ...OPORTUNIDADE, contatoTelefone: null });
    expect(botao()).toBeDisabled();
  });

  it("o botão lê o telefone GRAVADO: salvo o número certo, ele acorda", () => {
    const { rerenderCom } = montar({ ...OPORTUNIDADE, contatoTelefone: "9999-9999" });
    expect(botao()).toBeDisabled();

    rerenderCom(OPORTUNIDADE);
    expect(botao()).toBeEnabled();
    expect(screen.queryByText(/Telefone sem DDD/)).toBeNull();
  });
});

describe("a lista", () => {
  it("🔴 critérios 1 e 3: sugeridos primeiro, rótulo, tipo, link codificado e Sem script no fim", async () => {
    const user = userEvent.setup();
    montar();
    expect(listarScriptsDeWhatsApp).not.toHaveBeenCalled();
    expect(botao()).toHaveAttribute("aria-expanded", "false");

    await user.click(botao());
    await screen.findByRole("link", { name: /Qualificação advocacia/ });
    expect(botao()).toHaveAttribute("aria-expanded", "true");

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining("Qualificação advocacia"),
      expect.stringContaining("Advocacia geral"),
      expect.stringContaining("Abertura genérica"),
      "Sem script",
    ]);
    expect(within(links[0]!).getByText("Sugerido")).toBeInTheDocument();
    expect(within(links[0]!).getByText("Closer")).toBeInTheDocument();
    expect(within(links[1]!).getByText("Sugerido")).toBeInTheDocument();
    expect(within(links[2]!).queryByText("Sugerido")).toBeNull();
    expect(within(links[2]!).getByText("SDR")).toBeInTheDocument();

    expect(links[0]).toHaveAttribute(
      "href",
      "https://wa.me/5511999999999?text=Oi%2C%20tudo%20bem%3F",
    );
    expect(links[3]).toHaveAttribute("href", "https://wa.me/5511999999999");
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("enquanto lê, diz que está carregando e Sem script já funciona", async () => {
    vi.mocked(listarScriptsDeWhatsApp).mockReturnValue(
      new Promise<readonly Script[]>(() => undefined),
    );
    const user = userEvent.setup();
    montar();

    await user.click(botao());
    expect(await screen.findByText("Carregando…")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sem script" })).toBeInTheDocument();
  });

  it("🔴 critério 4: leitura falhou mostra a falha, e Sem script continua utilizável", async () => {
    vi.mocked(listarScriptsDeWhatsApp).mockRejectedValue(
      Object.assign(new Error("sem permissão"), { code: "42501" }),
    );
    const user = userEvent.setup();
    montar();

    await user.click(botao());
    expect(
      await screen.findByText(/Não foi possível ler os scripts de WhatsApp/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sem script" })).toHaveAttribute(
      "href",
      "https://wa.me/5511999999999",
    );
  });

  it("critério 4: nenhum script ativo diz onde cadastrar", async () => {
    vi.mocked(listarScriptsDeWhatsApp).mockResolvedValue([]);
    const user = userEvent.setup();
    montar();

    await user.click(botao());
    expect(
      await screen.findByText("Nenhum script de WhatsApp ativo. Cadastre em Scripts."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sem script" })).toBeInTheDocument();
  });
});

describe("abrir a conversa e confirmar", () => {
  it("🔴 critério 5: abrir a conversa não grava nada, fecha a lista e pergunta se mandou", async () => {
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, /Qualificação advocacia/);

    expect(screen.getByRole("status")).toHaveTextContent("Mandou a mensagem para Zé?");
    expect(registrarToque).not.toHaveBeenCalled();
    expect(registrarUso).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(botao()).toHaveAttribute("aria-expanded", "false");
  });

  it("sem nome de contato, pergunta pelo contato", async () => {
    const user = userEvent.setup();
    montar({ ...OPORTUNIDADE, contatoNome: null });

    await abrirEEscolher(user, "Sem script");
    expect(screen.getByRole("status")).toHaveTextContent("Mandou a mensagem para o contato?");
  });

  it("🔴 critério 6: Registrar toque grava o whatsapp com o título e DEPOIS o uso", async () => {
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));

    await waitFor(() => expect(registrarUso).toHaveBeenCalledWith("script-2"));
    expect(registrarToque).toHaveBeenCalledTimes(1);
    expect(registrarToque).toHaveBeenCalledWith(
      "oportunidade-1",
      "whatsapp",
      "WhatsApp · Qualificação advocacia",
    );
    expect(vi.mocked(registrarToque).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(registrarUso).mock.invocationCallOrder[0]!,
    );
    expect(toast.success).toHaveBeenCalledWith("Toque registrado.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("critério 6: Sem script grava 'WhatsApp · sem script' e não registra uso", async () => {
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, "Sem script");
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Toque registrado."));
    expect(registrarToque).toHaveBeenCalledWith(
      "oportunidade-1",
      "whatsapp",
      "WhatsApp · sem script",
    );
    expect(registrarUso).not.toHaveBeenCalled();
  });

  it("🔴 critério 7: Não mandei não grava nada e fecha a pergunta", async () => {
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    await user.click(screen.getByRole("button", { name: "Não mandei" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(registrarToque).not.toHaveBeenCalled();
    expect(registrarUso).not.toHaveBeenCalled();
  });

  it("abrir outro item com a pergunta na tela substitui o pendente", async () => {
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    await abrirEEscolher(user, "Sem script");
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));

    await waitFor(() => expect(registrarToque).toHaveBeenCalledTimes(1));
    expect(registrarToque).toHaveBeenCalledWith(
      "oportunidade-1",
      "whatsapp",
      "WhatsApp · sem script",
    );
    expect(registrarUso).not.toHaveBeenCalled();
  });

  it("🔴 pergunta aberta enquanto o toque anterior grava não some quando ele termina", async () => {
    const gravacao = adiado();
    vi.mocked(registrarToque).mockReturnValueOnce(gravacao.promessa);
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));
    await waitFor(() => expect(registrarToque).toHaveBeenCalledTimes(1));
    await abrirEEscolher(user, "Sem script");
    gravacao.resolver();

    await waitFor(() => expect(registrarUso).toHaveBeenCalledWith("script-2"));
    expect(toast.success).toHaveBeenCalledWith("Toque registrado.");
    expect(screen.getByRole("status")).toHaveTextContent("Mandou a mensagem para Zé?");

    await user.click(screen.getByRole("button", { name: "Registrar toque" }));
    await waitFor(() => expect(registrarToque).toHaveBeenCalledTimes(2));
    expect(registrarToque).toHaveBeenLastCalledWith(
      "oportunidade-1",
      "whatsapp",
      "WhatsApp · sem script",
    );
  });

  it("🔴 critério 8: Registrar toque fica desativado durante a gravação, e o segundo clique não grava de novo", async () => {
    vi.mocked(registrarToque).mockReturnValue(new Promise<void>(() => undefined));
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    const registrar = screen.getByRole("button", { name: "Registrar toque" });
    await user.click(registrar);

    await waitFor(() => expect(registrar).toBeDisabled());
    await user.click(registrar);
    expect(registrarToque).toHaveBeenCalledTimes(1);
  });

  it("🔴 critério 9: toque recusado avisa com a mensagem e a pergunta continua", async () => {
    vi.mocked(registrarToque).mockRejectedValue(RECUSA);
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sem permissão para registrar."));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar toque" })).toBeEnabled();
    expect(registrarUso).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("uso que falha não vira erro na tela: o toque já foi registrado", async () => {
    vi.mocked(registrarUso).mockRejectedValue(RECUSA);
    const user = userEvent.setup();
    montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));

    await waitFor(() => expect(registrarUso).toHaveBeenCalledWith("script-2"));
    expect(toast.success).toHaveBeenCalledWith("Toque registrado.");
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("ficha fechada durante a gravação (PIPE-2)", () => {
  it("🔴 o toque grava e o uso ainda é registrado", async () => {
    const toque = adiado();
    vi.mocked(registrarToque).mockReturnValue(toque.promessa);
    const user = userEvent.setup();
    const { unmount } = montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));
    unmount();
    toque.resolver();

    await waitFor(() => expect(registrarUso).toHaveBeenCalledWith("script-2"));
  });

  it("🔴 toque recusado com a ficha fechada ainda avisa", async () => {
    const toque = adiado();
    vi.mocked(registrarToque).mockReturnValue(toque.promessa);
    const user = userEvent.setup();
    const { unmount } = montar();

    await abrirEEscolher(user, /Qualificação advocacia/);
    await user.click(screen.getByRole("button", { name: "Registrar toque" }));
    unmount();
    toque.rejeitar(RECUSA);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sem permissão para registrar."));
    expect(registrarUso).not.toHaveBeenCalled();
  });
});
