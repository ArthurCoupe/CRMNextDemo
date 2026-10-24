import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { OportunidadeListada } from "@/modules/pipeline/api/pipeline.repository";
import { brl } from "@/shared/lib/format";

import type { PropostaListada } from "../api/proposals.repository";

let papel: "owner" | "manager" | "member" | "client" | null;
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ papel, perfil: null, meuId: "u1" }),
}));

let ligacoesEmVoo: number;
let filtrosDoIsMutating: unknown;
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useIsMutating: (filtros: unknown) => {
    filtrosDoIsMutating = filtros;
    return ligacoesEmVoo;
  },
}));

let propostas: {
  data: PropostaListada[] | undefined;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
};
let visiveis: { data: boolean | undefined };
let quantosItens: number;
let itensComErro: boolean;
function mutacao() {
  return { mutate: vi.fn(), isPending: false };
}
let criar = mutacao();
let enviar = mutacao();
let recusar = mutacao();
let novaVersao = mutacao();
let excluir = mutacao();
let registrar = mutacao();
let ligacoes: { pendentes: Record<string, string>; limpar: Mock };
vi.mock("../hooks/use-proposals", () => ({
  CHAVE_DA_LIGACAO: ["registrar-contrato-da-proposta"],
  usePropostas: () => propostas,
  usePodeVerPropostas: () => visiveis,
  useItensDaProposta: (id: string | null) =>
    itensComErro
      ? { data: undefined, isError: true, error: new Error("falhou"), isPending: false }
      : {
          data:
            id === null
              ? undefined
              : Array.from({ length: quantosItens }, (_, i) => ({ id: `i${i}` })),
          isError: false,
          isPending: false,
        },
  useCriarProposta: () => criar,
  useEnviarProposta: () => enviar,
  useRecusarProposta: () => recusar,
  useNovaVersao: () => novaVersao,
  useExcluirRascunho: () => excluir,
  useRegistrarContratoDaProposta: () => registrar,
  useLigacoesPendentes: () => ligacoes,
}));
vi.mock("./editor-de-proposta", () => ({ EditorDeProposta: () => <p>editor aberto</p> }));
const propsDoAceite = vi.fn();
vi.mock("./aceite-da-proposta", () => ({
  AceiteDaProposta: (props: unknown) => {
    propsDoAceite(props);
    return null;
  },
}));

document.addEventListener(
  "click",
  (evento) => {
    if (evento.target instanceof Element && evento.target.closest("a") !== null) {
      evento.preventDefault();
    }
  },
  { capture: true },
);

const { CHAVE_DA_LIGACAO } = await import("../hooks/use-proposals");
const { BlocoDePropostas } = await import("./bloco-de-propostas");

const reais = (valor: number) => brl(valor).replace(/\s/g, " ");

const OPORTUNIDADE = { id: "o1", nome: "Acme" } as unknown as OportunidadeListada;

const BASE: PropostaListada = {
  id: "p1",
  numero: 7,
  versao: 1,
  status: "rascunho",
  validaAte: "2026-10-19",
  escopo: null,
  prazoEntregaDias: null,
  formaPagamento: "pix",
  parcelasProjeto: null,
  fidelidadeMeses: null,
  enviadaEm: null,
  aceitaEm: null,
  recusadaEm: null,
  criadaEm: "2026-10-04T14:00:00Z",
  totalMensal: 900,
  totalProjeto: 4500,
  vencida: false,
  ultima: true,
  clienteId: null,
};
const ENVIADA: PropostaListada = { ...BASE, status: "enviada", enviadaEm: "2026-10-04T15:00:00Z" };

const AVISO_DO_EDITAR =
  "Cria uma nova versão com os mesmos itens. Enquanto ela existir, a enviada não pode ser aceita nem recusada.";
const PAINEL = "O contrato foi criado, mas a proposta não foi ligada a ele.";
const CONFIRMA_DISPENSA =
  "Dispensar o aviso? O contrato já criado continua no cliente. Aceitar de novo cria outro contrato.";

function abrir(lista: PropostaListada[], isFetching = false) {
  propostas = { data: lista, isError: false, error: null, isFetching };
  return render(<BlocoDePropostas oportunidade={OPORTUNIDADE} />);
}

function ultimasDoAceite() {
  return propsDoAceite.mock.calls[propsDoAceite.mock.calls.length - 1]?.[0] as {
    proposta: PropostaListada | null;
  };
}

function aceitar() {
  return screen.getByRole("button", { name: "Aceita: fechar negócio" });
}

beforeEach(() => {
  papel = "member";
  visiveis = { data: true };
  quantosItens = 1;
  itensComErro = false;
  criar = mutacao();
  enviar = mutacao();
  recusar = mutacao();
  novaVersao = mutacao();
  excluir = mutacao();
  registrar = mutacao();
  ligacoes = { pendentes: {}, limpar: vi.fn() };
  ligacoesEmVoo = 0;
  filtrosDoIsMutating = undefined;
  propsDoAceite.mockReset();
});

describe("lista", () => {
  it("critério 3: rótulo, status, validade e os dois totais, sem total geral", () => {
    const { container } = abrir([ENVIADA]);
    expect(screen.getByText("Nº 0007 v1")).toBeInTheDocument();
    expect(screen.getByText("Enviada")).toBeInTheDocument();
    expect(screen.getByText("Validade 19/10/2026")).toBeInTheDocument();
    expect(screen.getByText(`Mensal ${reais(900)}`)).toBeInTheDocument();
    expect(screen.getByText(`Projeto ${reais(4500)}`)).toBeInTheDocument();
    expect(container.textContent).toContain(brl(900));
    expect(container.textContent).not.toContain(brl(5400));
  });

  it("critério 8: vencida mostra 'venceu em dd/mm' e o owner ainda aceita", () => {
    papel = "owner";
    abrir([{ ...ENVIADA, validaAte: "2026-10-03", vencida: true }]);
    expect(screen.getByText("venceu em 03/10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceita: fechar negócio" })).toBeInTheDocument();
  });

  it("vazia diz que não há proposta; Nova proposta cria", () => {
    abrir([]);
    expect(screen.getByText("Nenhuma proposta nesta oportunidade.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nova proposta" }));
    expect(criar.mutate).toHaveBeenCalledWith({ oportunidadeId: "o1" }, expect.any(Object));
  });

  it("oportunidade fechada que a pessoa não vê: diz por quê, sem lista vazia nem 'Nova proposta'", () => {
    visiveis = { data: false };
    abrir([]);
    expect(
      screen.getByText(
        "Depois do fechamento, as propostas ficam visíveis só para o owner e para o manager dono do cliente.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma proposta nesta oportunidade.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova proposta" })).not.toBeInTheDocument();
  });

  it("controle ao lado: oportunidade que a pessoa vê, lista e 'Nova proposta' normais", () => {
    abrir([ENVIADA]);
    expect(screen.getByText("Nº 0007 v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova proposta" })).toBeInTheDocument();
    expect(screen.queryByText(/Depois do fechamento/)).not.toBeInTheDocument();
  });

  it("client não vê o bloco", () => {
    papel = "client";
    const { container } = abrir([ENVIADA]);
    expect(container).toBeEmptyDOMElement();
  });

  it("erro de leitura diz que não leu", () => {
    propostas = { data: undefined, isError: true, error: new Error("falhou"), isFetching: false };
    render(<BlocoDePropostas oportunidade={OPORTUNIDADE} />);
    expect(screen.getByText(/Não foi possível ler as propostas/)).toBeInTheDocument();
  });

  it("refetch que falha com dado na mão mantém a lista (controle: o teste acima)", () => {
    propostas = { data: [ENVIADA], isError: true, error: new Error("falhou"), isFetching: false };
    render(<BlocoDePropostas oportunidade={OPORTUNIDADE} />);
    expect(screen.getByText("Nº 0007 v1")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível ler as propostas/)).not.toBeInTheDocument();
  });

  it("clicar no rótulo abre o editor", () => {
    abrir([BASE]);
    fireEvent.click(screen.getByRole("button", { name: "Nº 0007 v1" }));
    expect(screen.getByText("editor aberto")).toBeInTheDocument();
  });
});

describe("ações por papel e status", () => {
  it("member com enviada: Baixar PDF, Recusada, Editar; sem aceitar", () => {
    abrir([ENVIADA]);
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
      "href",
      "/propostas/p1/imprimir",
    );
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "Recusada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aceita: fechar negócio" }),
    ).not.toBeInTheDocument();
  });

  it("versão antiga só baixa PDF", () => {
    papel = "owner";
    abrir([{ ...ENVIADA, ultima: false }]);
    expect(
      screen.queryByRole("button", { name: /^(Editar|Nova versão)$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aceita: fechar negócio" }),
    ).not.toBeInTheDocument();
  });

  it("Recusada e Editar chamam os hooks com proposta e oportunidade", () => {
    abrir([ENVIADA]);
    fireEvent.click(screen.getByRole("button", { name: "Recusada" }));
    expect(recusar.mutate).toHaveBeenCalledWith({ propostaId: "p1", oportunidadeId: "o1" });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(novaVersao.mutate).toHaveBeenCalledWith(
      { propostaId: "p1", oportunidadeId: "o1" },
      expect.any(Object),
    );
  });

  it("Review Focus 3: Editar desativado enquanto o pedido corre", () => {
    novaVersao = { ...mutacao(), isPending: true };
    abrir([ENVIADA]);
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
  });

  it("C4 (D-069): Editar diz que cria nova versão; a recusada continua com Nova versão", () => {
    abrir([ENVIADA]);
    const editar = screen.getByRole("button", { name: "Editar" });
    expect(editar).toHaveAttribute("title", AVISO_DO_EDITAR);
    expect(editar).toHaveAccessibleDescription(AVISO_DO_EDITAR);
    cleanup();
    abrir([{ ...ENVIADA, status: "recusada" }]);
    const novaVersaoDaRecusada = screen.getByRole("button", { name: "Nova versão" });
    expect(novaVersaoDaRecusada).toBeInTheDocument();
    expect(novaVersaoDaRecusada).not.toHaveAttribute("title");
    expect(novaVersaoDaRecusada).not.toHaveAccessibleDescription();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("Excluir rascunho pede confirmação antes de apagar", () => {
    abrir([BASE]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir rascunho" }));
    expect(excluir.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sim, excluir" }));
    expect(excluir.mutate).toHaveBeenCalledWith({ propostaId: "p1", oportunidadeId: "o1" });
  });
});

describe("critério 16: 'Enviou a proposta ... ao cliente?'", () => {
  it("baixar PDF de rascunho pergunta; Sim envia", () => {
    abrir([BASE]);
    fireEvent.click(screen.getByRole("link", { name: "Baixar PDF" }));
    expect(screen.getByText("Enviou a proposta Nº 0007 v1 ao cliente?")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enviou a proposta Nº 0007 v1 ao cliente?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sim, enviei" }));
    expect(enviar.mutate).toHaveBeenCalledWith(
      { propostaId: "p1", oportunidadeId: "o1" },
      expect.any(Object),
    );
  });

  it("Não fecha a pergunta e não grava nada", () => {
    abrir([BASE]);
    fireEvent.click(screen.getByRole("link", { name: "Baixar PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "Não" }));
    expect(screen.queryByText(/Enviou a proposta/)).not.toBeInTheDocument();
    expect(enviar.mutate).not.toHaveBeenCalled();
  });

  it("baixar PDF de proposta já enviada não pergunta", () => {
    abrir([ENVIADA]);
    fireEvent.click(screen.getByRole("link", { name: "Baixar PDF" }));
    expect(screen.queryByText(/Enviou a proposta/)).not.toBeInTheDocument();
  });

  it("sem item, 'Sim, enviei' fica desativado e diz por quê", () => {
    quantosItens = 0;
    abrir([BASE]);
    fireEvent.click(screen.getByRole("link", { name: "Baixar PDF" }));
    expect(screen.getByRole("button", { name: "Sim, enviei" })).toBeDisabled();
    expect(screen.getByText("Adicione ao menos um item antes de enviar.")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível ler/)).not.toBeInTheDocument();
  });

  it("itens que não se leram: a pergunta diz que não leu, não só trava o 'Sim, enviei'", () => {
    itensComErro = true;
    abrir([BASE]);
    fireEvent.click(screen.getByRole("link", { name: "Baixar PDF" }));
    expect(screen.getByText(/Não foi possível ler os itens da proposta/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sim, enviei" })).toBeDisabled();
  });

  it("Review Focus 3: 'Sim, enviei' desativado enquanto o envio corre", () => {
    enviar = { ...mutacao(), isPending: true };
    abrir([BASE]);
    fireEvent.click(screen.getByRole("link", { name: "Baixar PDF" }));
    expect(screen.getByRole("button", { name: "Sim, enviei" })).toBeDisabled();
  });
});

describe("aceite", () => {
  it("critério 10: Aceita abre o aceite com a proposta", () => {
    papel = "owner";
    abrir([ENVIADA]);
    expect(ultimasDoAceite().proposta).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Aceita: fechar negócio" }));
    expect(ultimasDoAceite().proposta).toMatchObject({ id: "p1" });
  });
});

describe("Review Focus 5: contrato criado e proposta não ligada", () => {
  it("a pendência mostra o painel; 'Marcar proposta como aceita' repete com o mesmo contrato", () => {
    papel = "owner";
    ligacoes.pendentes = { p1: "k1" };
    abrir([ENVIADA]);
    expect(screen.getByText(PAINEL)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Marcar proposta como aceita" }));
    expect(registrar.mutate).toHaveBeenCalledWith({ propostaId: "p1", contratoId: "k1" });
  });

  it("Dispensar pede confirmação: o primeiro clique não limpa e 'Aceita' segue travado", () => {
    papel = "owner";
    ligacoes.pendentes = { p1: "k1" };
    abrir([ENVIADA]);
    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    expect(screen.getByText(CONFIRMA_DISPENSA)).toBeInTheDocument();
    expect(ligacoes.limpar).not.toHaveBeenCalled();
    expect(aceitar()).toBeDisabled();
  });

  it("'Sim, dispensar' limpa a pendência da proposta, sem nova ligação", () => {
    papel = "owner";
    ligacoes.pendentes = { p1: "k1" };
    abrir([ENVIADA]);
    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sim, dispensar" }));
    expect(ligacoes.limpar).toHaveBeenCalledWith("p1");
    expect(registrar.mutate).not.toHaveBeenCalled();
  });

  it("'Cancelar' volta ao painel sem limpar", () => {
    papel = "owner";
    ligacoes.pendentes = { p1: "k1" };
    abrir([ENVIADA]);
    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText(CONFIRMA_DISPENSA)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar proposta como aceita" })).toBeEnabled();
    expect(ligacoes.limpar).not.toHaveBeenCalled();
  });

  it("ligação em voo trava também 'Marcar proposta como aceita' e 'Dispensar'", () => {
    papel = "owner";
    ligacoes.pendentes = { p1: "k1" };
    ligacoesEmVoo = 1;
    abrir([ENVIADA]);
    expect(screen.getByRole("button", { name: "Marcar proposta como aceita" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dispensar" })).toBeDisabled();
  });

  it("com a pendência, 'Aceita: fechar negócio' trava (criar de novo duplicaria o contrato)", () => {
    papel = "owner";
    ligacoes.pendentes = { p1: "k1" };
    abrir([ENVIADA]);
    expect(aceitar()).toBeDisabled();
  });

  it("controle: sem pendência desta proposta, 'Aceita: fechar negócio' fica livre e sem painel", () => {
    papel = "owner";
    const primeira = abrir([ENVIADA]);
    expect(aceitar()).toBeEnabled();
    primeira.unmount();

    ligacoes.pendentes = { p9: "k9" };
    abrir([ENVIADA]);
    expect(aceitar()).toBeEnabled();
    expect(screen.queryByText(PAINEL)).not.toBeInTheDocument();
  });

  it("ligação em voo trava 'Aceita: fechar negócio'", () => {
    papel = "owner";
    ligacoesEmVoo = 1;
    abrir([ENVIADA]);
    expect(aceitar()).toBeDisabled();
    expect(filtrosDoIsMutating).toEqual({ mutationKey: CHAVE_DA_LIGACAO });
  });

  it("lista de propostas recarregando trava 'Aceita: fechar negócio' (a lista ainda diz 'enviada')", () => {
    papel = "owner";
    abrir([ENVIADA], true);
    expect(aceitar()).toBeDisabled();
  });
});
