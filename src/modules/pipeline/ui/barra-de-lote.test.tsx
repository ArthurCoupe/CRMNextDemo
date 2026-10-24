import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampoDoPipeline } from "../domain/campos";
import type { EstagioDoPipeline, MotivoDeSaida } from "../domain/pipeline";

const PIPELINE = "10000000-0000-4000-8000-000000000001";

const MOTIVOS: MotivoDeSaida[] = [
  { id: "m-preco", pipelineId: PIPELINE, tipo: "perda", rotulo: "Preço", ordem: 1, ativo: true },
  {
    id: "m-verba",
    pipelineId: PIPELINE,
    tipo: "descarte",
    rotulo: "Sem verba",
    ordem: 1,
    ativo: true,
  },
];

const mutate = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../hooks/use-pipeline", () => ({
  useMoverEstagio: () => ({ mutate, isPending: false }),
  useMotivos: () => ({ data: MOTIVOS, isPending: false, isError: false }),
}));

const { BarraDeLote } = await import("./barra-de-lote");
const { toast } = await import("sonner");

const ESTAGIOS: EstagioDoPipeline[] = (
  [
    ["Contato", "prospeccao"],
    ["Proposta", "r1"],
    ["Ganho", "fechado"],
    ["Perdido", "perdido"],
    ["Fora do alvo", "descartado"],
  ] as const
).map(([nome, tipo], i) => ({ id: `p-${tipo}`, pipelineId: PIPELINE, nome, ordem: i + 1, tipo }));

const CAMPOS: CampoDoPipeline[] = [
  {
    id: "c-site",
    pipelineId: PIPELINE,
    nome: "Tem site?",
    tipo: "sim_nao",
    opcoes: null,
    obrigatorio: true,
    ordem: 1,
    ativo: true,
  },
  {
    id: "c-nicho",
    pipelineId: PIPELINE,
    nome: "Nicho",
    tipo: "lista",
    opcoes: ["Clínica", "Varejo"],
    obrigatorio: false,
    ordem: 2,
    ativo: true,
  },
  {
    id: "c-obs",
    pipelineId: PIPELINE,
    nome: "Observação antiga",
    tipo: "texto",
    opcoes: null,
    obrigatorio: false,
    ordem: 3,
    ativo: false,
  },
  {
    id: "c-cidade",
    pipelineId: PIPELINE,
    nome: "Cidade",
    tipo: "texto",
    opcoes: null,
    obrigatorio: false,
    ordem: 4,
    ativo: true,
  },
];

const RESPONSAVEIS = [
  { id: "vinicius", nome: "Vinicius", ativo: true },
  { id: "ana", nome: "Ana", ativo: true },
];

function montar(props: Partial<Parameters<typeof BarraDeLote>[0]> = {}) {
  const aoAplicar = vi.fn();
  const aoLimpar = vi.fn();
  const contarAlvos = vi.fn(() => 2);
  render(
    <BarraDeLote
      pipelineId={PIPELINE}
      quantidade={2}
      estagios={ESTAGIOS}
      campos={CAMPOS}
      responsaveis={RESPONSAVEIS}
      contarAlvos={contarAlvos}
      aoAplicar={aoAplicar}
      aoLimpar={aoLimpar}
      pendente={false}
      {...props}
    />,
  );
  return { aoAplicar, aoLimpar, contarAlvos, user: userEvent.setup() };
}

async function escolherResponsavelNaBarra(user: ReturnType<typeof userEvent.setup>, nome: string) {
  await user.click(screen.getByRole("combobox", { name: "Responsável" }));
  await user.click(await screen.findByRole("option", { name: nome }));
}

const botaoAplicar = () => screen.getByRole("button", { name: /^Aplica/ });

beforeEach(() => {
  mutate.mockReset();
  vi.mocked(toast.info).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("a barra", () => {
  it("é uma região 'Ações em lote' com a contagem anunciada, e Aplicar travado sem ação", () => {
    montar();

    const regiao = screen.getByRole("region", { name: "Ações em lote" });
    expect(regiao).toBeInTheDocument();
    const contagem = screen.getByText("2 selecionadas");
    expect(contagem).toHaveAttribute("aria-live", "polite");
    expect(botaoAplicar()).toBeDisabled();
  });

  it("uma selecionada: singular", () => {
    montar({ quantidade: 1 });
    expect(screen.getByText("1 selecionada")).toBeInTheDocument();
  });

  it("Limpar chama aoLimpar", async () => {
    const { aoLimpar, user } = montar();
    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(aoLimpar).toHaveBeenCalledTimes(1);
  });

  it("`pendente` trava Aplicar mesmo com ação escolhida", async () => {
    const { user } = montar({ pendente: true });
    await user.click(screen.getByRole("combobox", { name: "Responsável" }));
    await user.click(await screen.findByRole("option", { name: "Vinicius" }));
    expect(botaoAplicar()).toBeDisabled();
  });
});

describe("Responsável", () => {
  it("escolher e Aplicar manda { ownerId }", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Responsável" }));
    await user.click(await screen.findByRole("option", { name: "Vinicius" }));
    expect(botaoAplicar()).toBeEnabled();
    await user.click(botaoAplicar());

    expect(aoAplicar).toHaveBeenCalledWith({ ownerId: "vinicius" });
  });

  it("'Não alterar' desfaz a escolha e trava Aplicar de novo", async () => {
    const { user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Responsável" }));
    await user.click(await screen.findByRole("option", { name: "Vinicius" }));
    await user.click(screen.getByRole("combobox", { name: "Responsável" }));
    await user.click(await screen.findByRole("option", { name: "Não alterar" }));

    expect(botaoAplicar()).toBeDisabled();
  });
});

describe("Etapa", () => {
  it("🔴 lista os estágios do pipeline SEM o de tipo fechado — fechar é pelo botão Fechar, um por vez", async () => {
    const { user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Etapa" }));

    expect(await screen.findByRole("option", { name: "Proposta" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Perdido" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ganho" })).toBeNull();
  });

  it("estágio aberto: Aplicar manda { estagioId }", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Proposta" }));
    await user.click(botaoAplicar());

    expect(aoAplicar).toHaveBeenCalledWith({ estagioId: "p-r1" });
  });

  it("🔴 Perdido abre o diálogo de motivo com a contagem, e o Confirmar aplica com o motivo — sem passar pelo Aplicar", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Perdido" }));

    const dialogo = await screen.findByRole("dialog", { name: "Marcar como perdida" });
    expect(dialogo).toHaveTextContent("2 oportunidades");
    expect(aoAplicar).not.toHaveBeenCalled();

    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    await user.type(screen.getByLabelText("Observação (opcional)"), "caro demais");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(aoAplicar).toHaveBeenCalledWith({
      estagioId: "p-perdido",
      motivoId: "m-preco",
      motivoObs: "caro demais",
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("uma selecionada: o diálogo diz '1 oportunidade', não '1 oportunidades'", async () => {
    const { user } = montar({ quantidade: 1 });

    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Perdido" }));

    const dialogo = await screen.findByRole("dialog", { name: "Marcar como perdida" });
    expect(dialogo).toHaveTextContent("1 oportunidade:");
    expect(dialogo).not.toHaveTextContent("1 oportunidades");
  });

  it("Descartado: o mesmo diálogo, título de descarte, motivo de descarte", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Fora do alvo" }));

    await screen.findByRole("dialog", { name: "Descartar oportunidade" });
    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    await user.click(await screen.findByRole("option", { name: "Sem verba" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(aoAplicar).toHaveBeenCalledWith({ estagioId: "p-descartado", motivoId: "m-verba" });
  });

  it("Cancelar no diálogo não aplica nada e a Etapa continua sem escolha", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Perdido" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(aoAplicar).not.toHaveBeenCalled();
    expect(botaoAplicar()).toBeDisabled();
  });

  it("responsável já escolhido viaja junto com o motivo no Confirmar", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Responsável" }));
    await user.click(await screen.findByRole("option", { name: "Ana" }));
    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Perdido" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(aoAplicar).toHaveBeenCalledWith({
      ownerId: "ana",
      estagioId: "p-perdido",
      motivoId: "m-preco",
    });
  });
});

describe("Campo", () => {
  it("lista só os campos ATIVOS", async () => {
    const { user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Campo" }));

    expect(await screen.findByRole("option", { name: "Tem site?" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Nicho" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Observação antiga" })).toBeNull();
  });

  it("🔴 sim/não escolhido → Aplicar manda { campos: { [id]: true } }; sem valor, Aplicar segue travado", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Campo" }));
    await user.click(await screen.findByRole("option", { name: "Tem site?" }));
    expect(botaoAplicar()).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Tem site? *" }));
    await user.click(await screen.findByRole("option", { name: "Sim" }));
    await user.click(botaoAplicar());

    expect(aoAplicar).toHaveBeenCalledWith({ campos: { "c-site": true } });
  });

  it("lista: a opção escolhida viaja como texto", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Campo" }));
    await user.click(await screen.findByRole("option", { name: "Nicho" }));
    await user.click(screen.getByRole("combobox", { name: "Nicho" }));
    await user.click(await screen.findByRole("option", { name: "Varejo" }));
    await user.click(botaoAplicar());

    expect(aoAplicar).toHaveBeenCalledWith({ campos: { "c-nicho": "Varejo" } });
  });

  it("🔴 texto viaja APARADO; só espaços não é valor e o Aplicar segue travado", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Campo" }));
    await user.click(await screen.findByRole("option", { name: "Cidade" }));
    await user.type(screen.getByRole("textbox", { name: "Cidade" }), "   ");
    expect(botaoAplicar()).toBeDisabled();

    await user.clear(screen.getByRole("textbox", { name: "Cidade" }));
    await user.type(screen.getByRole("textbox", { name: "Cidade" }), "  SP  ");
    await user.click(botaoAplicar());

    expect(aoAplicar).toHaveBeenCalledWith({ campos: { "c-cidade": "SP" } });
  });

  it("trocar de campo descarta o valor do anterior — a chave velha não viaja", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Campo" }));
    await user.click(await screen.findByRole("option", { name: "Tem site?" }));
    await user.click(screen.getByRole("combobox", { name: "Tem site? *" }));
    await user.click(await screen.findByRole("option", { name: "Sim" }));
    await user.click(screen.getByRole("combobox", { name: "Campo" }));
    await user.click(await screen.findByRole("option", { name: "Nicho" }));

    expect(botaoAplicar()).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Nicho" }));
    await user.click(await screen.findByRole("option", { name: "Clínica" }));
    await user.click(botaoAplicar());

    expect(aoAplicar).toHaveBeenCalledWith({ campos: { "c-nicho": "Clínica" } });
  });
});

describe("as listas que falharam", () => {
  it("responsáveis falhou: aviso em role=status, e não lista vazia calada", () => {
    montar({ responsaveis: [], responsaveisFalharam: true });
    expect(screen.getByRole("status")).toHaveTextContent("Não foi possível ler os responsáveis");
  });

  it("campos falhou: aviso; sem falha e sem campo ativo, nem Select nem aviso", () => {
    const { unmount } = render(
      <BarraDeLote
        pipelineId={PIPELINE}
        quantidade={2}
        estagios={ESTAGIOS}
        campos={[]}
        camposFalharam
        responsaveis={RESPONSAVEIS}
        contarAlvos={() => 2}
        aoAplicar={vi.fn()}
        aoLimpar={vi.fn()}
        pendente={false}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Não foi possível ler os campos");
    unmount();

    montar({ campos: [] });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Campo" })).toBeNull();
  });
});

describe("fix round 1 — campo escolhido incompleto trava tudo", () => {
  it("🔴 responsável + campo de número com '12abc': Aplicar travado, com a frase do problema", async () => {
    const { aoAplicar, user } = montar({
      campos: [
        ...CAMPOS,
        {
          id: "c-valor",
          pipelineId: PIPELINE,
          nome: "Valor",
          tipo: "numero",
          opcoes: null,
          obrigatorio: false,
          ordem: 4,
          ativo: true,
        },
      ],
    });

    await escolherResponsavelNaBarra(user, "Vinicius");
    await user.click(screen.getByRole("combobox", { name: "Campo" }));
    await user.click(await screen.findByRole("option", { name: "Valor" }));
    expect(botaoAplicar()).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Valor" }), "12abc");
    expect(botaoAplicar()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("não é um número");
    await user.click(botaoAplicar());
    expect(aoAplicar).not.toHaveBeenCalled();

    await user.clear(screen.getByRole("textbox", { name: "Valor" }));
    await user.type(screen.getByRole("textbox", { name: "Valor" }), "12,5");
    expect(botaoAplicar()).toBeEnabled();
    await user.click(botaoAplicar());
    expect(aoAplicar).toHaveBeenCalledWith({ ownerId: "vinicius", campos: { "c-valor": 12.5 } });
  });

  it("🔴 campo escolhido sem valor + Etapa perdido: o diálogo NÃO abre e a barra avisa", async () => {
    const { aoAplicar, user } = montar();

    await user.click(screen.getByRole("combobox", { name: "Campo" }));
    await user.click(await screen.findByRole("option", { name: "Tem site?" }));
    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Perdido" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toContain("Tem site?");
    expect(aoAplicar).not.toHaveBeenCalled();
  });
});

describe("fix round 1 — 'Nada a mudar.' antes do diálogo, e fecha se chegar lá", () => {
  it("🔴 Etapa perdido com zero alvo que mude: toast e o diálogo NÃO abre", async () => {
    const contarAlvos = vi.fn(() => 0);
    const { aoAplicar, user } = montar({ contarAlvos });

    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Perdido" }));

    expect(contarAlvos).toHaveBeenCalledWith({ estagioId: "p-perdido" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toast.info).toHaveBeenCalledWith("Nada a mudar.");
    expect(aoAplicar).not.toHaveBeenCalled();
  });

  it("🔴 o board mudou com o diálogo aberto (zero no Confirmar): toast, diálogo fecha, nada aplicado", async () => {
    const contarAlvos = vi
      .fn<(acao: unknown) => number>()
      .mockReturnValueOnce(2)
      .mockReturnValue(0);
    const { aoAplicar, user } = montar({ contarAlvos });

    await user.click(screen.getByRole("combobox", { name: "Etapa" }));
    await user.click(await screen.findByRole("option", { name: "Perdido" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    await user.click(await screen.findByRole("option", { name: "Preço" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.info).toHaveBeenCalledWith("Nada a mudar.");
    expect(aoAplicar).not.toHaveBeenCalled();
  });

  it("Aplicar direto com zero alvo: toast e nada disparado — o mesmo portão do diálogo", async () => {
    const { aoAplicar, user } = montar({ contarAlvos: vi.fn(() => 0) });

    await escolherResponsavelNaBarra(user, "Vinicius");
    await user.click(botaoAplicar());

    expect(toast.info).toHaveBeenCalledWith("Nada a mudar.");
    expect(aoAplicar).not.toHaveBeenCalled();
  });
});
