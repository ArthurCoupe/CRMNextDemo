import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tarefa } from "@/modules/tasks/domain/task";

const tarefas: {
  data: { tarefas: readonly Tarefa[]; temMais: boolean };
  isPending: boolean;
  isError: boolean;
} = { data: { tarefas: [], temMais: false }, isPending: false, isError: false };
const catalogo: {
  data: readonly { categoria: string; tipo: string }[];
  isPending: boolean;
  isError: boolean;
} = { data: [], isPending: false, isError: false };
const clientes = { data: [], isPending: false, isError: false };
const time: {
  data: readonly { id: string; nome: string }[] | undefined;
  isPending: boolean;
  isError: boolean;
} = { data: [{ id: "u2", nome: "Beltrana" }], isPending: false, isError: false };
const criar = { mutate: vi.fn(), isPending: false };

vi.mock("@/modules/tasks/hooks/use-tasks", () => ({
  useTarefas: () => tarefas,
  useCatalogoDeTarefas: () => catalogo,
  useClientesParaSelecao: () => clientes,
  usePessoasDoTime: () => time,
  useCriarTarefa: () => criar,
  useMoverTarefa: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/modules/tasks/ui/quadro-de-tarefas", () => ({
  QuadroDeTarefas: ({
    tarefas: lista,
    onAbrir,
  }: {
    readonly tarefas: readonly { readonly id: string; readonly titulo: string }[];
    readonly onAbrir: (id: string) => void;
  }) => (
    <>
      {lista.map((t) => (
        <button key={t.id} type="button" onClick={() => onAbrir(t.id)}>
          {`abrir ${t.titulo}`}
        </button>
      ))}
    </>
  ),
}));
vi.mock("@/modules/tasks/ui/dialogo-de-tarefa", () => ({
  DialogoDeTarefa: ({
    tarefa,
    onFechar,
    foraDaLista,
  }: {
    readonly tarefa: { readonly titulo: string };
    readonly onFechar: () => void;
    readonly foraDaLista?: boolean;
  }) => (
    <div role="dialog" aria-label={`Tarefa ${tarefa.titulo}`}>
      {foraDaLista === true && <p>fora da lista</p>}
      <input aria-label="rascunho" />
      <button type="button" onClick={onFechar}>
        fechar
      </button>
    </div>
  ),
}));

const { TasksPage } = await import("./tasks");

beforeEach(() => {
  tarefas.data = { tarefas: [], temMais: false };
  tarefas.isPending = false;
  tarefas.isError = false;
  time.data = [{ id: "u2", nome: "Beltrana" }];
  time.isError = false;
  catalogo.data = [];
  criar.mutate.mockReset();
});

function filtroDeResponsavel(): HTMLSelectElement {
  return screen.getByRole("combobox", { name: "Responsável" }) as HTMLSelectElement;
}

describe("/tasks — filtro de responsável com o time em erro", () => {
  it("🔴 continua deixando escolher 'Todas as pessoas', e a falha fica visível", async () => {
    const user = userEvent.setup();
    time.data = undefined;
    time.isError = true;
    render(<TasksPage />);

    expect(filtroDeResponsavel()).toBeEnabled();
    expect(screen.getByText(/Não foi possível ler o time/)).toBeInTheDocument();
    await user.selectOptions(filtroDeResponsavel(), "__todas");
    expect(filtroDeResponsavel().value).toBe("__todas");
    expect(screen.queryByRole("option", { name: "Beltrana" })).not.toBeInTheDocument();
  });

  it("com o time carregado, as pessoas entram no filtro sem aviso", () => {
    render(<TasksPage />);

    expect(screen.getByRole("option", { name: "Beltrana" })).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível ler/)).not.toBeInTheDocument();
  });
});

describe("/tasks — o formulário espera o resultado do insert (TASK-6)", () => {
  type OpcoesDoMutate = { onSuccess?: () => void } | undefined;

  const dialogo = () => within(screen.getByRole("dialog", { name: "Nova tarefa" }));

  async function abrirEPreencher() {
    const user = userEvent.setup();
    catalogo.data = [{ categoria: "Comercial", tipo: "Follow-up" }];
    render(<TasksPage />);
    await user.click(screen.getByRole("button", { name: /nova tarefa/i }));
    await user.selectOptions(dialogo().getByLabelText("Categoria"), "Comercial");
    await user.selectOptions(dialogo().getByLabelText("Tipo"), "Follow-up");
    await user.type(dialogo().getByLabelText("Título"), "Ligar para a Acme");
    return user;
  }

  it("🔴 insert falhou: o diálogo continua aberto com o título digitado", async () => {
    criar.mutate.mockImplementation(() => undefined);
    const user = await abrirEPreencher();

    await user.click(dialogo().getByRole("button", { name: "Criar tarefa" }));

    expect(criar.mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Nova tarefa" })).toBeInTheDocument();
    expect(dialogo().getByLabelText("Título")).toHaveValue("Ligar para a Acme");
  });

  it("insert deu certo: o diálogo fecha e reabrir nasce vazio", async () => {
    criar.mutate.mockImplementation((_nova: unknown, opcoes: OpcoesDoMutate) =>
      opcoes?.onSuccess?.(),
    );
    const user = await abrirEPreencher();

    await user.click(dialogo().getByRole("button", { name: "Criar tarefa" }));

    expect(screen.queryByRole("dialog", { name: "Nova tarefa" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /nova tarefa/i }));
    expect(dialogo().getByLabelText("Título")).toHaveValue("");
    expect(dialogo().getByLabelText("Categoria")).toHaveValue("");
  });
});

describe("/tasks — o diálogo da tarefa (D-066)", () => {
  const TAREFA: Tarefa = {
    id: "tarefa-1",
    titulo: "Revisar contrato",
    descricao: null,
    categoria: "Comercial",
    tipo: "Follow-up",
    responsavelId: "u1",
    responsavel: "Fulano",
    clienteId: null,
    cliente: null,
    coluna: "todo",
    prioridade: "media",
    prazo: "2026-09-10",
    recorrencia: "nenhuma",
    raizRecorrente: null,
    criadoPor: "u1",
    participantes: [],
    links: [],
    pastaDoDriveDoCliente: null,
  };

  it("abrir o cartão mostra o diálogo daquela tarefa, e fechar o tira", async () => {
    const user = userEvent.setup();
    tarefas.data = { tarefas: [TAREFA], temMais: false };
    render(<TasksPage />);

    await user.click(screen.getByRole("button", { name: "abrir Revisar contrato" }));
    expect(screen.getByRole("dialog", { name: "Tarefa Revisar contrato" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "fechar" }));

    expect(screen.queryByRole("dialog", { name: /Tarefa/ })).not.toBeInTheDocument();
  });

  async function abrirEDigitar(user: ReturnType<typeof userEvent.setup>) {
    tarefas.data = { tarefas: [TAREFA], temMais: false };
    const pagina = render(<TasksPage />);
    await user.click(screen.getByRole("button", { name: "abrir Revisar contrato" }));
    await user.type(screen.getByLabelText("rascunho"), "meio caminho");
    return pagina;
  }

  it("🔴 a tarefa aberta sai da lista: o diálogo fica, com o aviso e o rascunho", async () => {
    const user = userEvent.setup();
    const { rerender } = await abrirEDigitar(user);

    tarefas.data = { tarefas: [], temMais: false };
    rerender(<TasksPage />);

    expect(screen.getByRole("dialog", { name: "Tarefa Revisar contrato" })).toBeInTheDocument();
    expect(screen.getByText("fora da lista")).toBeInTheDocument();
    expect(screen.getByLabelText("rascunho")).toHaveValue("meio caminho");
  });

  it("🔴 ela volta para a lista: o aviso some, e o diálogo mostra a versão relida", async () => {
    const user = userEvent.setup();
    const { rerender } = await abrirEDigitar(user);

    tarefas.data = { tarefas: [], temMais: false };
    rerender(<TasksPage />);
    tarefas.data = { tarefas: [{ ...TAREFA, titulo: "Revisar contrato v2" }], temMais: false };
    rerender(<TasksPage />);

    expect(screen.getByRole("dialog", { name: "Tarefa Revisar contrato v2" })).toBeInTheDocument();
    expect(screen.queryByText("fora da lista")).not.toBeInTheDocument();
    expect(screen.getByLabelText("rascunho")).toHaveValue("meio caminho");
  });

  it("na lista, a releitura atualiza a tarefa aberta, sem aviso (o positivo ao lado)", async () => {
    const user = userEvent.setup();
    const { rerender } = await abrirEDigitar(user);

    tarefas.data = { tarefas: [{ ...TAREFA, titulo: "Revisar contrato v2" }], temMais: false };
    rerender(<TasksPage />);

    expect(screen.getByRole("dialog", { name: "Tarefa Revisar contrato v2" })).toBeInTheDocument();
    expect(screen.queryByText("fora da lista")).not.toBeInTheDocument();
  });

  it.each([
    ["carregando", { isPending: true, isError: false }],
    ["em erro", { isPending: false, isError: true }],
  ])("🔴 a lista %s, sem a tarefa aberta: o diálogo fica, com o aviso", async (_nome, consulta) => {
    const user = userEvent.setup();
    const { rerender } = await abrirEDigitar(user);

    tarefas.data = { tarefas: [], temMais: false };
    tarefas.isPending = consulta.isPending;
    tarefas.isError = consulta.isError;
    rerender(<TasksPage />);

    expect(screen.getByRole("dialog", { name: "Tarefa Revisar contrato" })).toBeInTheDocument();
    expect(screen.getByText("fora da lista")).toBeInTheDocument();
    expect(screen.getByLabelText("rascunho")).toHaveValue("meio caminho");
  });

  it("🔴 o diálogo fecha pelo próprio caminho (Apagar, X) e não reabre quando a lista muda", async () => {
    const user = userEvent.setup();
    const { rerender } = await abrirEDigitar(user);

    await user.click(screen.getByRole("button", { name: "fechar" }));
    expect(screen.queryByRole("dialog", { name: /Tarefa/ })).not.toBeInTheDocument();

    tarefas.data = { tarefas: [], temMais: false };
    rerender(<TasksPage />);
    tarefas.data = { tarefas: [TAREFA], temMais: false };
    rerender(<TasksPage />);
    expect(screen.queryByRole("dialog", { name: /Tarefa/ })).not.toBeInTheDocument();
  });

  it("o cabeçalho diz que 'Minhas tarefas' inclui onde a pessoa participa", () => {
    render(<TasksPage />);

    expect(
      screen.getByText(/Mostrando as tarefas em que você é responsável ou participante\./),
    ).toBeInTheDocument();
  });
});
