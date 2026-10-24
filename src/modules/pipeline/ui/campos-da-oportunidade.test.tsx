import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampoDoPipeline, ValoresDeCampos } from "../domain/campos";
import { BlocoDeCampos, CamposDoFormulario } from "./campos-da-oportunidade";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const PIPELINE = "10000000-0000-4000-8000-000000000001";
const ID_TEXTO = "20000000-0000-4000-8000-000000000001";
const ID_NUMERO = "20000000-0000-4000-8000-000000000002";
const ID_SIM_NAO = "20000000-0000-4000-8000-000000000003";
const ID_LISTA = "20000000-0000-4000-8000-000000000004";
const ID_INATIVO = "20000000-0000-4000-8000-000000000005";

function campo(parcial: Partial<CampoDoPipeline> & Pick<CampoDoPipeline, "id" | "nome" | "tipo">) {
  return {
    pipelineId: PIPELINE,
    opcoes: null,
    obrigatorio: false,
    ordem: 0,
    ativo: true,
    ...parcial,
  } satisfies CampoDoPipeline;
}

const TEXTO = campo({ id: ID_TEXTO, nome: "Observação do site", tipo: "texto", ordem: 0 });
const NUMERO = campo({ id: ID_NUMERO, nome: "Funcionários", tipo: "numero", ordem: 1 });
const SIM_NAO = campo({ id: ID_SIM_NAO, nome: "Tem site?", tipo: "sim_nao", ordem: 2 });
const LISTA = campo({
  id: ID_LISTA,
  nome: "Nicho de atuação",
  tipo: "lista",
  opcoes: ["Clínica", "Varejo", "Serviços"],
  ordem: 3,
});
const INATIVO = campo({
  id: ID_INATIVO,
  nome: "Campo antigo",
  tipo: "texto",
  ordem: 4,
  ativo: false,
});
const CAMPOS: readonly CampoDoPipeline[] = [TEXTO, NUMERO, SIM_NAO, LISTA, INATIVO];

const OUTRO_VALOR: ValoresDeCampos = { [ID_SIM_NAO]: true };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("BlocoDeCampos (ficha)", () => {
  const gravadorQueAceita = () => vi.fn<(v: ValoresDeCampos) => Promise<void>>(async () => {});

  function renderizar(valores: ValoresDeCampos, podeEditar = true) {
    const aoGravar = gravadorQueAceita();
    const { container } = render(
      <BlocoDeCampos
        campos={CAMPOS}
        valores={valores}
        podeEditar={podeEditar}
        aoGravar={aoGravar}
      />,
    );
    return { aoGravar, container };
  }

  it("texto: sair do campo grava o objeto MESCLADO, não só a chave tocada", async () => {
    const user = userEvent.setup();
    const { aoGravar } = renderizar(OUTRO_VALOR);

    await user.type(screen.getByLabelText("Observação do site"), "Só Instagram");
    await user.tab();

    expect(aoGravar).toHaveBeenCalledTimes(1);
    expect(aoGravar).toHaveBeenCalledWith({ ...OUTRO_VALOR, [ID_TEXTO]: "Só Instagram" });
  });

  it("🔴 texto apagado REMOVE a chave — não grava string vazia", async () => {
    const user = userEvent.setup();
    const { aoGravar } = renderizar({ ...OUTRO_VALOR, [ID_TEXTO]: "Só Instagram" });

    await user.clear(screen.getByLabelText("Observação do site"));
    await user.tab();

    expect(aoGravar).toHaveBeenCalledWith(OUTRO_VALOR);
    expect(aoGravar.mock.calls[0]?.[0]).not.toHaveProperty(ID_TEXTO);
  });

  it("número: lê pt-BR ('1.234,5') e grava NUMBER, mesclado — o mesmo parser da importação", () => {
    const { aoGravar } = renderizar(OUTRO_VALOR);
    const input = screen.getByLabelText("Funcionários");
    expect(input).toHaveAttribute("inputmode", "decimal");

    fireEvent.change(input, { target: { value: "1.234,5" } });
    fireEvent.blur(input);

    expect(aoGravar).toHaveBeenCalledWith({ ...OUTRO_VALOR, [ID_NUMERO]: 1234.5 });
  });

  it("número gravado aparece em pt-BR, e sair sem mudar não grava", () => {
    const { aoGravar } = renderizar({ ...OUTRO_VALOR, [ID_NUMERO]: 1234.5 });
    const input = screen.getByLabelText("Funcionários");
    expect(input).toHaveValue("1.234,5");

    fireEvent.blur(input);
    expect(aoGravar).not.toHaveBeenCalled();
  });

  it("🔴 texto que o parser não lê avisa com o que foi digitado e NÃO grava", () => {
    const { aoGravar } = renderizar(OUTRO_VALOR);
    const input = screen.getByLabelText("Funcionários");

    fireEvent.change(input, { target: { value: "12abc" } });
    fireEvent.blur(input);

    expect(aoGravar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Funcionários: '12abc' não é um número.");
  });

  it("número apagado remove a chave", () => {
    const { aoGravar } = renderizar({ ...OUTRO_VALOR, [ID_NUMERO]: 12 });
    const input = screen.getByLabelText("Funcionários");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(aoGravar).toHaveBeenCalledWith(OUTRO_VALOR);
  });

  it("sim/não: o Switch grava boolean, mesclado", async () => {
    const user = userEvent.setup();
    const { aoGravar } = renderizar({ [ID_TEXTO]: "x" });

    const chave = screen.getByRole("switch", { name: "Tem site?" });
    expect(chave).not.toBeChecked();
    await user.click(chave);

    expect(aoGravar).toHaveBeenCalledWith({ [ID_TEXTO]: "x", [ID_SIM_NAO]: true });
  });

  it("sim/não gravado como true aparece marcado; desmarcar grava false (não remove)", async () => {
    const user = userEvent.setup();
    const { aoGravar } = renderizar({ [ID_TEXTO]: "x", [ID_SIM_NAO]: true });

    const chave = screen.getByRole("switch", { name: "Tem site?" });
    expect(chave).toBeChecked();
    await user.click(chave);

    expect(aoGravar).toHaveBeenCalledWith({ [ID_TEXTO]: "x", [ID_SIM_NAO]: false });
  });

  it("lista: escolher uma opção grava a string, mesclada", async () => {
    const user = userEvent.setup();
    const { aoGravar } = renderizar(OUTRO_VALOR);

    await user.click(screen.getByRole("combobox", { name: "Nicho de atuação" }));
    await user.click(await screen.findByRole("option", { name: "Varejo" }));

    expect(aoGravar).toHaveBeenCalledWith({ ...OUTRO_VALOR, [ID_LISTA]: "Varejo" });
  });

  it("🔴 lista: 'Sem valor' REMOVE a chave — opção marcada por engano tem volta", async () => {
    const user = userEvent.setup();
    const { aoGravar } = renderizar({ ...OUTRO_VALOR, [ID_LISTA]: "Varejo" });

    await user.click(screen.getByRole("combobox", { name: "Nicho de atuação" }));
    await user.click(await screen.findByRole("option", { name: "Sem valor" }));

    expect(aoGravar).toHaveBeenCalledWith(OUTRO_VALOR);
  });

  it("🔴 dois commits seguidos SEM refetch: o segundo leva o primeiro (mescla do estado local, não da prop)", async () => {
    const user = userEvent.setup();
    const { aoGravar } = renderizar({});

    await user.type(screen.getByLabelText("Observação do site"), "Só Instagram");
    await user.tab();
    await user.click(screen.getByRole("switch", { name: "Tem site?" }));

    expect(aoGravar).toHaveBeenNthCalledWith(1, { [ID_TEXTO]: "Só Instagram" });
    expect(aoGravar).toHaveBeenNthCalledWith(2, { [ID_TEXTO]: "Só Instagram", [ID_SIM_NAO]: true });
  });

  it("🔴 prop com a MESMA assinatura (identidade nova) não apaga o estado local; assinatura nova re-semeia", async () => {
    const user = userEvent.setup();
    const aoGravar = gravadorQueAceita();
    const { rerender } = render(
      <BlocoDeCampos campos={CAMPOS} valores={{}} podeEditar aoGravar={aoGravar} />,
    );
    await user.type(screen.getByLabelText("Observação do site"), "Só Instagram");
    await user.tab();

    rerender(<BlocoDeCampos campos={CAMPOS} valores={{}} podeEditar aoGravar={aoGravar} />);
    expect(screen.getByLabelText("Observação do site")).toHaveValue("Só Instagram");
    await user.click(screen.getByRole("switch", { name: "Tem site?" }));
    expect(aoGravar).toHaveBeenLastCalledWith({ [ID_TEXTO]: "Só Instagram", [ID_SIM_NAO]: true });

    rerender(
      <BlocoDeCampos
        campos={CAMPOS}
        valores={{ [ID_LISTA]: "Varejo" }}
        podeEditar
        aoGravar={aoGravar}
      />,
    );
    expect(screen.getByLabelText("Observação do site")).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Tem site?" })).not.toBeChecked();
    await user.click(screen.getByRole("switch", { name: "Tem site?" }));
    expect(aoGravar).toHaveBeenLastCalledWith({ [ID_LISTA]: "Varejo", [ID_SIM_NAO]: true });
  });

  it("🔴 PATCH recusado: a chave volta ao que era, e o commit seguinte NÃO reenvia o valor recusado", async () => {
    const user = userEvent.setup();
    const aoGravar = vi.fn<(v: ValoresDeCampos) => Promise<void>>(async () => {});
    aoGravar.mockRejectedValueOnce(
      new Error("O campo Nicho de atuação só aceita: Clínica, Varejo, Serviços."),
    );
    render(
      <BlocoDeCampos
        campos={CAMPOS}
        valores={{ [ID_LISTA]: "Varejo" }}
        podeEditar
        aoGravar={aoGravar}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Nicho de atuação" }));
    await user.click(await screen.findByRole("option", { name: "Clínica" }));
    expect(aoGravar).toHaveBeenNthCalledWith(1, { [ID_LISTA]: "Clínica" });
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Nicho de atuação" })).toHaveTextContent(
        "Varejo",
      ),
    );

    await user.type(screen.getByLabelText("Observação do site"), "Só Instagram");
    await user.tab();
    expect(aoGravar).toHaveBeenNthCalledWith(2, {
      [ID_LISTA]: "Varejo",
      [ID_TEXTO]: "Só Instagram",
    });
  });

  it("PATCH recusado de uma chave não desfaz o commit em voo de OUTRA chave", async () => {
    const user = userEvent.setup();
    let recusar: (erro: Error) => void = () => {};
    const aoGravar = vi.fn<(v: ValoresDeCampos) => Promise<void>>(async () => {});
    aoGravar.mockImplementationOnce(
      () =>
        new Promise<void>((_, rejeitar) => {
          recusar = rejeitar;
        }),
    );
    render(<BlocoDeCampos campos={CAMPOS} valores={{}} podeEditar aoGravar={aoGravar} />);

    await user.click(screen.getByRole("switch", { name: "Tem site?" }));
    await user.type(screen.getByLabelText("Observação do site"), "x");
    await user.tab();
    expect(aoGravar).toHaveBeenNthCalledWith(2, { [ID_SIM_NAO]: true, [ID_TEXTO]: "x" });

    recusar(new Error("recusado"));
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Tem site?" })).not.toBeChecked(),
    );
    expect(screen.getByLabelText("Observação do site")).toHaveValue("x");
  });

  it("texto da ficha tem o teto de 500 no input, como o formulário", () => {
    renderizar({});
    expect(screen.getByLabelText("Observação do site")).toHaveAttribute("maxlength", "500");
  });

  it("🔴 sim/não sem resposta diz 'sem resposta' ao lado do Switch; com 'Não' gravado, não diz", () => {
    const { unmount } = render(
      <BlocoDeCampos campos={CAMPOS} valores={{}} podeEditar aoGravar={gravadorQueAceita()} />,
    );
    expect(screen.getByRole("switch", { name: "Tem site?" })).not.toBeChecked();
    expect(screen.getByText("sem resposta")).toBeInTheDocument();
    unmount();

    render(
      <BlocoDeCampos
        campos={CAMPOS}
        valores={{ [ID_SIM_NAO]: false }}
        podeEditar
        aoGravar={gravadorQueAceita()}
      />,
    );
    expect(screen.getByRole("switch", { name: "Tem site?" })).not.toBeChecked();
    expect(screen.queryByText("sem resposta")).toBeNull();
  });

  it("🔴 campo desativado COM valor: só leitura, rotulado 'campo desativado', sem input", () => {
    renderizar({ [ID_INATIVO]: "valor antigo" });

    expect(screen.getByText(/Campo antigo/)).toHaveTextContent("campo desativado");
    expect(screen.getByText("valor antigo")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Campo antigo/)).toBeNull();
  });

  it("campo desativado SEM valor não aparece", () => {
    renderizar({});
    expect(screen.queryByText(/Campo antigo/)).toBeNull();
  });

  it("🔴 sem campo ativo e sem valor gravado: não renderiza nada", () => {
    const aoGravar = gravadorQueAceita();
    const { container } = render(
      <BlocoDeCampos campos={[INATIVO]} valores={{}} podeEditar aoGravar={aoGravar} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("quem não pode editar lê os valores pelo rótulo ('Sim', número em pt-BR) e nenhum controle existe", () => {
    renderizar(
      { [ID_TEXTO]: "Só Instagram", [ID_NUMERO]: 1234.5, [ID_SIM_NAO]: true, [ID_LISTA]: "Varejo" },
      false,
    );

    expect(screen.getByText("Só Instagram")).toBeInTheDocument();
    expect(screen.getByText("1.234,5")).toBeInTheDocument();
    expect(screen.getByText("Sim")).toBeInTheDocument();
    expect(screen.getByText("Varejo")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("🔴 valor NUNCA vira HTML: texto com tag aparece como texto", () => {
    renderizar({ [ID_TEXTO]: "<b>negrito</b>" }, false);
    expect(screen.getByText("<b>negrito</b>")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
  });
});

describe("CamposDoFormulario (nova oportunidade)", () => {
  function renderizar(valores: ValoresDeCampos, problemas: string | null = null) {
    const aoMudar = vi.fn();
    render(
      <CamposDoFormulario
        campos={CAMPOS}
        valores={valores}
        aoMudar={aoMudar}
        problemas={problemas}
      />,
    );
    return { aoMudar };
  }

  it("só os campos ATIVOS aparecem; obrigatório leva '*' e aria-required", () => {
    render(
      <CamposDoFormulario
        campos={[{ ...SIM_NAO, obrigatorio: true }, LISTA, INATIVO]}
        valores={{}}
        aoMudar={vi.fn()}
        problemas={null}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Tem site? *" })).toHaveAttribute(
      "aria-required",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "Nicho de atuação" })).not.toHaveAttribute(
      "aria-required",
      "true",
    );
    expect(screen.queryByText(/Campo antigo/)).toBeNull();
  });

  it("texto: digitar entrega o objeto mesclado", () => {
    const { aoMudar } = renderizar(OUTRO_VALOR);

    fireEvent.change(screen.getByLabelText("Observação do site"), {
      target: { value: "Só Instagram" },
    });
    expect(aoMudar).toHaveBeenLastCalledWith({ ...OUTRO_VALOR, [ID_TEXTO]: "Só Instagram" });
  });

  it("texto apagado remove a chave", () => {
    const { aoMudar } = renderizar({ ...OUTRO_VALOR, [ID_TEXTO]: "Só Instagram" });

    fireEvent.change(screen.getByLabelText("Observação do site"), { target: { value: "" } });
    expect(aoMudar).toHaveBeenLastCalledWith(OUTRO_VALOR);
  });

  it("número: lê pt-BR e entrega number; vazio remove a chave", () => {
    const { aoMudar } = renderizar(OUTRO_VALOR);
    const input = screen.getByLabelText("Funcionários");
    expect(input).toHaveAttribute("inputmode", "decimal");

    fireEvent.change(input, { target: { value: "1.234,5" } });
    expect(aoMudar).toHaveBeenLastCalledWith({ ...OUTRO_VALOR, [ID_NUMERO]: 1234.5 });

    fireEvent.change(input, { target: { value: "" } });
    expect(aoMudar).toHaveBeenLastCalledWith(OUTRO_VALOR);
  });

  it("🔴 número que o parser não lê: o rascunho guarda o TEXTO e a frase diz o que foi digitado", () => {
    const { aoMudar } = renderizar(OUTRO_VALOR);

    fireEvent.change(screen.getByLabelText("Funcionários"), { target: { value: "12abc" } });
    expect(aoMudar).toHaveBeenLastCalledWith({ ...OUTRO_VALOR, [ID_NUMERO]: "12abc" });

    renderizar({ ...OUTRO_VALOR, [ID_NUMERO]: "12abc" }, "O campo Funcionários espera um número.");
    expect(screen.getByRole("alert")).toHaveTextContent("Funcionários: '12abc' não é um número");
  });

  it("🔴 sim/não no formulário tem TRÊS estados: sem resposta, Sim, Não — 'Não' não exige ligar e desligar", async () => {
    const user = userEvent.setup();
    const { aoMudar } = renderizar({ [ID_TEXTO]: "x" });

    await user.click(screen.getByRole("combobox", { name: "Tem site?" }));
    await user.click(await screen.findByRole("option", { name: "Não" }));

    expect(aoMudar).toHaveBeenLastCalledWith({ [ID_TEXTO]: "x", [ID_SIM_NAO]: false });
  });

  it("lista: escolher entrega a opção; '—' remove a chave", async () => {
    const user = userEvent.setup();
    const { aoMudar } = renderizar({ ...OUTRO_VALOR, [ID_LISTA]: "Varejo" });

    await user.click(screen.getByRole("combobox", { name: "Nicho de atuação" }));
    await user.click(await screen.findByRole("option", { name: "Clínica" }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...OUTRO_VALOR, [ID_LISTA]: "Clínica" });

    await user.click(screen.getByRole("combobox", { name: "Nicho de atuação" }));
    await user.click(await screen.findByRole("option", { name: "-" }));
    expect(aoMudar).toHaveBeenLastCalledWith(OUTRO_VALOR);
  });

  it("o problema aparece como alerta sob o bloco; sem problema, sem alerta", () => {
    const { unmount } = render(
      <CamposDoFormulario
        campos={CAMPOS}
        valores={{}}
        aoMudar={vi.fn()}
        problemas="O campo Tem site? é obrigatório."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("O campo Tem site? é obrigatório.");
    unmount();

    renderizar({});
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sem campo ativo: não renderiza nada", () => {
    const { container } = render(
      <CamposDoFormulario campos={[INATIVO]} valores={{}} aoMudar={vi.fn()} problemas={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CamposDoFormulario: ids únicos por montagem", () => {
  const CAMPO_TEXTO = {
    id: "c-obs",
    pipelineId: "p1",
    nome: "Observação",
    tipo: "texto" as const,
    opcoes: null,
    obrigatorio: false,
    ordem: 1,
    ativo: true,
  };

  it("🔴 duas montagens do mesmo campo NÃO repetem id, e cada label aponta para o próprio input", () => {
    render(
      <>
        <CamposDoFormulario
          campos={[CAMPO_TEXTO]}
          valores={{}}
          aoMudar={vi.fn()}
          problemas={null}
        />
        <CamposDoFormulario
          campos={[CAMPO_TEXTO]}
          valores={{}}
          aoMudar={vi.fn()}
          problemas={null}
        />
      </>,
    );

    const inputs = screen.getAllByRole("textbox", { name: "Observação" });
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.id).not.toBe(inputs[1]?.id);
    expect(document.querySelectorAll(`[id="${inputs[0]?.id}"]`)).toHaveLength(1);
  });

  it("`prefixoDoId` explícito entra no id", () => {
    render(
      <CamposDoFormulario
        campos={[CAMPO_TEXTO]}
        valores={{}}
        aoMudar={vi.fn()}
        problemas={null}
        prefixoDoId="lote"
      />,
    );
    expect(screen.getByRole("textbox", { name: "Observação" })).toHaveAttribute(
      "id",
      "lote-campo-c-obs",
    );
  });
});
