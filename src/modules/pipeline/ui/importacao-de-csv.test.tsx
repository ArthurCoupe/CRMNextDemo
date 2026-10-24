import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { importarOportunidades, type ResultadoDaLinha } from "../api/pipeline.repository";
import { listarCampos, listarPipelines } from "../api/pipelines.repository";
import type { CampoDoPipeline } from "../domain/campos";
import { MODELO_CSV } from "../domain/importacao";
import type { Pipeline } from "../domain/pipeline";
import { ImportacaoDeCsv } from "./importacao-de-csv";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../api/pipelines.repository", () => ({
  arquivarPipeline: vi.fn(),
  criarPipeline: vi.fn(),
  listarCampos: vi.fn(),
  listarEstagios: vi.fn(),
  listarMotivos: vi.fn(),
  listarPipelines: vi.fn(),
  renomearPipeline: vi.fn(),
  salvarEstagios: vi.fn(),
  salvarMotivos: vi.fn(),
}));

vi.mock("../api/pipeline.repository", () => ({
  atualizarDadosDaOportunidade: vi.fn(),
  atualizarDatasDeReuniao: vi.fn(),
  atualizarNutricao: vi.fn(),
  carregarCatalogo: vi.fn(),
  corrigirMotivoDeSaida: vi.fn(),
  criarOportunidade: vi.fn(),
  importarOportunidades: vi.fn(),
  listarEventos: vi.fn(),
  listarOportunidades: vi.fn(),
  listarResponsaveis: vi.fn(),
  lerAtividadeSemanal: vi.fn(),
  lerFechamentosPorCampanha: vi.fn(),
  lerFunilPorCanal: vi.fn(),
  lerMixDeOportunidades: vi.fn(),
  lerPrimeiroContato: vi.fn(),
  lerTempoAtePrimeiroContato: vi.fn(),
  moverParaEstagio: vi.fn(),
  registrarToque: vi.fn(),
  responderPergunta: vi.fn(),
  vincularRef: vi.fn(),
}));

const PIPELINE = "10000000-0000-4000-8000-000000000001";
const PIPELINES: Pipeline[] = [{ id: PIPELINE, nome: "Comercial", ordem: 1, ativo: true }];

const CSV_VALIDO =
  "nome;telefone;email;canal;cidade\n" +
  "Padaria do Zé;11999990001;;indicacao;SP\n" +
  "Oficina Norte;;norte@oficina.com;pago;RJ\n" +
  "Clínica Sul;11999990003;;inbound;SP\n" +
  "Sem canal;11999990004;;fax;SP\n";

const PREVIA: ResultadoDaLinha[] = [
  { numero: 2, acao: "nova", motivo: null, oportunidadeId: null },
  { numero: 3, acao: "nova", motivo: null, oportunidadeId: null },
  {
    numero: 4,
    acao: "atualiza",
    motivo: "mesmo telefone ou e-mail de uma linha anterior do arquivo",
    oportunidadeId: null,
  },
  { numero: 5, acao: "erro", motivo: 'canal desconhecido: "fax"', oportunidadeId: null },
];

const RESULTADO: ResultadoDaLinha[] = [
  { numero: 2, acao: "nova", motivo: null, oportunidadeId: "opp-nova-2" },
  { numero: 3, acao: "nova", motivo: null, oportunidadeId: "opp-nova-3" },
  {
    numero: 4,
    acao: "atualiza",
    motivo: null,
    oportunidadeId: "opp-3",
    aviso: "campos ignorados: a oportunidade está em outro pipeline",
  },
  { numero: 5, acao: "erro", motivo: 'canal desconhecido: "fax"', oportunidadeId: null },
];

async function renderizar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const aoFechar = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <ImportacaoDeCsv aberto pipelineIdPadrao={PIPELINE} aoFechar={aoFechar} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText("Arquivo CSV")).toBeEnabled());
  return aoFechar;
}

function escolherArquivo(texto: string, nome = "lista.csv") {
  const arquivo = new File([texto], nome, { type: "text/csv" });
  fireEvent.change(screen.getByLabelText("Arquivo CSV"), { target: { files: [arquivo] } });
}

const TEM_SITE: CampoDoPipeline = {
  id: "c7000000-0000-4000-8000-000000000001",
  pipelineId: PIPELINE,
  nome: "Tem site?",
  tipo: "sim_nao",
  opcoes: null,
  obrigatorio: true,
  ordem: 1,
  ativo: true,
};
const NICHO: CampoDoPipeline = {
  ...TEM_SITE,
  id: "c7000000-0000-4000-8000-000000000002",
  nome: "Nicho de atuação",
  tipo: "lista",
  opcoes: ["Clínica", "Varejo", "Serviços"],
  obrigatorio: false,
  ordem: 2,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarPipelines).mockResolvedValue(PIPELINES);
  vi.mocked(listarCampos).mockResolvedValue([]);
});

describe("estado arquivo", () => {
  it("(a) arquivo sem coluna nome: mensagem no diálogo e NENHUMA chamada ao banco", async () => {
    await renderizar();
    escolherArquivo("telefone;email\n11999990001;a@b.com\n");

    expect(await screen.findByText("O arquivo não tem uma coluna de nome.")).toBeInTheDocument();
    expect(vi.mocked(importarOportunidades)).not.toHaveBeenCalled();
  });

  it("arquivo acima de 5 MB: mensagem no diálogo, sem ler nem chamar o banco", async () => {
    await renderizar();
    const arquivo = new File([CSV_VALIDO], "grande.csv", { type: "text/csv" });
    Object.defineProperty(arquivo, "size", { value: 5_000_001 });
    fireEvent.change(screen.getByLabelText("Arquivo CSV"), { target: { files: [arquivo] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Arquivo acima de 5 MB.");
    expect(vi.mocked(importarOportunidades)).not.toHaveBeenCalled();
  });

  it("(d) 'Baixar modelo' é um <a download> com o MODELO_CSV, sem requisição", async () => {
    await renderizar();
    const link = screen.getByRole("link", { name: /Baixar modelo/ });

    expect(link).toHaveAttribute("download", "modelo-de-importacao.csv");
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("data:text/csv;charset=utf-8,")).toBe(true);
    const conteudo = decodeURIComponent(href.slice(href.indexOf(",") + 1));
    expect(conteudo.startsWith("\uFEFF")).toBe(true);
    expect(conteudo).toContain(MODELO_CSV);
  });
});

describe("estado prévia", () => {
  it("(b) arquivo válido pede a prévia com pipeline, nome do arquivo e linhas — e mostra o que o banco classificou", async () => {
    vi.mocked(importarOportunidades).mockResolvedValue(PREVIA);
    await renderizar();
    escolherArquivo(CSV_VALIDO);

    await waitFor(() => expect(vi.mocked(importarOportunidades)).toHaveBeenCalledTimes(1));
    const [pipelineId, linhas, previa, arquivo] = vi.mocked(importarOportunidades).mock.calls[0]!;
    expect(pipelineId).toBe(PIPELINE);
    expect(previa).toBe(true);
    expect(arquivo).toBe("lista.csv");
    expect(linhas.map((linha) => linha.numero)).toEqual([2, 3, 4, 5]);
    expect(linhas[3]?.erros).toEqual(['canal desconhecido: "fax"']);

    expect(await screen.findByText("2 novas · 1 atualiza · 1 erro")).toBeInTheDocument();
    expect(screen.getByText(/ignoradas: cidade/)).toBeInTheDocument();
    const status = screen.getAllByTestId("acao").map((celula) => celula.textContent);
    expect(status).toEqual(["nova", "nova", "atualiza", "erro"]);
    expect(
      screen.getByText("mesmo telefone ou e-mail de uma linha anterior do arquivo"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar 3 linhas" })).toBeEnabled();
  });

  it("🔴 prévia grande: 200 linhas na tabela, TODAS as de erro entre elas, rodapé com as que faltam — e o botão conta o total", async () => {
    const total = 253;
    const comErro = new Set([3, 151, 254]);
    const previa: ResultadoDaLinha[] = Array.from({ length: total }, (_, i) => {
      const numero = i + 2;
      return comErro.has(numero)
        ? { numero, acao: "erro", motivo: "nome é obrigatório", oportunidadeId: null }
        : { numero, acao: "nova", motivo: null, oportunidadeId: null };
    });
    const csv = "nome\n" + Array.from({ length: total }, (_, i) => `Empresa ${i + 2}`).join("\n");
    vi.mocked(importarOportunidades).mockResolvedValue(previa);
    await renderizar();
    escolherArquivo(csv);

    expect(await screen.findByText("250 novas · 0 atualizam · 3 erros")).toBeInTheDocument();
    const status = screen.getAllByTestId("acao").map((celula) => celula.textContent);
    expect(status).toHaveLength(200);
    expect(status.filter((s) => s === "erro")).toHaveLength(3);
    const numeros = screen
      .getAllByRole("row")
      .slice(1)
      .map((linha) => Number(linha.querySelector("td")?.textContent));
    expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
    expect(numeros[0]).toBe(2);
    expect(numeros[numeros.length - 1]).toBe(254);
    expect(
      screen.getByText("… e mais 53 linhas sem erro (todas serão importadas)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar 250 linhas" })).toBeEnabled();
  });

  it("🔴 linha com AVISO além das 200 continua no resumo, como as de erro", async () => {
    const total = 251;
    const previa: ResultadoDaLinha[] = Array.from({ length: total }, (_, i) => {
      const numero = i + 2;
      return numero === 252
        ? {
            numero,
            acao: "atualiza",
            motivo: null,
            oportunidadeId: "opp-x",
            aviso: "campos ignorados: a oportunidade está em outro pipeline",
          }
        : { numero, acao: "nova", motivo: null, oportunidadeId: null };
    });
    vi.mocked(importarOportunidades).mockResolvedValue(previa);
    await renderizar();
    escolherArquivo(
      "nome\n" + Array.from({ length: total }, (_, i) => `Empresa ${i + 2}`).join("\n"),
    );

    expect(await screen.findByText("250 novas · 1 atualiza · 0 erros")).toBeInTheDocument();
    expect(screen.getAllByTestId("acao")).toHaveLength(200);
    expect(screen.getByTestId("aviso")).toHaveTextContent("campos ignorados");
    expect(
      screen.getByText("… e mais 51 linhas sem erro (todas serão importadas)"),
    ).toBeInTheDocument();
  });

  it("uma linha de fora: rodapé no singular", async () => {
    const total = 201;
    vi.mocked(importarOportunidades).mockResolvedValue(
      Array.from({ length: total }, (_, i) => ({
        numero: i + 2,
        acao: "nova",
        motivo: null,
        oportunidadeId: null,
      })),
    );
    await renderizar();
    escolherArquivo(
      "nome\n" + Array.from({ length: total }, (_, i) => `Empresa ${i + 2}`).join("\n"),
    );

    expect(
      await screen.findByText("… e mais 1 linha sem erro (todas serão importadas)"),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("acao")).toHaveLength(200);
  });

  it("prévia que cabe na tabela não tem rodapé — o positivo do caso acima", async () => {
    vi.mocked(importarOportunidades).mockResolvedValue(PREVIA);
    await renderizar();
    escolherArquivo(CSV_VALIDO);

    await screen.findByText("2 novas · 1 atualiza · 1 erro");
    expect(screen.queryByText(/e mais \d+ linhas sem erro/)).toBeNull();
  });

  it("prévia só com erros: 'Importar 0 linhas' fica desabilitado", async () => {
    vi.mocked(importarOportunidades).mockResolvedValue([
      { numero: 2, acao: "erro", motivo: "nome é obrigatório", oportunidadeId: null },
    ]);
    await renderizar();
    escolherArquivo("nome;telefone\n;11999990001\n");

    expect(await screen.findByRole("button", { name: "Importar 0 linhas" })).toBeDisabled();
  });
});

describe("campos personalizados na prévia (spec §2.3, Task 7)", () => {
  const CSV_COM_CAMPOS =
    "nome;telefone;tem site;nicho de atuação;cor favorita\n" +
    "Clínica Sul;11977770002;sim;clinica;azul\n" +
    "Loja Norte;11977770003;talvez;;verde\n" +
    "Vive no Comercial;11977770099;não;;\n";

  it("🔴 três listas: reconhecidas, campos do pipeline (coluna → campo) e ignoradas; campos vão na linha e o valor inválido é erro da linha", async () => {
    vi.mocked(listarCampos).mockResolvedValue([TEM_SITE, NICHO]);
    vi.mocked(importarOportunidades).mockResolvedValue([
      { numero: 2, acao: "nova", motivo: null, oportunidadeId: null },
      {
        numero: 3,
        acao: "erro",
        motivo: "coluna tem site: 'talvez' não é sim/não",
        oportunidadeId: null,
      },
      {
        numero: 4,
        acao: "atualiza",
        motivo: null,
        oportunidadeId: "opp-comercial",
        aviso: "campos ignorados: a oportunidade está em outro pipeline",
      },
    ]);
    await renderizar();
    escolherArquivo(CSV_COM_CAMPOS);

    await waitFor(() => expect(vi.mocked(importarOportunidades)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(listarCampos)).toHaveBeenCalledWith(PIPELINE, false);
    const linhas = vi.mocked(importarOportunidades).mock.calls[0]![1];
    expect(linhas[0]?.campos).toEqual({ [TEM_SITE.id]: true, [NICHO.id]: "Clínica" });
    expect(linhas[1]?.erros).toEqual(["coluna tem site: 'talvez' não é sim/não"]);
    expect(linhas[2]?.campos).toEqual({ [TEM_SITE.id]: false });

    await screen.findByText("1 nova · 1 atualiza · 1 erro");
    expect(screen.getByText(/colunas reconhecidas: nome, telefone/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /campos do pipeline Comercial: tem site → Tem site\?, nicho de atuação → Nicho de atuação/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/ignoradas: cor favorita/)).toBeInTheDocument();
    expect(screen.getByTestId("aviso")).toHaveTextContent(
      "campos ignorados: a oportunidade está em outro pipeline",
    );
    expect(screen.getByRole("combobox", { name: "Pipeline de destino das novas" })).toBeDisabled();
  });

  it("sem campos no pipeline a lista do meio não aparece — o positivo do caso acima", async () => {
    vi.mocked(importarOportunidades).mockResolvedValue(PREVIA);
    await renderizar();
    escolherArquivo(CSV_VALIDO);

    await screen.findByText("2 novas · 1 atualiza · 1 erro");
    expect(screen.queryByText(/campos do pipeline/)).toBeNull();
    expect(screen.queryByTestId("aviso")).toBeNull();
  });

  it("🔴 lista de campos que falha: o input fica travado e a falha aparece no diálogo — nunca importa sem os campos", async () => {
    vi.mocked(listarCampos).mockRejectedValue(
      Object.assign(new Error("Falha ao ler os campos."), { code: "42501" }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ImportacaoDeCsv aberto pipelineIdPadrao={PIPELINE} aoFechar={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao ler os campos.");
    expect(screen.getByLabelText("Arquivo CSV")).toBeDisabled();
  });
});

describe("erro da RPC e fechamento durante a mutação (fix round 1)", () => {
  it("RPC recusa a prévia: a mensagem aparece NO diálogo, não só no toast", async () => {
    vi.mocked(importarOportunidades).mockRejectedValue(
      new Error("Importar oportunidades é de owner e manager."),
    );
    await renderizar();
    escolherArquivo(CSV_VALIDO);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Importar oportunidades é de owner e manager.",
    );
    expect(screen.getByLabelText("Arquivo CSV")).toBeEnabled();
  });

  it("RPC recusa a gravação: a mensagem aparece na prévia e o botão volta", async () => {
    vi.mocked(importarOportunidades)
      .mockResolvedValueOnce(PREVIA)
      .mockRejectedValueOnce(new Error("Pipeline inexistente ou arquivado."));
    await renderizar();
    escolherArquivo(CSV_VALIDO);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Importar 3 linhas" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pipeline inexistente ou arquivado.",
    );
    expect(screen.getByRole("button", { name: "Importar 3 linhas" })).toBeEnabled();
  });

  it("🔴 com a RPC pendente, Cancelar fica desabilitado e Esc NÃO fecha; a resposta atrasada ainda chega", async () => {
    let resolver: (r: ResultadoDaLinha[]) => void = () => {};
    vi.mocked(importarOportunidades).mockImplementation(
      () => new Promise<ResultadoDaLinha[]>((res) => (resolver = res)),
    );
    const aoFechar = await renderizar();
    escolherArquivo(CSV_VALIDO);
    const user = userEvent.setup();

    await screen.findByText("Classificando as linhas…");
    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    expect(cancelar).toBeDisabled();
    await user.click(cancelar);
    await user.keyboard("{Escape}");
    expect(aoFechar).not.toHaveBeenCalled();
    expect(screen.getByText("Classificando as linhas…")).toBeInTheDocument();

    resolver(PREVIA);
    expect(await screen.findByText("2 novas · 1 atualiza · 1 erro")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});

describe("estado resultado", () => {
  it("(c) 'Importar 3 linhas' grava com previa=false e as MESMAS linhas; o resultado mostra contagem e as linhas com erro", async () => {
    vi.mocked(importarOportunidades).mockResolvedValueOnce(PREVIA).mockResolvedValueOnce(RESULTADO);
    const aoFechar = await renderizar();
    escolherArquivo(CSV_VALIDO);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Importar 3 linhas" }));

    await waitFor(() => expect(vi.mocked(importarOportunidades)).toHaveBeenCalledTimes(2));
    const [primeira, segunda] = vi.mocked(importarOportunidades).mock.calls;
    expect(segunda![2]).toBe(false);
    expect(segunda![0]).toBe(PIPELINE);
    expect(segunda![3]).toBe("lista.csv");
    expect(segunda![1]).toBe(primeira![1]);

    expect(await screen.findByText("2 novas · 1 atualizada · 1 erro")).toBeInTheDocument();
    expect(screen.getAllByTestId("acao").map((celula) => celula.textContent)).toEqual([
      "atualiza",
      "erro",
    ]);
    expect(screen.getByTestId("aviso")).toHaveTextContent("campos ignorados");
    expect(screen.getByText('canal desconhecido: "fax"')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
