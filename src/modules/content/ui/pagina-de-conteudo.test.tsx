import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventoDoPost, PostDoQuadro } from "../api/content.repository";

const mover = { mutate: vi.fn(), isPending: false, variables: undefined };
const corrigirPublicacao = { mutate: vi.fn(), isPending: false };
type Leitura = "pronto" | "carregando" | "erro";
let leituraDoQuadro: Leitura = "pronto";
let leituraDaSemana: Leitura = "pronto";
let leituraDaEquipe: Leitura = "pronto";
let eventosDoPost: EventoDoPost[] = [];
const usePostsDaSemana = vi.fn((_inicio: string, _cliente: string | null, _ativo: boolean) => ({
  data: leituraDaSemana === "pronto" ? { posts: [], temMais: false } : undefined,
  isPending: leituraDaSemana === "carregando",
  isError: leituraDaSemana === "erro",
}));
let postsDoQuadro: PostDoQuadro[] = [];
let papel = "member";
const MEIO_DIA = new Date("2026-10-04T15:00:00Z");
let agora = MEIO_DIA;

vi.mock("@/modules/content/hooks/use-content", () => ({
  usePostsDoQuadro: () => ({
    data: leituraDoQuadro === "pronto" ? { posts: postsDoQuadro, temMais: false } : undefined,
    isPending: leituraDoQuadro === "carregando",
    isError: leituraDoQuadro === "erro",
  }),
  usePostsDaSemana,
  useEventosDoPost: () => ({ data: eventosDoPost, isPending: false, isError: false }),
  useResponsaveis: () => ({
    data: leituraDaEquipe === "pronto" ? [{ id: "u1", nome: "Ana" }] : undefined,
    isPending: leituraDaEquipe === "carregando",
    isError: leituraDaEquipe === "erro",
  }),
  useClientesDoConteudo: () => ({
    data: [{ id: "c1", nome: "Acme" }],
    isPending: false,
    isError: false,
  }),
  useCriarPost: () => ({ mutate: vi.fn(), isPending: false }),
  useEditarPost: () => ({ mutate: vi.fn(), isPending: false }),
  useMoverPost: () => mover,
  useApagarPost: () => ({ mutate: vi.fn(), isPending: false }),
  useCorrigirPublicacao: () => corrigirPublicacao,
}));
vi.mock("@/hooks/use-agora", () => ({ useAgora: () => agora }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ papel, meuId: "u1", perfil: null }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
}));

const { PaginaDeConteudo } = await import("./pagina-de-conteudo");

function post(status: PostDoQuadro["status"], extra: Partial<PostDoQuadro> = {}): PostDoQuadro {
  return {
    id: `p-${status}`,
    clienteId: "c1",
    clienteNome: "Acme",
    titulo: `Post ${status}`,
    legenda: null,
    formato: "reel",
    canal: "instagram",
    linkDaArte: null,
    agendadoPara: "2026-10-10T21:00:00.000Z",
    responsavelId: "u1",
    responsavelNome: "Ana",
    status,
    statusDesde: "2026-10-04T12:00:00Z",
    publicadoEm: null,
    linkPublicado: null,
    atualizadoEm: "2026-10-04T12:00:00Z",
    ...extra,
  };
}

beforeEach(() => {
  mover.mutate.mockReset();
  corrigirPublicacao.mutate.mockReset();
  corrigirPublicacao.isPending = false;
  usePostsDaSemana.mockClear();
  postsDoQuadro = [];
  leituraDoQuadro = "pronto";
  leituraDaSemana = "pronto";
  leituraDaEquipe = "pronto";
  eventosDoPost = [];
  papel = "member";
  agora = MEIO_DIA;
});
afterEach(cleanup);

async function moverPeloMenu(user: ReturnType<typeof userEvent.setup>, item: string) {
  const gatilho = screen.getByRole("button", { name: "Mover para" });
  gatilho.focus();
  fireEvent.keyDown(gatilho, { key: "ArrowDown" });
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("PaginaDeConteudo", () => {
  it("avisos de atrasados e de quem aguarda o cliente, com o mais antigo", () => {
    postsDoQuadro = [
      post("rascunho", { id: "a", agendadoPara: "2026-10-01T12:00:00Z" }),
      post("em_aprovacao", { id: "b", statusDesde: "2026-10-01T12:00:00Z" }),
      post("em_aprovacao", { id: "c" }),
    ];
    render(<PaginaDeConteudo />);
    expect(screen.getByText("1 post atrasado")).toBeInTheDocument();
    expect(screen.getByText("2 posts aguardando o cliente · há 3 dias")).toBeInTheDocument();
  });

  it("sem posts: nenhum aviso e o convite para criar", () => {
    render(<PaginaDeConteudo />);
    expect(screen.queryByText(/atrasado/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Nenhum post ainda. Crie o primeiro em "Novo post".'),
    ).toBeInTheDocument();
  });

  it("Agendar move direto, com o status que a tela leu", async () => {
    const user = userEvent.setup();
    postsDoQuadro = [post("aprovado")];
    render(<PaginaDeConteudo />);
    await moverPeloMenu(user, "Agendar");
    expect(mover.mutate).toHaveBeenCalledWith({
      id: "p-aprovado",
      de: "aprovado",
      para: "agendado",
    });
  });

  it("Cliente pediu ajuste abre o pedido e só move com ele escrito", async () => {
    const user = userEvent.setup();
    postsDoQuadro = [post("aprovado")];
    render(<PaginaDeConteudo />);
    await moverPeloMenu(user, "Cliente pediu ajuste");
    expect(screen.getByText("O que o cliente pediu?")).toBeInTheDocument();
    expect(mover.mutate).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Pedido do cliente"), "Trocar a capa");
    await user.click(screen.getByRole("button", { name: "Registrar ajuste" }));
    expect(mover.mutate).toHaveBeenCalledWith(
      {
        id: "p-aprovado",
        de: "aprovado",
        para: "ajuste_pedido",
        nota: "Trocar a capa",
        link: null,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("Publicado pede o link opcional e move com ele limpo", async () => {
    const user = userEvent.setup();
    postsDoQuadro = [post("agendado")];
    render(<PaginaDeConteudo />);
    await moverPeloMenu(user, "Publicado");
    await user.type(
      screen.getByLabelText("Link do post (opcional)"),
      " https://instagram.com/p/1 ",
    );
    await user.click(screen.getByRole("button", { name: "Marcar como publicado" }));
    expect(mover.mutate).toHaveBeenCalledWith(
      {
        id: "p-agendado",
        de: "agendado",
        para: "publicado",
        nota: null,
        link: "https://instagram.com/p/1",
      },
      expect.anything(),
    );
  });

  it("Calendário liga a consulta da semana de SP", async () => {
    const user = userEvent.setup();
    render(<PaginaDeConteudo />);
    expect(usePostsDaSemana).toHaveBeenLastCalledWith("2026-09-28", null, false);
    await user.click(screen.getByRole("button", { name: "Calendário" }));
    expect(usePostsDaSemana).toHaveBeenLastCalledWith("2026-09-28", null, true);
    expect(screen.getByRole("button", { name: "Esta semana" })).toBeInTheDocument();
  });

  it("às 22:30 de domingo em SP (já segunda em UTC), o calendário abre na semana do domingo", async () => {
    const user = userEvent.setup();
    agora = new Date("2026-10-05T01:30:00Z");
    render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: "Calendário" }));
    expect(screen.getByText("28/09/2026 a 04/10/2026")).toBeInTheDocument();
    expect(usePostsDaSemana).toHaveBeenLastCalledWith("2026-09-28", null, true);
  });

  it("quadro com erro diz que não leu os posts, em vez de afirmar que não há nenhum", () => {
    leituraDoQuadro = "erro";
    render(<PaginaDeConteudo />);
    expect(screen.getByText(/Não foi possível ler os posts\./)).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum post ainda/)).not.toBeInTheDocument();
    expect(screen.queryByText(/atrasado/)).not.toBeInTheDocument();
    cleanup();

    leituraDoQuadro = "pronto";
    render(<PaginaDeConteudo />);
    expect(screen.queryByText(/Não foi possível ler/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum post ainda/)).toBeInTheDocument();
  });

  it("calendário com erro diz que não leu os posts da semana, sem mostrar sete dias vazios", async () => {
    const user = userEvent.setup();
    leituraDaSemana = "erro";
    render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: "Calendário" }));
    expect(screen.getByText(/Não foi possível ler os posts da semana\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esta semana" })).not.toBeInTheDocument();
    expect(screen.queryAllByText("-")).toHaveLength(0);
  });

  it("calendário carregando mostra Carregando… nos dias, e pronto vazio mostra o traço", async () => {
    const user = userEvent.setup();
    leituraDaSemana = "carregando";
    render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: "Calendário" }));
    expect(screen.getAllByText("Carregando…")).toHaveLength(7);
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esta semana" })).toBeInTheDocument();
    cleanup();

    leituraDaSemana = "pronto";
    render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: "Calendário" }));
    expect(screen.getAllByText("-")).toHaveLength(7);
    expect(screen.queryByText("Carregando…")).not.toBeInTheDocument();
  });

  it.each([
    ["erro", "-", true],
    ["carregando", "…", false],
    ["pronto", "Alguém que saiu da equipe", false],
  ] as const)(
    "equipe %s: a página passa o estado ao histórico (autor fora da lista: %s) e avisa a falha só no erro",
    async (estado, nome, avisa) => {
      const user = userEvent.setup();
      leituraDaEquipe = estado;
      postsDoQuadro = [post("rascunho")];
      eventosDoPost = [
        {
          id: "e1",
          de: null,
          para: "rascunho",
          nota: null,
          tarefaId: null,
          autorId: "u9",
          criadoEm: "2026-10-01T12:00:00Z",
        },
      ];
      render(<PaginaDeConteudo />);
      const falha = /Não foi possível ler a equipe \(responsável e histórico\)\./;
      if (avisa) expect(screen.getByText(falha)).toBeInTheDocument();
      else expect(screen.queryByText(falha)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Post rascunho/ }));
      expect(screen.getByText(nome)).toBeInTheDocument();
      if (estado !== "pronto") {
        expect(screen.queryByText("Alguém que saiu da equipe")).not.toBeInTheDocument();
      }
    },
  );

  it("member não vê Apagar post; owner vê", async () => {
    const user = userEvent.setup();
    postsDoQuadro = [post("rascunho")];
    render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: /Post rascunho/ }));
    expect(screen.queryByRole("button", { name: "Apagar post" })).not.toBeInTheDocument();
    cleanup();

    papel = "owner";
    render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: /Post rascunho/ }));
    expect(screen.getByRole("button", { name: "Apagar post" })).toBeInTheDocument();
  });

  it("D-069 (C5): corrigir a publicação manda o post, a versão lida e a correção", async () => {
    const user = userEvent.setup();
    postsDoQuadro = [
      post("publicado", {
        publicadoEm: "2026-10-04T12:00:00Z",
        linkPublicado: "https://instagram.com/p/errado",
      }),
    ];
    render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: /Post publicado/ }));
    const link = screen.getByLabelText("Link publicado");
    await user.clear(link);
    await user.type(link, "https://instagram.com/p/certo");
    await user.click(screen.getByRole("button", { name: "Corrigir publicação" }));

    expect(corrigirPublicacao.mutate).toHaveBeenCalledWith(
      {
        id: "p-publicado",
        atualizadoEm: "2026-10-04T12:00:00Z",
        correcao: {
          link: "https://instagram.com/p/certo",
          publicadoEm: "2026-10-04T12:00:00Z",
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("D-069 (C5): o diálogo só fecha no sucesso da correção, e fica aberto enquanto grava", async () => {
    const user = userEvent.setup();
    postsDoQuadro = [
      post("publicado", {
        publicadoEm: "2026-10-04T12:00:00Z",
        linkPublicado: "https://instagram.com/p/errado",
      }),
    ];
    const { rerender } = render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: /Post publicado/ }));
    await user.type(screen.getByLabelText("Link publicado"), "x");
    await user.click(screen.getByRole("button", { name: "Corrigir publicação" }));
    expect(screen.getByLabelText("Link publicado")).toBeInTheDocument();

    corrigirPublicacao.isPending = true;
    rerender(<PaginaDeConteudo />);
    expect(screen.getByLabelText("Link publicado")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Corrigindo…" })).toBeDisabled();

    const { onSuccess } = corrigirPublicacao.mutate.mock.calls[0]?.[1] as { onSuccess: () => void };
    corrigirPublicacao.isPending = false;
    act(() => onSuccess());
    expect(screen.queryByLabelText("Link publicado")).not.toBeInTheDocument();
  });

  it("D-069 (C5): post que não está publicado não abre a correção (controle)", async () => {
    const user = userEvent.setup();
    postsDoQuadro = [post("agendado")];
    render(<PaginaDeConteudo />);
    await user.click(screen.getByRole("button", { name: /Post agendado/ }));
    expect(screen.queryByRole("button", { name: "Corrigir publicação" })).not.toBeInTheDocument();
  });
});
