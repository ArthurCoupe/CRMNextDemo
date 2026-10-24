import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";

import { FormularioDeTarefa } from "./formulario-de-tarefa";

const perfil = { papel: "owner" as string | null, meuId: "user-1" as string | null };
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => perfil }));

beforeEach(() => {
  perfil.papel = "owner";
  perfil.meuId = "user-1";
});

const CATALOGO = [{ categoria: "Comercial", tipo: "Follow-up" }];
const TIME = [{ id: "user-1", nome: "Fulano" }];
const CLIENTES = [{ id: "c1", nome: "Acme" }];

const PRONTO: EstadoDaConsulta = "pronto";

function renderizar(
  estados: Partial<{
    estadoDoCatalogo: EstadoDaConsulta;
    estadoDoTime: EstadoDaConsulta;
    estadoDosClientes: EstadoDaConsulta;
  }> = {},
) {
  const onCriar = vi.fn();
  render(
    <FormularioDeTarefa
      aberto
      onFechar={vi.fn()}
      catalogo={CATALOGO}
      time={TIME}
      clientes={CLIENTES}
      estadoDoCatalogo={PRONTO}
      estadoDoTime={PRONTO}
      estadoDosClientes={PRONTO}
      onCriar={onCriar}
      salvando={false}
      {...estados}
    />,
  );
  return onCriar;
}

async function preencherObrigatorios(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("Categoria"), "Comercial");
  await user.selectOptions(screen.getByLabelText("Tipo"), "Follow-up");
  await user.type(screen.getByLabelText("Título"), "Ligar para a Acme");
}

describe("FormularioDeTarefa — leitura do time falhando", () => {
  it("🔴 trava o select de responsável, avisa e NÃO deixa criar", async () => {
    const user = userEvent.setup();
    const onCriar = renderizar({ estadoDoTime: "erro" });
    await preencherObrigatorios(user);

    expect(screen.getByLabelText("Responsável")).toBeDisabled();
    expect(screen.getByText("Não foi possível ler o time.")).toBeInTheDocument();
    expect(screen.queryByText(/número abaixo/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Recarregue a página e tente de novo.")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Criar tarefa" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(onCriar).not.toHaveBeenCalled();
  });

  it("com o time carregado, o select oferece as pessoas e a tarefa é criada", async () => {
    const user = userEvent.setup();
    const onCriar = renderizar();
    await preencherObrigatorios(user);

    expect(screen.getByLabelText("Responsável")).toBeEnabled();
    await user.selectOptions(screen.getByLabelText("Responsável"), "user-1");
    expect(screen.queryByText(/Não foi possível ler/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(onCriar).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: "user-1" }));
  });
});

describe("FormularioDeTarefa — leitura dos clientes falhando", () => {
  it("trava o select de cliente e avisa, mas ainda deixa criar sem cliente", async () => {
    const user = userEvent.setup();
    const onCriar = renderizar({ estadoDosClientes: "erro" });
    await preencherObrigatorios(user);

    expect(screen.getByLabelText("Cliente")).toBeDisabled();
    expect(screen.getByText(/Não foi possível ler a lista de clientes/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(onCriar).toHaveBeenCalledWith(expect.objectContaining({ clienteId: null }));
  });
});

describe("FormularioDeTarefa — leitura do catálogo falhando", () => {
  it("trava o select de categoria e diz por que o botão não abre", () => {
    renderizar({ estadoDoCatalogo: "erro" });

    expect(screen.getByLabelText("Categoria")).toBeDisabled();
    expect(screen.getByText(/Não foi possível ler os tipos de tarefa/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar tarefa" })).toBeDisabled();
  });

  it("enquanto carrega, a categoria fica travada sem aviso de erro", () => {
    renderizar({ estadoDoCatalogo: "carregando" });

    expect(screen.getByLabelText("Categoria")).toBeDisabled();
    expect(screen.queryByText(/Não foi possível ler/)).not.toBeInTheDocument();
  });
});

describe("FormularioDeTarefa — prazo com ano pela metade", () => {
  it("🔴 trava o botão e avisa; com ano plausível, cria com o prazo", async () => {
    const user = userEvent.setup();
    const onCriar = renderizar();
    await preencherObrigatorios(user);

    fireEvent.change(screen.getByLabelText("Prazo"), { target: { value: "0002-09-10" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Prazo inválido");
    expect(screen.getByRole("button", { name: "Criar tarefa" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Prazo"), { target: { value: "2026-09-10" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(onCriar).toHaveBeenCalledWith(expect.objectContaining({ prazo: "2026-09-10" }));
  });
});

describe("FormularioDeTarefa — o rascunho dura uma abertura (TASK-6)", () => {
  function propsBase(onCriar = vi.fn(), onFechar = vi.fn()) {
    return {
      onFechar,
      catalogo: CATALOGO,
      time: TIME,
      clientes: CLIENTES,
      estadoDoCatalogo: PRONTO,
      estadoDoTime: PRONTO,
      estadoDosClientes: PRONTO,
      onCriar,
      salvando: false,
    };
  }

  it("🔴 'Criar tarefa' NÃO limpa o rascunho — quem fecha é a rota, depois do resultado", async () => {
    const user = userEvent.setup();
    const onCriar = vi.fn();
    render(<FormularioDeTarefa aberto {...propsBase(onCriar)} />);
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(onCriar).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Título")).toHaveValue("Ligar para a Acme");
    expect(screen.getByLabelText("Categoria")).toHaveValue("Comercial");
  });

  it("🔴 'Cancelar' fecha pela rota, e reabrir mostra o formulário vazio", async () => {
    const user = userEvent.setup();
    const onFechar = vi.fn();
    const props = propsBase(vi.fn(), onFechar);
    const { rerender } = render(<FormularioDeTarefa aberto {...props} />);
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);

    rerender(<FormularioDeTarefa aberto={false} {...props} />);
    rerender(<FormularioDeTarefa aberto {...props} />);

    expect(screen.getByLabelText("Título")).toHaveValue("");
    expect(screen.getByLabelText("Categoria")).toHaveValue("");
    expect(screen.getByLabelText("Tipo")).toHaveValue("");
  });

  it("fechado pela rota (sucesso) e reaberto, o formulário também nasce vazio", async () => {
    const user = userEvent.setup();
    const props = propsBase();
    const { rerender } = render(<FormularioDeTarefa aberto {...props} />);
    await preencherObrigatorios(user);
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    rerender(<FormularioDeTarefa aberto={false} {...props} />);
    rerender(<FormularioDeTarefa aberto {...props} />);

    expect(screen.getByLabelText("Título")).toHaveValue("");
  });

  it("enquanto salva, o botão diz 'Criando…' e fica travado — o diálogo continua aberto", async () => {
    const user = userEvent.setup();
    const props = propsBase();
    const { rerender } = render(<FormularioDeTarefa aberto {...props} />);
    await preencherObrigatorios(user);

    rerender(<FormularioDeTarefa aberto {...props} salvando />);

    expect(screen.getByRole("button", { name: "Criando…" })).toBeDisabled();
    expect(screen.getByLabelText("Título")).toHaveValue("Ligar para a Acme");
  });

  it("🔴 enquanto salva, Cancelar está travado e Esc NÃO fecha", async () => {
    const user = userEvent.setup();
    const onFechar = vi.fn();
    const props = propsBase(vi.fn(), onFechar);
    render(<FormularioDeTarefa aberto {...props} salvando />);

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onFechar).not.toHaveBeenCalled();
  });

  it("sem estar salvando, Esc fecha pela rota", async () => {
    const user = userEvent.setup();
    const onFechar = vi.fn();
    render(<FormularioDeTarefa aberto {...propsBase(vi.fn(), onFechar)} />);

    await user.keyboard("{Escape}");
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});

describe("FormularioDeTarefa — descrição", () => {
  it("🔴 a descrição digitada vai no payload, sem espaço nas pontas e com a quebra de linha", async () => {
    const user = userEvent.setup();
    const onCriar = renderizar();
    await preencherObrigatorios(user);

    await user.type(
      screen.getByLabelText("Descrição"),
      "  Pedir o contrato assinado{Enter}e o boleto  ",
    );
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(onCriar).toHaveBeenCalledWith(
      expect.objectContaining({ descricao: "Pedir o contrato assinado\ne o boleto" }),
    );
  });

  it("sem descrição, ou só com espaço, o payload leva null", async () => {
    const user = userEvent.setup();
    const onCriar = renderizar();
    await preencherObrigatorios(user);
    await user.type(screen.getByLabelText("Descrição"), "   ");

    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(onCriar).toHaveBeenCalledWith(expect.objectContaining({ descricao: null }));
  });

  it("🔴 acima de 2000 caracteres trava o botão e diz quanto passou", async () => {
    const user = userEvent.setup();
    const onCriar = renderizar();
    await preencherObrigatorios(user);

    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "x".repeat(2001) },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Descrição acima do limite de 2000 caracteres.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("2001");
    expect(screen.getByText("2001 caracteres agora.")).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Descrição")).toHaveAccessibleDescription(
      /acima do limite.*2001 caracteres agora/,
    );
    expect(screen.getByRole("button", { name: "Criar tarefa" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(onCriar).not.toHaveBeenCalled();
  });

  it("com 2000 caracteres exatos, cria sem aviso", async () => {
    const user = userEvent.setup();
    const onCriar = renderizar();
    await preencherObrigatorios(user);

    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "x".repeat(2000) },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));
    expect(onCriar).toHaveBeenCalledWith(expect.objectContaining({ descricao: "x".repeat(2000) }));
  });

  it("🔴 reabrir o formulário traz a descrição vazia", async () => {
    const user = userEvent.setup();
    const props = {
      onFechar: vi.fn(),
      catalogo: CATALOGO,
      time: TIME,
      clientes: CLIENTES,
      estadoDoCatalogo: PRONTO,
      estadoDoTime: PRONTO,
      estadoDosClientes: PRONTO,
      onCriar: vi.fn(),
      salvando: false,
    };
    const { rerender } = render(<FormularioDeTarefa aberto {...props} />);
    await user.type(screen.getByLabelText("Descrição"), "rascunho abandonado");
    expect(screen.getByLabelText("Descrição")).toHaveValue("rascunho abandonado");

    rerender(<FormularioDeTarefa aberto={false} {...props} />);
    rerender(<FormularioDeTarefa aberto {...props} />);

    expect(screen.getByLabelText("Descrição")).toHaveValue("");
  });
});

describe("FormularioDeTarefa — participantes (D-066)", () => {
  const TIME_DE_TRES = [
    { id: "user-1", nome: "Fulano" },
    { id: "user-2", nome: "Beltrana" },
    { id: "user-3", nome: "Ciclano" },
  ];

  function renderizarComOTime(time: readonly { id: string; nome: string }[], aberto = true) {
    const onCriar = vi.fn();
    const props = {
      onFechar: vi.fn(),
      catalogo: CATALOGO,
      time,
      clientes: CLIENTES,
      estadoDoCatalogo: PRONTO,
      estadoDoTime: PRONTO,
      estadoDosClientes: PRONTO,
      onCriar,
      salvando: false,
    };
    const { rerender } = render(<FormularioDeTarefa aberto={aberto} {...props} />);
    return {
      onCriar,
      reabrir: () => {
        rerender(<FormularioDeTarefa aberto={false} {...props} />);
        rerender(<FormularioDeTarefa aberto {...props} />);
      },
    };
  }

  it("🔴 os marcados vão no payload, e o responsável escolhido sai da lista e do payload", async () => {
    const user = userEvent.setup();
    const { onCriar } = renderizarComOTime(TIME_DE_TRES);
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("checkbox", { name: "Beltrana" }));
    await user.click(screen.getByRole("checkbox", { name: "Ciclano" }));
    await user.selectOptions(screen.getByLabelText("Responsável"), "user-3");
    expect(screen.queryByRole("checkbox", { name: "Ciclano" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(onCriar).toHaveBeenCalledWith(
      expect.objectContaining({ responsavelId: "user-3", participantes: ["user-2"] }),
    );
  });

  it("sem marcar ninguém, o payload leva lista vazia", async () => {
    const user = userEvent.setup();
    const { onCriar } = renderizarComOTime(TIME_DE_TRES);
    await preencherObrigatorios(user);

    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(onCriar).toHaveBeenCalledWith(expect.objectContaining({ participantes: [] }));
  });

  it("só o responsável no time: 'Ninguém para incluir.'", async () => {
    const user = userEvent.setup();
    renderizarComOTime([{ id: "user-1", nome: "Fulano" }]);

    await user.selectOptions(screen.getByLabelText("Responsável"), "user-1");

    expect(screen.getByText("Ninguém para incluir.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("time em erro: nem caixas nem 'Ninguém para incluir.' (o aviso do time já diz)", () => {
    renderizar({ estadoDoTime: "erro" });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Ninguém para incluir.")).not.toBeInTheDocument();
  });

  it("🔴 reabrir o formulário traz ninguém marcado", async () => {
    const user = userEvent.setup();
    const { reabrir } = renderizarComOTime(TIME_DE_TRES);

    await user.click(screen.getByRole("checkbox", { name: "Beltrana" }));
    reabrir();

    expect(screen.getByRole("checkbox", { name: "Beltrana" })).not.toBeChecked();
  });

  describe("quem cria inclui participantes", () => {
    it("owner com outra pessoa como responsável vê as caixas, e os marcados vão no payload", async () => {
      const user = userEvent.setup();
      const { onCriar } = renderizarComOTime(TIME_DE_TRES);
      await preencherObrigatorios(user);

      await user.selectOptions(screen.getByLabelText("Responsável"), "user-2");
      expect(screen.getByRole("group", { name: "Participantes" })).toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: "Ciclano" }));
      await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

      expect(onCriar).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: "user-2", participantes: ["user-3"] }),
      );
    });

    it("member que responde pela tarefa vê as caixas, e os marcados vão no payload", async () => {
      perfil.papel = "member";
      perfil.meuId = "user-1";
      const user = userEvent.setup();
      const { onCriar } = renderizarComOTime(TIME_DE_TRES);
      await preencherObrigatorios(user);

      await user.selectOptions(screen.getByLabelText("Responsável"), "user-1");
      expect(screen.getByRole("group", { name: "Participantes" })).toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: "Beltrana" }));
      await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

      expect(onCriar).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: "user-1", participantes: ["user-2"] }),
      );
    });

    it("🔴 member criando para outra pessoa vê as caixas, e os marcados vão no payload sem o responsável", async () => {
      perfil.papel = "member";
      perfil.meuId = "user-1";
      const user = userEvent.setup();
      const { onCriar } = renderizarComOTime(TIME_DE_TRES);
      await preencherObrigatorios(user);

      await user.selectOptions(screen.getByLabelText("Responsável"), "user-1");
      await user.click(screen.getByRole("checkbox", { name: "Beltrana" }));
      await user.click(screen.getByRole("checkbox", { name: "Ciclano" }));
      await user.selectOptions(screen.getByLabelText("Responsável"), "user-2");

      expect(screen.getByRole("group", { name: "Participantes" })).toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: "Beltrana" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

      expect(onCriar).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: "user-2", participantes: ["user-3"] }),
      );
    });

    it("🔴 member sem responsável vê as caixas, e os marcados vão no payload", async () => {
      perfil.papel = "member";
      perfil.meuId = "user-1";
      const user = userEvent.setup();
      const { onCriar } = renderizarComOTime(TIME_DE_TRES);
      await preencherObrigatorios(user);

      expect(screen.getByLabelText("Responsável")).toHaveValue("");
      expect(screen.getByRole("group", { name: "Participantes" })).toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: "Ciclano" }));
      await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

      expect(onCriar).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: null, participantes: ["user-3"] }),
      );
    });
  });
});
