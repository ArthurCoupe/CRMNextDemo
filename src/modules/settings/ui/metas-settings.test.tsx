import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const salvarMetas = vi.fn();
const atividade = {
  data: { toquesSemana: 40, r1Semana: 12, confirmado: false } as unknown,
  isPending: false,
  isError: false,
};
const financeiras = {
  data: { mrrMensal: 16000, tcvAlvo: 60000, confirmado: false } as unknown,
  isPending: false,
  isError: false,
};

vi.mock("../hooks/use-settings", () => ({
  useMetasDeAtividade: () => atividade,
  useMetasFinanceiras: () => financeiras,
  useSalvarMetas: () => ({ mutate: salvarMetas, isPending: false }),
}));

const { MetasSettings } = await import("./metas-settings");

const MENSAGEM_INTEIRO = /Meta de atividade é número inteiro/;
const MENSAGEM_REAIS_INVALIDO = /Valor em reais inválido/;

function botaoSalvar() {
  return screen.getByRole("button", { name: "Salvar metas" });
}

beforeEach(() => {
  salvarMetas.mockReset();
});

describe("card de Metas — atividade exige inteiro (SET-1)", () => {
  it("🔴 decimal em 'R1 marcadas por semana': mensagem aparece e salvarMetas NAO e chamado", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("R1 marcadas por semana"), {
      target: { value: "12,5" },
    });

    expect(screen.getByText(MENSAGEM_INTEIRO)).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();

    fireEvent.click(botaoSalvar());
    expect(salvarMetas).not.toHaveBeenCalled();
  });

  it("🔴 mesma mensagem para decimal em 'Toques por semana'", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("Toques por semana"), {
      target: { value: "150,5" },
    });

    expect(screen.getByText(MENSAGEM_INTEIRO)).toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    expect(salvarMetas).not.toHaveBeenCalled();
  });

  it("🔴 notação científica ('1e3') tambem e recusada — paraNumero aceitava", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("Toques por semana"), {
      target: { value: "1e3" },
    });

    expect(screen.getByText(MENSAGEM_INTEIRO)).toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    expect(salvarMetas).not.toHaveBeenCalled();
  });

  it("inteiro em R1 ('12'): sem mensagem, salva com r1Semana: 12", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("R1 marcadas por semana"), {
      target: { value: "12" },
    });

    expect(screen.queryByText(MENSAGEM_INTEIRO)).not.toBeInTheDocument();
    expect(botaoSalvar()).toBeEnabled();

    fireEvent.click(botaoSalvar());
    expect(salvarMetas).toHaveBeenCalledWith(expect.objectContaining({ r1Semana: 12 }));
  });

  it("campos em reais continuam aceitando decimal — MRR '1500,50' grava 1500.5", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("MRR mensal"), {
      target: { value: "1500,50" },
    });

    expect(screen.queryByText(MENSAGEM_INTEIRO)).not.toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    expect(salvarMetas).toHaveBeenCalledWith(expect.objectContaining({ mrrMensal: 1500.5 }));
  });
});

describe("card de Metas — campos em reais leem pt-BR (SET-2)", () => {
  it("🔴 '50.000' em 'MRR mensal' grava 50000, não 50 — Number('50.000') lia cinquenta", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("MRR mensal"), {
      target: { value: "50.000" },
    });

    expect(screen.getByText("Em reais: R$ 50.000,00")).toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    expect(salvarMetas).toHaveBeenCalledWith(expect.objectContaining({ mrrMensal: 50000 }));
  });

  it("'1.500,50' em 'TCV alvo' grava 1500.5 — milhar E decimal juntos", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("TCV alvo"), {
      target: { value: "1.500,50" },
    });

    fireEvent.click(botaoSalvar());
    expect(salvarMetas).toHaveBeenCalledWith(expect.objectContaining({ tcvAlvo: 1500.5 }));
  });

  it("🔴 'abc' em 'MRR mensal' bloqueia 'Salvar metas' com mensagem, não vira 0 em silêncio", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("MRR mensal"), {
      target: { value: "abc" },
    });

    expect(screen.getByText(MENSAGEM_REAIS_INVALIDO)).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();

    fireEvent.click(botaoSalvar());
    expect(salvarMetas).not.toHaveBeenCalled();
  });

  it("'50,5' em atividade continua recusado (SET-1 não regride)", () => {
    render(<MetasSettings />);

    fireEvent.change(screen.getByLabelText("Toques por semana"), {
      target: { value: "50,5" },
    });

    expect(screen.getByText(MENSAGEM_INTEIRO)).toBeInTheDocument();
    fireEvent.click(botaoSalvar());
    expect(salvarMetas).not.toHaveBeenCalled();
  });
});

describe("card de Metas — o aviso de meta não confirmada diz o que as telas fazem (DASH-6)", () => {
  it("🔴 nomeia placar sem %, Dashboard e Resultado com % e selo", () => {
    render(<MetasSettings />);

    const aviso = screen.getByText(/ninguém os validou/).closest("p");
    expect(aviso).toHaveTextContent(/placar do Pipeline mostra só o número/);
    expect(aviso).toHaveTextContent(/Dashboard e o Resultado mostram o %/);
    expect(aviso).toHaveTextContent(/meta não confirmada/);
    expect(aviso).not.toHaveTextContent(/número absoluto e não o percentual/);
  });
});

describe("card de Metas — o rascunho acompanha a leitura", () => {
  it("leitura que chega depois de montar preenche os campos", () => {
    const lido = atividade.data;
    atividade.data = undefined;
    atividade.isPending = true;
    try {
      const { rerender } = render(<MetasSettings />);
      expect(screen.queryByLabelText("Toques por semana")).not.toBeInTheDocument();

      atividade.data = lido;
      atividade.isPending = false;
      rerender(<MetasSettings />);

      expect(screen.getByLabelText("Toques por semana")).toHaveValue("40");
    } finally {
      atividade.data = lido;
      atividade.isPending = false;
    }
  });

  it("releitura com valor novo substitui o rascunho", () => {
    const lido = financeiras.data;
    try {
      const { rerender } = render(<MetasSettings />);
      expect(screen.getByLabelText("MRR mensal")).toHaveValue("16000");

      financeiras.data = { mrrMensal: 18000, tcvAlvo: 60000, confirmado: false };
      rerender(<MetasSettings />);

      expect(screen.getByLabelText("MRR mensal")).toHaveValue("18000");
    } finally {
      financeiras.data = lido;
    }
  });
});
