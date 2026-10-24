import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
}));

import type { PostDoQuadro } from "../api/content.repository";
import { TRAVA_DE_CONTEUDO, TRAVA_DE_PUBLICADO } from "../domain/post";
import { CORRECAO_BARRADA, DialogoDoPost, FECHAMENTO_BARRADO } from "./dialogo-do-post";

afterEach(cleanup);

const AGORA = new Date("2026-10-04T15:00:00Z");

function postEm(status: PostDoQuadro["status"], extra: Partial<PostDoQuadro> = {}): PostDoQuadro {
  return {
    id: "p1",
    clienteId: "c1",
    clienteNome: "Acme",
    titulo: "Lançamento",
    legenda: "Texto",
    formato: "reel",
    canal: "instagram",
    linkDaArte: "https://drive.test/arte",
    agendadoPara: "2026-10-10T21:00:00.000Z",
    responsavelId: "u1",
    responsavelNome: "Ana",
    status,
    statusDesde: "2026-10-03T12:00:00Z",
    publicadoEm: status === "publicado" ? "2026-10-04T12:00:00Z" : null,
    linkPublicado: status === "publicado" ? "https://instagram.com/p/1" : null,
    atualizadoEm: "2026-10-04T12:00:00.123456+00:00",
    ...extra,
  };
}

function abrir(
  post: PostDoQuadro | null,
  extra: Partial<ComponentProps<typeof DialogoDoPost>> = {},
) {
  const props: ComponentProps<typeof DialogoDoPost> = {
    post,
    clientes: [{ id: "c1", nome: "Acme" }],
    responsaveis: [
      { id: "u1", nome: "Ana" },
      { id: "u2", nome: "Bruno" },
    ],
    eventos: [],
    estadoDosEventos: "pronto",
    estadoDosResponsaveis: "pronto",
    clienteInicial: null,
    meuId: "u1",
    podeApagar: false,
    agora: AGORA,
    salvando: false,
    apagando: false,
    onFechar: vi.fn(),
    onSalvar: vi.fn(),
    onMover: vi.fn(),
    onApagar: vi.fn(),
    ...extra,
  };
  render(<DialogoDoPost {...props} />);
  return props;
}

function cliqueFora() {
  const fundo = screen.getByRole("dialog").previousElementSibling as HTMLElement;
  fireEvent.pointerDown(fundo);
  fireEvent.click(fundo);
}

describe("DialogoDoPost", () => {
  it("novo post nasce amanhã às 18:00, Reel, com quem abriu como responsável", () => {
    abrir(null);
    expect(screen.getByLabelText("Data")).toHaveValue("2026-10-05");
    expect(screen.getByLabelText("Hora")).toHaveValue("18:00");
    expect(screen.getByLabelText("Responsável")).toHaveValue("u1");
    expect(screen.getByLabelText("Formato")).toHaveValue("reel");
    expect(screen.getByRole("button", { name: "Criar post" })).toBeInTheDocument();
  });

  it("às 22:30 de domingo em SP (já segunda em UTC), o novo post nasce na segunda às 18:00", () => {
    abrir(null, { agora: new Date("2026-10-05T01:30:00Z") });
    expect(screen.getByLabelText("Data")).toHaveValue("2026-10-05");
    expect(screen.getByLabelText("Hora")).toHaveValue("18:00");
  });

  it("não salva sem os obrigatórios e diz por quê; completo, salva com o instante de SP", async () => {
    const user = userEvent.setup();
    const props = abrir(null);
    await user.click(screen.getByRole("button", { name: "Criar post" }));
    expect(screen.getByText("Escolha o cliente.")).toBeInTheDocument();
    expect(screen.getByText("Escreva o título do post.")).toBeInTheDocument();
    expect(props.onSalvar).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Cliente"), "c1");
    await user.type(screen.getByLabelText("Título"), "Post novo");
    await user.click(screen.getByRole("button", { name: "Criar post" }));
    expect(props.onSalvar).toHaveBeenCalledWith({
      clienteId: "c1",
      titulo: "Post novo",
      legenda: null,
      formato: "reel",
      canal: "instagram",
      linkDaArte: null,
      agendadoPara: "2026-10-05T21:00:00.000Z",
      responsavelId: "u1",
    });
  });

  it("aprovado: conteúdo travado com o motivo, agenda livre e só as ações do status", async () => {
    const user = userEvent.setup();
    const props = abrir(postEm("aprovado"));
    expect(screen.getByText(TRAVA_DE_CONTEUDO)).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toBeDisabled();
    expect(screen.getByLabelText("Cliente")).toBeDisabled();
    expect(screen.getByLabelText("Data")).toBeEnabled();
    expect(screen.getByLabelText("Responsável")).toBeEnabled();
    for (const acao of ["Agendar", "Publicado", "Cliente pediu ajuste"]) {
      expect(screen.getByRole("button", { name: acao })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Enviar ao cliente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agendar" }));
    expect(props.onMover).toHaveBeenCalledWith("agendado");
  });

  it("agendado: oferece Desagendar e Publicado, e não oferece Agendar", () => {
    abrir(postEm("agendado"));
    expect(screen.getByRole("button", { name: "Desagendar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agendar" })).not.toBeInTheDocument();
  });

  it("edição não salva trava as ações de etapa até salvar ou desfazer", async () => {
    const user = userEvent.setup();
    const props = abrir(postEm("rascunho"));
    const etapa = screen.getByRole("button", { name: "Enviar ao cliente" });
    const titulo = screen.getByLabelText("Título");
    const DICA = "Salve as alterações antes de mudar a etapa.";

    expect(etapa).toBeEnabled();
    expect(screen.queryByText(DICA)).not.toBeInTheDocument();
    await user.click(etapa);
    expect(props.onMover).toHaveBeenCalledTimes(1);
    expect(props.onMover).toHaveBeenLastCalledWith("em_aprovacao");

    await user.type(titulo, "x");
    expect(etapa).toBeDisabled();
    expect(screen.getByText(DICA)).toBeInTheDocument();
    await user.click(etapa);
    expect(props.onMover).toHaveBeenCalledTimes(1);

    await user.type(titulo, "{Backspace}");
    expect(titulo).toHaveValue("Lançamento");
    expect(etapa).toBeEnabled();
    expect(screen.queryByText(DICA)).not.toBeInTheDocument();
    await user.click(etapa);
    expect(props.onMover).toHaveBeenCalledTimes(2);
  });

  it("post novo não tem ações de etapa nem a dica, mesmo editado", async () => {
    const user = userEvent.setup();
    abrir(null);
    await user.type(screen.getByLabelText("Título"), "Post novo");
    expect(
      screen.queryByText("Salve as alterações antes de mudar a etapa."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar ao cliente" })).not.toBeInTheDocument();
  });

  it("limpo: Esc fecha o diálogo", async () => {
    const user = userEvent.setup();
    const props = abrir(postEm("rascunho"));
    await user.keyboard("{Escape}");
    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });

  it("editado: Esc não fecha nem descarta a edição", async () => {
    const user = userEvent.setup();
    const props = abrir(postEm("rascunho"));
    await user.type(screen.getByLabelText("Título"), "x");
    await user.keyboard("{Escape}");
    expect(props.onFechar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).toHaveValue("Lançamentox");
  });

  it("editado: Esc barrado diz por quê; limpo, nada a dizer (controle)", async () => {
    const user = userEvent.setup();
    abrir(postEm("rascunho"));
    await user.type(screen.getByLabelText("Título"), "x");
    expect(screen.queryByText(FECHAMENTO_BARRADO)).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alert")).toHaveTextContent(FECHAMENTO_BARRADO);
    expect(FECHAMENTO_BARRADO).toBe(
      "Há alterações não salvas. Salve, ou feche pelo X para descartar.",
    );
    await user.type(screen.getByLabelText("Título"), "y");
    expect(screen.queryByText(FECHAMENTO_BARRADO)).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alert")).toHaveTextContent(FECHAMENTO_BARRADO);
  });

  it("editado e gravando: Esc segura sem pedir para salvar o que já está sendo salvo", async () => {
    const user = userEvent.setup();
    const gravando = abrir(postEm("rascunho"), { salvando: true });
    await user.type(screen.getByLabelText("Título"), "x");
    await user.keyboard("{Escape}");
    expect(gravando.onFechar).not.toHaveBeenCalled();
    expect(screen.queryByText(FECHAMENTO_BARRADO)).not.toBeInTheDocument();
  });

  it("editado: abrir a confirmação de Apagar post não conta como tentar fechar", async () => {
    const user = userEvent.setup();
    abrir(postEm("rascunho"), { podeApagar: true });
    await user.type(screen.getByLabelText("Título"), "x");
    await user.click(screen.getByRole("button", { name: "Apagar post" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.queryByText(FECHAMENTO_BARRADO)).not.toBeInTheDocument();
  });

  it("editado: o X fecha, é o gesto explícito de descartar", async () => {
    const user = userEvent.setup();
    const props = abrir(postEm("rascunho"));
    await user.type(screen.getByLabelText("Título"), "x");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });

  it("clique fora fecha limpo (controle) e não fecha editado", async () => {
    const user = userEvent.setup();
    const limpo = abrir(postEm("rascunho"));
    await new Promise((ok) => setTimeout(ok, 0));
    cliqueFora();
    expect(limpo.onFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(FECHAMENTO_BARRADO)).not.toBeInTheDocument();
    cleanup();

    const editado = abrir(postEm("rascunho"));
    await user.type(screen.getByLabelText("Título"), "x");
    cliqueFora();
    expect(editado.onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(FECHAMENTO_BARRADO);
  });

  it("publicado: nada edita, sem Salvar e sem ações; o link abre em aba nova sem referrer", () => {
    abrir(postEm("publicado"));
    expect(screen.getByText(TRAVA_DE_PUBLICADO)).toBeInTheDocument();
    expect(screen.getByLabelText("Data")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desagendar" })).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Ver post publicado" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("apagar só aparece para quem pode, e só apaga depois de confirmar", async () => {
    const user = userEvent.setup();
    abrir(postEm("rascunho"), { podeApagar: false });
    expect(screen.queryByRole("button", { name: "Apagar post" })).not.toBeInTheDocument();
    cleanup();

    const props = abrir(postEm("rascunho"), { podeApagar: true });
    await user.click(screen.getByRole("button", { name: "Apagar post" }));
    expect(props.onApagar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sim, apagar" }));
    expect(props.onApagar).toHaveBeenCalledTimes(1);
  });

  it("histórico: quem, de onde para onde, a nota e o link da tarefa", () => {
    abrir(postEm("ajuste_pedido"), {
      eventos: [
        {
          id: "e1",
          de: null,
          para: "rascunho",
          nota: null,
          tarefaId: null,
          autorId: "u1",
          criadoEm: "2026-10-01T12:00:00Z",
        },
        {
          id: "e2",
          de: "em_aprovacao",
          para: "ajuste_pedido",
          nota: "Trocar a capa",
          tarefaId: "t1",
          autorId: "u9",
          criadoEm: "2026-10-03T12:00:00Z",
        },
      ],
    });
    expect(screen.getByText(/Criou o post/)).toBeInTheDocument();
    expect(screen.getByText(/Em aprovação → Ajuste pedido/)).toBeInTheDocument();
    expect(screen.getByText("Trocar a capa")).toBeInTheDocument();
    expect(screen.getByText("Alguém que saiu da equipe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tarefa de ajuste criada" })).toHaveAttribute(
      "href",
      "/tasks",
    );
  });

  it.each([
    ["carregando", "…"],
    ["erro", "-"],
    ["pronto", "Alguém que saiu da equipe"],
  ] as const)(
    "histórico com a equipe %s: o autor fora da lista aparece como %s",
    (estado, nome) => {
      abrir(postEm("rascunho"), {
        responsaveis: [],
        estadoDosResponsaveis: estado,
        eventos: [
          {
            id: "e1",
            de: null,
            para: "rascunho",
            nota: null,
            tarefaId: null,
            autorId: "u9",
            criadoEm: "2026-10-01T12:00:00Z",
          },
        ],
      });
      expect(screen.getByText(nome)).toBeInTheDocument();
      if (estado !== "pronto") {
        expect(screen.queryByText("Alguém que saiu da equipe")).not.toBeInTheDocument();
      }
    },
  );

  it("cliente fora da lista (saiu da carteira) continua aparecendo no post", () => {
    abrir(postEm("rascunho", { clienteId: "c9", clienteNome: "Antigo" }));
    expect(screen.getByLabelText("Cliente")).toHaveValue("c9");
    expect(screen.getByRole("option", { name: "Antigo" })).toBeInTheDocument();
  });

  it("publicado (D-069, C5): corrige link e data; o resto segue travado", async () => {
    const user = userEvent.setup();
    const onCorrigirPublicacao = vi.fn();
    abrir(postEm("publicado"), { onCorrigirPublicacao });

    expect(screen.getByLabelText("Título")).toBeDisabled();
    expect(screen.getByLabelText("Data")).toBeDisabled();
    const corrigir = screen.getByRole("button", { name: "Corrigir publicação" });
    expect(corrigir).toBeDisabled();

    expect(screen.getByLabelText("Data da publicação")).toHaveValue("2026-10-04");
    expect(screen.getByLabelText("Hora da publicação")).toHaveValue("09:00");
    const link = screen.getByLabelText("Link publicado");
    expect(link).toHaveValue("https://instagram.com/p/1");
    await user.clear(link);
    await user.type(link, "https://instagram.com/p/certo");
    await user.click(corrigir);

    expect(onCorrigirPublicacao).toHaveBeenCalledWith({
      link: "https://instagram.com/p/certo",
      publicadoEm: "2026-10-04T12:00:00Z",
    });
  });

  it("🔴 publicado: corrigir só o link devolve o instante lido, com segundos e microssegundos", async () => {
    const user = userEvent.setup();
    const onCorrigirPublicacao = vi.fn();
    abrir(postEm("publicado", { publicadoEm: "2026-10-04T12:00:37.123456+00:00" }), {
      onCorrigirPublicacao,
    });
    const link = screen.getByLabelText("Link publicado");
    await user.clear(link);
    await user.type(link, "https://instagram.com/p/certo");
    await user.click(screen.getByRole("button", { name: "Corrigir publicação" }));
    expect(onCorrigirPublicacao).toHaveBeenCalledWith({
      link: "https://instagram.com/p/certo",
      publicadoEm: "2026-10-04T12:00:37.123456+00:00",
    });
  });

  it("publicado: mexer na hora manda o instante novo, sem os segundos antigos (controle)", async () => {
    const onCorrigirPublicacao = vi.fn();
    abrir(postEm("publicado", { publicadoEm: "2026-10-04T12:00:37.123456+00:00" }), {
      onCorrigirPublicacao,
    });
    fireEvent.change(screen.getByLabelText("Hora da publicação"), { target: { value: "10:30" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Corrigir publicação" }));
    expect(onCorrigirPublicacao).toHaveBeenCalledWith({
      link: "https://instagram.com/p/1",
      publicadoEm: "2026-10-04T13:30:00.000Z",
    });
  });

  it("publicado: mudar a hora e voltar à original conta como intocada (instante lido)", async () => {
    const user = userEvent.setup();
    const onCorrigirPublicacao = vi.fn();
    abrir(postEm("publicado", { publicadoEm: "2026-10-04T12:00:37.123456+00:00" }), {
      onCorrigirPublicacao,
    });
    const hora = screen.getByLabelText("Hora da publicação");
    fireEvent.change(hora, { target: { value: "10:30" } });
    fireEvent.change(hora, { target: { value: "09:00" } });
    await user.type(screen.getByLabelText("Link publicado"), "x");
    await user.click(screen.getByRole("button", { name: "Corrigir publicação" }));
    expect(onCorrigirPublicacao).toHaveBeenCalledWith({
      link: "https://instagram.com/p/1x",
      publicadoEm: "2026-10-04T12:00:37.123456+00:00",
    });
  });

  it("publicado: corrigir a hora manda o instante de SP em UTC", async () => {
    const onCorrigirPublicacao = vi.fn();
    abrir(postEm("publicado"), { onCorrigirPublicacao });
    fireEvent.change(screen.getByLabelText("Hora da publicação"), { target: { value: "10:30" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Corrigir publicação" }));
    expect(onCorrigirPublicacao).toHaveBeenCalledWith({
      link: "https://instagram.com/p/1",
      publicadoEm: "2026-10-04T13:30:00.000Z",
    });
  });

  it("publicado: data no futuro não sai e diz por quê", async () => {
    const user = userEvent.setup();
    const onCorrigirPublicacao = vi.fn();
    abrir(postEm("publicado"), { onCorrigirPublicacao });
    fireEvent.change(screen.getByLabelText("Data da publicação"), {
      target: { value: "2026-10-05" },
    });
    await user.click(screen.getByRole("button", { name: "Corrigir publicação" }));
    expect(screen.getByText("A data da publicação não pode ficar no futuro.")).toBeInTheDocument();
    expect(onCorrigirPublicacao).not.toHaveBeenCalled();
  });

  it("publicado: link sem https não sai e diz por quê; sem erro antes de tentar", async () => {
    const user = userEvent.setup();
    const onCorrigirPublicacao = vi.fn();
    abrir(postEm("publicado"), { onCorrigirPublicacao });
    const link = screen.getByLabelText("Link publicado");
    await user.clear(link);
    await user.type(link, "http://instagram.com/p/x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Corrigir publicação" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O link do post precisa começar com https:// e ter até 2.000 caracteres.",
    );
    expect(onCorrigirPublicacao).not.toHaveBeenCalled();
  });

  it("publicado: apagar o link vira correção com link nulo", async () => {
    const user = userEvent.setup();
    const onCorrigirPublicacao = vi.fn();
    abrir(postEm("publicado"), { onCorrigirPublicacao });
    await user.clear(screen.getByLabelText("Link publicado"));
    await user.click(screen.getByRole("button", { name: "Corrigir publicação" }));
    expect(onCorrigirPublicacao).toHaveBeenCalledWith({
      link: null,
      publicadoEm: "2026-10-04T12:00:00Z",
    });
  });

  it("publicado: correção pendente segura o Esc e manda para o botão que existe", async () => {
    const user = userEvent.setup();
    const props = abrir(postEm("publicado"), { onCorrigirPublicacao: vi.fn() });
    await user.type(screen.getByLabelText("Link publicado"), "x");
    await user.keyboard("{Escape}");
    expect(props.onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(CORRECAO_BARRADA);
    expect(CORRECAO_BARRADA).toBe(
      "Há correção não gravada. Use Corrigir publicação, ou feche pelo X para descartar.",
    );
    expect(screen.queryByText(FECHAMENTO_BARRADO)).not.toBeInTheDocument();
  });

  it("publicado: clique fora com correção pendente não fecha e avisa; limpo, fecha (controle)", async () => {
    const user = userEvent.setup();
    const limpo = abrir(postEm("publicado"), { onCorrigirPublicacao: vi.fn() });
    await new Promise((ok) => setTimeout(ok, 0));
    cliqueFora();
    expect(limpo.onFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    cleanup();

    const pendente = abrir(postEm("publicado"), { onCorrigirPublicacao: vi.fn() });
    await user.type(screen.getByLabelText("Link publicado"), "x");
    cliqueFora();
    expect(pendente.onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(CORRECAO_BARRADA);
  });

  it("publicado: sem correção pendente, Esc fecha (controle)", async () => {
    const user = userEvent.setup();
    const props = abrir(postEm("publicado"), { onCorrigirPublicacao: vi.fn() });
    await user.keyboard("{Escape}");
    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });

  it("publicado: gravando, o formulário trava, o botão diz Corrigindo e o Esc só segura", async () => {
    const user = userEvent.setup();
    const props = abrir(postEm("publicado"), { onCorrigirPublicacao: vi.fn(), corrigindo: true });
    for (const campo of ["Link publicado", "Data da publicação", "Hora da publicação"]) {
      expect(screen.getByLabelText(campo)).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Corrigindo…" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(props.onFechar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("não publicado: não oferece corrigir publicação (controle)", () => {
    abrir(postEm("agendado"), { onCorrigirPublicacao: vi.fn() });
    expect(screen.queryByRole("button", { name: "Corrigir publicação" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Link publicado")).not.toBeInTheDocument();
  });

  it("publicado sem a ação ligada: não oferece corrigir (controle)", () => {
    abrir(postEm("publicado"));
    expect(screen.queryByRole("button", { name: "Corrigir publicação" })).not.toBeInTheDocument();
  });

  it("histórico mostra a correção da publicação com a nota", () => {
    abrir(postEm("publicado"), {
      eventos: [
        {
          id: "e9",
          de: "publicado",
          para: "publicado",
          nota: "Link: a para b. Data: 04/10/2026 09:00 para 04/10/2026 09:00.",
          tarefaId: null,
          autorId: "u1",
          criadoEm: "2026-10-04T13:00:00Z",
        },
      ],
    });
    expect(screen.getByText(/Corrigiu a publicação/)).toBeInTheDocument();
    expect(screen.queryByText(/Publicado → Publicado/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Link: a para b. Data: 04/10/2026 09:00 para 04/10/2026 09:00."),
    ).toBeInTheDocument();
  });
});
