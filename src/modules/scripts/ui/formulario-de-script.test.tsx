import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Script } from "../api/scripts.repository";

const criar = { mutate: vi.fn(), isPending: false };
const atualizar = { mutate: vi.fn(), isPending: false };
const nichosPorTipo: Record<string, readonly string[]> = {
  sdr: ["advocacia", "clinicas"],
  closer: ["contabilidade"],
};

vi.mock("../hooks/use-scripts", () => ({
  useCriarScript: () => criar,
  useAtualizarScript: () => atualizar,
  useNichos: (tipo: string) => ({ data: nichosPorTipo[tipo] ?? [] }),
}));

const { FormularioDeScript } = await import("./formulario-de-script");

const SCRIPT_SDR: Script = {
  id: "s1",
  tipo: "sdr",
  title: "Primeiro toque",
  body: "Oi",
  nicho: "advocacia",
  canal: "whatsapp",
  momento: "primeiro_contato",
  pipelineStage: null,
  sortOrder: 0,
  active: true,
  updatedAt: "2026-09-08T00:00:00.000Z",
};

beforeEach(() => {
  criar.mutate.mockReset();
  atualizar.mutate.mockReset();
});

describe("FormularioDeScript", () => {
  it("o Select de momento so oferece os do tipo corrente", async () => {
    const user = userEvent.setup();
    render(<FormularioDeScript tipo="sdr" aberto script={null} aoFechar={() => undefined} />);

    await user.click(screen.getByLabelText(/momento/i));

    expect(await screen.findByRole("option", { name: "Primeiro contato" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Follow-up" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quebra de objeção" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Abertura" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Proposta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Objeção" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Fechamento" })).not.toBeInTheDocument();
  });

  it("titulo e corpo vazios bloqueiam o salvar", async () => {
    const user = userEvent.setup();
    render(<FormularioDeScript tipo="sdr" aberto script={null} aoFechar={() => undefined} />);

    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/título/i), "Primeiro toque");
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/corpo/i), "Oi");
    expect(screen.getByRole("button", { name: /salvar/i })).not.toBeDisabled();
  });

  it("🔴 nao envia combinacao que o banco recusaria", async () => {
    vi.resetModules();
    vi.doMock("../domain/script", async () => {
      const real = await vi.importActual<typeof import("../domain/script")>("../domain/script");
      return { ...real, combinacaoValida: () => false };
    });
    const { FormularioDeScript: FormularioComBarreiraQuebrada } =
      await import("./formulario-de-script");

    const user = userEvent.setup();
    render(
      <FormularioComBarreiraQuebrada tipo="sdr" aberto script={null} aoFechar={() => undefined} />,
    );

    await user.type(screen.getByLabelText(/título/i), "Primeiro toque");
    await user.type(screen.getByLabelText(/corpo/i), "Oi");

    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
    expect(criar.mutate).not.toHaveBeenCalled();

    vi.doUnmock("../domain/script");
  });

  it("com tudo preenchido, chama criarScript com os campos certos", async () => {
    const user = userEvent.setup();
    render(<FormularioDeScript tipo="sdr" aberto script={null} aoFechar={() => undefined} />);

    await user.type(screen.getByLabelText(/título/i), "Primeiro toque");
    await user.type(screen.getByLabelText(/corpo/i), "Oi");
    await user.type(screen.getByLabelText(/nicho/i), "advocacia");

    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(criar.mutate).toHaveBeenCalledWith(
      {
        tipo: "sdr",
        title: "Primeiro toque",
        body: "Oi",
        nicho: "advocacia",
        canal: "whatsapp",
        momento: "primeiro_contato",
        pipelineStage: null,
      },
      expect.anything(),
    );
  });

  it("achado 4: nicho vazio manda string vazia — quem decide nao gravar e' o repositorio", async () => {
    const user = userEvent.setup();
    render(<FormularioDeScript tipo="sdr" aberto script={null} aoFechar={() => undefined} />);

    await user.type(screen.getByLabelText(/título/i), "Primeiro toque");
    await user.type(screen.getByLabelText(/corpo/i), "Oi");

    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(criar.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ nicho: "" }),
      expect.anything(),
    );
  });

  it("o datalist de nicho sugere os do tipo corrente, e nao os de outro tipo", () => {
    render(<FormularioDeScript tipo="sdr" aberto script={null} aoFechar={() => undefined} />);

    const input = screen.getByLabelText(/nicho/i);
    const datalist = document.getElementById(input.getAttribute("list") ?? "");
    const opcoes = Array.from(datalist?.querySelectorAll("option") ?? []).map((o) =>
      o.getAttribute("value"),
    );

    expect(opcoes).toEqual(["advocacia", "clinicas"]);
    expect(opcoes).not.toContain("contabilidade");
  });

  it("nicho fora da lista sugerida continua livre e vai no payload", async () => {
    const user = userEvent.setup();
    render(<FormularioDeScript tipo="sdr" aberto script={null} aoFechar={() => undefined} />);

    await user.type(screen.getByLabelText(/título/i), "Primeiro toque");
    await user.type(screen.getByLabelText(/corpo/i), "Oi");
    await user.type(screen.getByLabelText(/nicho/i), "odontologia");

    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(criar.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ nicho: "odontologia" }),
      expect.anything(),
    );
  });

  it("modo edicao preenche os campos com o script recebido", () => {
    render(<FormularioDeScript tipo="sdr" aberto script={SCRIPT_SDR} aoFechar={() => undefined} />);

    expect(screen.getByLabelText(/título/i)).toHaveValue("Primeiro toque");
    expect(screen.getByLabelText(/corpo/i)).toHaveValue("Oi");
    expect(screen.getByLabelText(/nicho/i)).toHaveValue("advocacia");
  });

  it("editar chama atualizarScript com o id do script", async () => {
    const user = userEvent.setup();
    render(<FormularioDeScript tipo="sdr" aberto script={SCRIPT_SDR} aoFechar={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(atualizar.mutate).toHaveBeenCalledWith(
      {
        id: "s1",
        dados: {
          tipo: "sdr",
          title: "Primeiro toque",
          body: "Oi",
          nicho: "advocacia",
          canal: "whatsapp",
          momento: "primeiro_contato",
        },
        updatedAt: SCRIPT_SDR.updatedAt,
      },
      expect.anything(),
    );
  });

  it("trocar o tipo com valor invalido escolhido corrige para uma opcao valida do novo tipo", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FormularioDeScript tipo="sdr" aberto script={null} aoFechar={() => undefined} />,
    );

    await user.click(screen.getByLabelText(/momento/i));
    await user.click(await screen.findByRole("option", { name: "Quebra de objeção" }));
    await user.click(screen.getByLabelText(/canal/i));
    await user.click(await screen.findByRole("option", { name: "LinkedIn" }));

    rerender(<FormularioDeScript tipo="closer" aberto script={null} aoFechar={() => undefined} />);

    await user.type(screen.getByLabelText(/título/i), "Abertura de reunião");
    await user.type(screen.getByLabelText(/corpo/i), "Oi, tudo bem?");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(criar.mutate).toHaveBeenCalledTimes(1);
    const chamada = criar.mutate.mock.calls[0][0] as { canal: string; momento: string };
    expect(["reuniao", "whatsapp", "email"]).toContain(chamada.canal);
    expect(["abertura", "proposta", "objecao", "fechamento"]).toContain(chamada.momento);
  });

  it("trocar o script com o dialogo aberto mostra o novo", () => {
    const { rerender } = render(
      <FormularioDeScript tipo="sdr" aberto script={SCRIPT_SDR} aoFechar={() => undefined} />,
    );
    const outro: Script = { ...SCRIPT_SDR, id: "s2", title: "Follow-up de terca" };

    rerender(<FormularioDeScript tipo="sdr" aberto script={outro} aoFechar={() => undefined} />);

    expect(screen.getByLabelText(/título/i)).toHaveValue("Follow-up de terca");
  });

  it("fechar e reabrir descarta o que foi digitado", async () => {
    const user = userEvent.setup();
    const tela = (aberto: boolean) => (
      <FormularioDeScript
        tipo="sdr"
        aberto={aberto}
        script={SCRIPT_SDR}
        aoFechar={() => undefined}
      />
    );
    const { rerender } = render(tela(true));
    await user.type(screen.getByLabelText(/título/i), " largado");
    expect(screen.getByLabelText(/título/i)).toHaveValue("Primeiro toque largado");

    rerender(tela(false));
    rerender(tela(true));

    expect(screen.getByLabelText(/título/i)).toHaveValue("Primeiro toque");
  });

  it("fluxo da pagina: monta fechado, edita A, fecha, edita B, fecha, abre novo", () => {
    const b: Script = { ...SCRIPT_SDR, id: "s2", title: "Follow-up de terca" };
    const tela = (aberto: boolean, script: Script | null) => (
      <FormularioDeScript tipo="sdr" aberto={aberto} script={script} aoFechar={() => undefined} />
    );
    const titulo = () => screen.getByLabelText(/título/i);
    const { rerender } = render(tela(false, null));

    rerender(tela(true, SCRIPT_SDR));
    expect(titulo()).toHaveValue("Primeiro toque");
    rerender(tela(false, SCRIPT_SDR));
    rerender(tela(true, b));
    expect(titulo()).toHaveValue("Follow-up de terca");
    rerender(tela(false, b));
    rerender(tela(true, null));
    expect(titulo()).toHaveValue("");
  });

  it("trocar so o tipo nao recarrega o script: o que foi digitado fica", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FormularioDeScript tipo="sdr" aberto script={SCRIPT_SDR} aoFechar={() => undefined} />,
    );
    await user.type(screen.getByLabelText(/título/i), " editado");

    rerender(
      <FormularioDeScript tipo="closer" aberto script={SCRIPT_SDR} aoFechar={() => undefined} />,
    );

    expect(screen.getByLabelText(/título/i)).toHaveValue("Primeiro toque editado");
  });

  it("na edição, a aba trocada por baixo não muda o tipo, o canal nem o momento do script", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FormularioDeScript tipo="sdr" aberto script={SCRIPT_SDR} aoFechar={() => undefined} />,
    );

    rerender(
      <FormularioDeScript tipo="closer" aberto script={SCRIPT_SDR} aoFechar={() => undefined} />,
    );
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    const { dados } = atualizar.mutate.mock.calls[0][0] as { dados: Record<string, unknown> };
    expect(dados).toMatchObject({
      tipo: "sdr",
      canal: SCRIPT_SDR.canal,
      momento: SCRIPT_SDR.momento,
    });
  });

  it("A1.7: editar um script com estágio não manda pipelineStage", async () => {
    const user = userEvent.setup();
    render(
      <FormularioDeScript
        tipo="sdr"
        aberto
        script={{ ...SCRIPT_SDR, pipelineStage: "qualificacao" }}
        aoFechar={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /salvar/i }));

    const { dados } = atualizar.mutate.mock.calls[0][0] as { dados: Record<string, unknown> };
    expect(dados).not.toHaveProperty("pipelineStage");
  });

  it("A1.7: na edição, trocar o tipo para Closer leva canal e momento válidos", async () => {
    const user = userEvent.setup();
    render(<FormularioDeScript tipo="sdr" aberto script={SCRIPT_SDR} aoFechar={() => undefined} />);

    await user.click(screen.getByLabelText("Tipo"));
    await user.click(await screen.findByRole("option", { name: "Closer" }));
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(atualizar.mutate).toHaveBeenCalledWith(
      {
        id: "s1",
        dados: {
          tipo: "closer",
          title: "Primeiro toque",
          body: "Oi",
          nicho: "advocacia",
          canal: "whatsapp",
          momento: "abertura",
        },
        updatedAt: SCRIPT_SDR.updatedAt,
      },
      expect.anything(),
    );
  });

  it("na criação não há seletor de tipo: o tipo é o da aba", () => {
    render(<FormularioDeScript tipo="sdr" aberto script={null} aoFechar={() => undefined} />);

    expect(screen.queryByLabelText("Tipo")).not.toBeInTheDocument();
  });
});
