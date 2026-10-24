import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OportunidadeListada } from "@/modules/pipeline/api/pipeline.repository";
import type { EstagioDoPipeline } from "@/modules/pipeline/domain/pipeline";

const mutate = vi.fn();
let estagios: EstagioDoPipeline[] | undefined;
let estagiosFalharam = false;

vi.mock("@/modules/pipeline/hooks/use-pipeline", () => ({
  useEstagios: () => ({ data: estagios, isError: estagiosFalharam }),
  useMoverEstagio: () => ({ mutate, isPending: false }),
}));
type ConsultaDeClientes = {
  data: { id: string; nome: string }[] | undefined;
  isError: boolean;
  isPending: boolean;
};
let clientes: ConsultaDeClientes;
vi.mock("@/modules/contracts/hooks/use-contracts", () => ({
  useClientesParaSelecao: () => clientes,
}));

const propsDoFormulario = vi.fn();
vi.mock("@/modules/clients/ui/formulario-de-cliente", () => ({
  FormularioDeCliente: (props: unknown) => {
    propsDoFormulario(props);
    return null;
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { ClienteDaProposta } = await import("./cliente-da-proposta");

const PIPELINE = "10000000-0000-4000-8000-000000000001";
const FECHADO: EstagioDoPipeline = {
  id: "estagio-fechado",
  pipelineId: PIPELINE,
  nome: "Fechado",
  ordem: 8,
  tipo: "fechado",
};
const R2: EstagioDoPipeline = { ...FECHADO, id: "estagio-r2", nome: "R2", ordem: 5, tipo: "r2" };

const EM_R2 = {
  id: "o1",
  nome: "Acme",
  estagio: "r2",
  estagioId: "estagio-r2",
  estagioMudouEm: "2026-10-06T15:00:00Z",
  pipelineId: PIPELINE,
  contatoNome: "Ana",
  contatoEmail: null,
  contatoTelefone: null,
  segmento: "Saúde",
  nicho: null,
} as unknown as OportunidadeListada;
const GANHA = { ...EM_R2, estagio: "fechado", estagioId: "estagio-fechado" } as OportunidadeListada;

type PropsDoFormulario = {
  aberto: boolean;
  ganhaInicial: { id: string; nome: string } | null;
  aoCriar: (id: string, ganhaId: string | null) => void;
};
const ultimasPropsDoFormulario = () =>
  propsDoFormulario.mock.calls.at(-1)?.[0] as PropsDoFormulario | undefined;

beforeEach(() => {
  mutate.mockReset();
  clientes = {
    data: [
      { id: "c1", nome: "Acme Ltda" },
      { id: "c2", nome: "Beta Ltda" },
    ],
    isError: false,
    isPending: false,
  };
  estagiosFalharam = false;
  propsDoFormulario.mockReset();
  vi.mocked(toast.error).mockReset();
  estagios = [R2, FECHADO];
});

describe("ClienteDaProposta (D-071)", () => {
  function renderizar(
    oportunidade: OportunidadeListada,
    aoClienteEscolhido = vi.fn(),
    aoFechar = vi.fn(),
  ) {
    render(
      <ClienteDaProposta
        oportunidade={oportunidade}
        aoClienteEscolhido={aoClienteEscolhido}
        aoFechar={aoFechar}
      />,
    );
    return { aoClienteEscolhido, aoFechar };
  }

  it("diz que falta o contrato; o formulário e a lista nascem fechados", () => {
    renderizar(EM_R2);

    expect(screen.getByText(/ainda não tem contrato/)).toBeInTheDocument();
    expect(ultimasPropsDoFormulario()?.aberto).toBe(false);
    expect(screen.queryByRole("combobox", { name: "Cliente" })).toBeNull();
  });

  it("🔴 fora de Fechado: marca a ganha primeiro, e só no sucesso abre o cadastro", async () => {
    renderizar(EM_R2);

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar cliente novo" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [variaveis, opcoes] = mutate.mock.calls[0] as [
      Record<string, unknown>,
      { onSuccess: () => void },
    ];
    expect(variaveis).toEqual({
      oportunidadeId: "o1",
      destino: FECHADO,
      estagioAtualId: "estagio-r2",
      pipelineId: PIPELINE,
    });
    expect(ultimasPropsDoFormulario()?.aberto).toBe(false);

    act(() => opcoes.onSuccess());

    expect(ultimasPropsDoFormulario()?.aberto).toBe(true);
    expect(ultimasPropsDoFormulario()?.ganhaInicial).toMatchObject({ id: "o1", nome: "Acme" });
  });

  it("já em Fechado: abre o cadastro direto, sem mover", async () => {
    renderizar(GANHA);

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar cliente novo" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(ultimasPropsDoFormulario()?.aberto).toBe(true);
  });

  it("o cliente criado no formulário segue para quem abriu", async () => {
    const { aoClienteEscolhido } = renderizar(GANHA);
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar cliente novo" }));

    act(() => ultimasPropsDoFormulario()?.aoCriar("c9", "o1"));

    expect(aoClienteEscolhido).toHaveBeenCalledWith("c9");
  });

  it("🔴 cliente existente: marca a ganha, e só no sucesso mostra a lista; escolher segue com o id", async () => {
    const { aoClienteEscolhido } = renderizar(EM_R2);

    await userEvent.click(screen.getByRole("button", { name: "Usar cliente existente" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("combobox", { name: "Cliente" })).toBeNull();

    const [, opcoes] = mutate.mock.calls[0] as [unknown, { onSuccess: () => void }];
    act(() => opcoes.onSuccess());

    expect(screen.getByRole("button", { name: "Seguir para o contrato" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Cliente" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Beta Ltda" }));
    await userEvent.click(screen.getByRole("button", { name: "Seguir para o contrato" }));

    expect(aoClienteEscolhido).toHaveBeenCalledWith("c2");
  });

  it("🔴 marcada a ganha uma vez, a outra saída não move de novo", async () => {
    renderizar(EM_R2);

    await userEvent.click(screen.getByRole("button", { name: "Usar cliente existente" }));
    const [, opcoes] = mutate.mock.calls[0] as [unknown, { onSuccess: () => void }];
    act(() => opcoes.onSuccess());
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar cliente novo" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(ultimasPropsDoFormulario()?.aberto).toBe(true);
  });

  it("lista de clientes em erro: diz que não leu, e cadastrar novo continua", async () => {
    clientes = { data: undefined, isError: true, isPending: false };
    renderizar(GANHA);

    await userEvent.click(screen.getByRole("button", { name: "Usar cliente existente" }));

    expect(screen.getByText(/Não foi possível ler os clientes/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Cliente" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cadastrar cliente novo" })).toBeEnabled();
  });

  it("pipeline sem estágio Fechado: avisa e não move", async () => {
    estagios = [R2];
    renderizar(EM_R2);

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar cliente novo" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("Cancelar fecha o aceite", async () => {
    const { aoFechar } = renderizar(EM_R2);

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(aoFechar).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("leitura dos estágios falhou: diz isso, em vez de um botão travado sem explicação", () => {
    estagios = undefined;
    estagiosFalharam = true;
    renderizar(EM_R2);

    expect(screen.getByText(/Não foi possível ler os estágios/)).toBeInTheDocument();
  });
});
