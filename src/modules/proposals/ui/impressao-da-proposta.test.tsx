import { readFileSync } from "node:fs";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { brl } from "@/shared/lib/format";

import type { PropostaParaImpressao } from "../api/proposals.repository";

let consulta: { data: PropostaParaImpressao | undefined; isError: boolean; error: Error | null };

vi.mock("../hooks/use-proposals", () => ({
  usePropostaParaImpressao: () => consulta,
}));

const { DICA_DE_IMPRESSAO, ImpressaoDaProposta } = await import("./impressao-da-proposta");

const reais = (valor: number) => brl(valor).replace(/\s/g, " ");

const DADOS: PropostaParaImpressao = {
  proposta: {
    id: "p1",
    numero: 7,
    versao: 1,
    status: "enviada",
    validaAte: "2026-10-19",
    escopo: "Gestão de tráfego e sistema de agendamento.",
    prazoEntregaDias: 30,
    formaPagamento: "pix",
    parcelasProjeto: 3,
    fidelidadeMeses: 12,
    enviadaEm: "2026-10-04T15:00:00Z",
    aceitaEm: null,
    recusadaEm: null,
    criadaEm: "2026-10-04T14:00:00Z",
    totalMensal: 900,
    totalProjeto: 4500,
    vencida: false,
    ultima: true,
    clienteId: null,
  },
  oportunidade: {
    nome: "Acme",
    contatoNome: "Ana",
    contatoEmail: "ana@exemplo.invalido",
    contatoTelefone: null,
  },
  itens: [
    {
      id: "i1",
      produtoId: "tra",
      nome: "Tráfego",
      descricao: "Meta e Google",
      frente: "trafego",
      frentesDoCombo: null,
      linhaDeNegocio: "demanda",
      tipo: "mrr",
      precoCatalogo: 1000,
      valor: 900,
      ordem: 1,
      contratoId: null,
    },
    {
      id: "i2",
      produtoId: "sis",
      nome: "Sistema sob medida",
      descricao: null,
      frente: "sistemas",
      frentesDoCombo: null,
      linhaDeNegocio: "sistemas",
      tipo: "tcv",
      precoCatalogo: 5000,
      valor: 4500,
      ordem: 2,
      contratoId: null,
    },
  ],
};

let imprimir: ReturnType<typeof vi.fn>;

beforeEach(() => {
  consulta = { data: DADOS, isError: false, error: null };
  imprimir = vi.fn();
  Object.defineProperty(window, "print", { value: imprimir, configurable: true, writable: true });
});

describe("documento", () => {
  it("cabeçalho, cliente, condições e escopo", () => {
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByText("Nº 0007 v1")).toBeInTheDocument();
    expect(screen.getByText("04/10/2026")).toBeInTheDocument();
    expect(screen.getByText("19/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("ana@exemplo.invalido")).toBeInTheDocument();
    expect(screen.getByText("Gestão de tráfego e sistema de agendamento.")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Next Business" })).toHaveAttribute(
      "src",
      "/logo-fundo-claro.png",
    );
    expect(screen.getByText(DICA_DE_IMPRESSAO)).toHaveClass("print:hidden");
  });

  it("duas tabelas com o total de cada uma, valores em tabular-nums", () => {
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByRole("heading", { name: "Mensal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projeto" })).toBeInTheDocument();
    expect(screen.getByText("Total por mês")).toBeInTheDocument();
    expect(screen.getByText("Total do projeto")).toBeInTheDocument();
    for (const celula of [
      ...screen.getAllByText(reais(900)),
      ...screen.getAllByText(reais(4500)),
    ]) {
      expect(celula).toHaveClass("tabular-nums");
    }
    expect(screen.getByText("Fidelidade de 12 meses.")).toBeInTheDocument();
    expect(screen.getByText("Pagamento em 3 parcelas.")).toBeInTheDocument();
    expect(
      screen.getByText("Prazo de entrega: 30 dias corridos a partir do início do contrato."),
    ).toBeInTheDocument();
  });

  it("o título da aba é o nome sugerido do PDF, e volta ao sair da página", () => {
    document.title = "Next CRM";
    const { unmount } = render(<ImpressaoDaProposta propostaId="p1" />);
    expect(document.title).toBe("Proposta Nº 0007 v1");
    unmount();
    expect(document.title).toBe("Next CRM");
  });

  it("um h1 no documento e todo cabeçalho de coluna com scope", () => {
    const { container } = render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Proposta comercial" }),
    ).toBeInTheDocument();
    const cabecalhos = container.querySelectorAll("th");
    expect(cabecalhos.length).toBeGreaterThan(0);
    for (const th of cabecalhos) expect(th).toHaveAttribute("scope", "col");
  });

  it("o total é a última linha do corpo da tabela: `tfoot` o navegador repete em cada folha", () => {
    const { container } = render(<ImpressaoDaProposta propostaId="p1" />);
    expect(container.querySelector("tfoot")).toBeNull();
    const [mensal, projeto] = container.querySelectorAll("table");
    expect(mensal?.querySelector("tbody tr:last-child")?.textContent).toBe(
      `Total por mês${brl(900)}`,
    );
    expect(projeto?.querySelector("tbody tr:last-child")?.textContent).toBe(
      `Total do projeto${brl(4500)}`,
    );
  });

  it("critérios 3 e 4: sem total geral, sem preço de catálogo, sem desconto", () => {
    const { container } = render(<ImpressaoDaProposta propostaId="p1" />);
    const texto = container.textContent ?? "";
    expect(texto).toContain(brl(900));
    expect(texto).not.toMatch(/total geral/i);
    expect(texto).not.toMatch(/desconto/i);
    expect(texto).not.toContain(brl(5400));
    expect(texto).not.toContain(brl(1000));
    expect(texto).not.toContain(brl(5000));
  });

  it("só item mensal: a tabela de projeto e as linhas dela não aparecem", () => {
    consulta = {
      ...consulta,
      data: {
        ...DADOS,
        proposta: { ...DADOS.proposta, totalProjeto: 0 },
        itens: [DADOS.itens[0]!],
      },
    };
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByRole("heading", { name: "Mensal" })).toBeInTheDocument();
    expect(screen.getByText("Total por mês")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Projeto" })).not.toBeInTheDocument();
    expect(screen.queryByText("Total do projeto")).not.toBeInTheDocument();
    expect(screen.queryByText(/parcelas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prazo de entrega/)).not.toBeInTheDocument();
  });

  it("só item de projeto: a tabela mensal e a fidelidade não aparecem", () => {
    consulta = {
      ...consulta,
      data: {
        ...DADOS,
        proposta: { ...DADOS.proposta, totalMensal: 0 },
        itens: [DADOS.itens[1]!],
      },
    };
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByRole("heading", { name: "Projeto" })).toBeInTheDocument();
    expect(screen.getByText("Total do projeto")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mensal" })).not.toBeInTheDocument();
    expect(screen.queryByText("Total por mês")).not.toBeInTheDocument();
    expect(screen.queryByText(/Fidelidade/)).not.toBeInTheDocument();
  });

  it("emissão é o dia civil de São Paulo do envio, não o dia UTC nem o de hoje", () => {
    consulta = {
      ...consulta,
      data: { ...DADOS, proposta: { ...DADOS.proposta, enviadaEm: "2026-09-02T01:30:00Z" } },
    };
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByText("01/09/2026")).toBeInTheDocument();
    expect(screen.queryByText("02/09/2026")).not.toBeInTheDocument();
  });

  it("rascunho sem envio sai com o dia civil de hoje em São Paulo", () => {
    consulta = {
      ...consulta,
      data: { ...DADOS, proposta: { ...DADOS.proposta, status: "rascunho", enviadaEm: null } },
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-12-25T02:00:00Z"));
      render(<ImpressaoDaProposta propostaId="p1" />);
      expect(screen.getByText("24/12/2026")).toBeInTheDocument();
      expect(screen.queryByText("25/12/2026")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("singular: 1 mês, 1 parcela, 1 dia corrido", () => {
    consulta = {
      ...consulta,
      data: {
        ...DADOS,
        proposta: {
          ...DADOS.proposta,
          fidelidadeMeses: 1,
          parcelasProjeto: 1,
          prazoEntregaDias: 1,
        },
      },
    };
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByText("Fidelidade de 1 mês.")).toBeInTheDocument();
    expect(screen.getByText("Pagamento em 1 parcela.")).toBeInTheDocument();
    expect(
      screen.getByText("Prazo de entrega: 1 dia corrido a partir do início do contrato."),
    ).toBeInTheDocument();
  });

  it("quebra de folha: a linha da tabela e o título se protegem, a seção não", () => {
    const { container } = render(<ImpressaoDaProposta propostaId="p1" />);
    for (const secao of container.querySelectorAll("section")) {
      expect(secao).not.toHaveClass("break-inside-avoid");
    }
    expect(container.querySelectorAll("section h2").length).toBeGreaterThan(0);
    for (const titulo of container.querySelectorAll("section h2")) {
      expect(titulo).toHaveClass("break-after-avoid");
    }
    expect(container.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
    for (const linha of container.querySelectorAll("tr")) {
      expect(linha).toHaveClass("break-inside-avoid");
    }
  });
});

describe("window.print", () => {
  it("só depois do logo carregar, e uma vez", () => {
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(imprimir).not.toHaveBeenCalled();
    const logo = screen.getByRole("img", { name: "Next Business" });
    fireEvent.load(logo);
    fireEvent.load(logo);
    expect(imprimir).toHaveBeenCalledTimes(1);
  });

  it("logo que falha ainda imprime (o documento vale sem ele)", () => {
    render(<ImpressaoDaProposta propostaId="p1" />);
    fireEvent.error(screen.getByRole("img", { name: "Next Business" }));
    expect(imprimir).toHaveBeenCalledTimes(1);
  });

  it("carregando: nada de documento nem de impressão", () => {
    consulta = { data: undefined, isError: false, error: null };
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByText("Carregando a proposta…")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(imprimir).not.toHaveBeenCalled();
  });

  it("erro de leitura diz que não leu", () => {
    consulta = { data: undefined, isError: true, error: new Error("Proposta não encontrada.") };
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByText(/Não foi possível ler a proposta/)).toBeInTheDocument();
    expect(screen.getByText(/Proposta não encontrada\./)).toBeInTheDocument();
  });

  it("refetch que falha com o dado já lido: o documento fica, o aviso não o cobre", () => {
    consulta = { data: DADOS, isError: true, error: new Error("falha de rede") };
    render(<ImpressaoDaProposta propostaId="p1" />);
    expect(screen.getByText("Nº 0007 v1")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Next Business" })).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível ler a proposta/)).not.toBeInTheDocument();
  });
});

describe("guarda de texto do layout de impressão", () => {
  it("A4 sem margem do navegador só na página da proposta, e o menu fora do papel", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/@page\s+proposta\s*\{[^}]*size:\s*A4/);
    expect(css).toMatch(/@page\s+proposta\s*\{[^}]*margin:\s*0/);
    expect(css).not.toMatch(/@page\s*\{/);
    const fonte = readFileSync("src/modules/proposals/ui/impressao-da-proposta.tsx", "utf8");
    expect(fonte).toMatch(/<article[^>]*\[page:proposta\]/);
    const layout = readFileSync("src/routes/_authenticated.tsx", "utf8");
    expect(layout).toMatch(/className="contents print:hidden">\s*<SidebarNav/);
    expect(layout).toMatch(/print:h-auto/);
    expect(layout).toMatch(/print:overflow-visible/);
  });

  it("a margem de 16 mm se repete em toda folha, não só na primeira", () => {
    const fonte = readFileSync("src/modules/proposals/ui/impressao-da-proposta.tsx", "utf8");
    expect(fonte).toMatch(/<article[^>]*\bp-\[16mm\]/);
    expect(fonte).toMatch(/<article[^>]*\bbox-decoration-clone\b/);
  });
});
