import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PapelConfigurado } from "../api/onboarding.repository";
import { PapeisSettings } from "./papeis-settings";

const TIME_ATIVO = [
  { id: "user-1", nome: "Fulano" },
  { id: "user-2", nome: "Beltrana" },
];

const papeis: { data: readonly PapelConfigurado[]; isPending: boolean; isError: boolean } = {
  data: [],
  isPending: false,
  isError: false,
};
const time: {
  data: readonly { id: string; nome: string }[] | undefined;
  isPending: boolean;
  isError: boolean;
} = { data: TIME_ATIVO, isPending: false, isError: false };

const definirMutate = vi.fn();

vi.mock("../hooks/use-onboarding", () => ({
  usePapeis: () => papeis,
  usePapeisExigidosPeloMetodo: () => ({ data: ["AM"], isPending: false, isError: false }),
  useDefinirPapel: () => ({ mutate: definirMutate, isPending: false }),
}));
vi.mock("@/modules/tasks/hooks/use-tasks", () => ({ usePessoasDoTime: () => time }));

beforeEach(() => {
  vi.clearAllMocks();
  time.data = TIME_ATIVO;
  time.isPending = false;
  time.isError = false;
});

function campo(): HTMLSelectElement {
  return screen.getByRole("combobox") as HTMLSelectElement;
}

describe("PapeisSettings — a pessoa desativada não pode virar 'Sem pessoa'", () => {
  it("com a pessoa FORA da lista de ativos, o campo continua mostrando quem responde", () => {
    papeis.data = [{ papel: "AM", pessoaId: "user-9", pessoa: "Sicrana", pessoaInativa: true }];
    render(<PapeisSettings />);

    expect(campo().value).toBe("user-9");
    expect(campo().options[campo().selectedIndex]?.text).toBe("Sicrana (desativada)");
  });

  it("e essa opção é `disabled` — ela existe para não sumir, não para ser escolhida de novo", () => {
    papeis.data = [{ papel: "AM", pessoaId: "user-9", pessoa: "Sicrana", pessoaInativa: true }];
    render(<PapeisSettings />);

    expect(screen.getByRole("option", { name: "Sicrana (desativada)" })).toBeDisabled();
  });

  it("com a pessoa ATIVA, nada de extra é acrescentado", () => {
    papeis.data = [{ papel: "AM", pessoaId: "user-1", pessoa: "Fulano", pessoaInativa: false }];
    render(<PapeisSettings />);

    expect(campo().value).toBe("user-1");
    expect(screen.getAllByRole("option", { name: /Fulano/ })).toHaveLength(1);
    expect(screen.queryByText(/\(desativada\)/)).not.toBeInTheDocument();
  });

  it("sem pessoa nenhuma, o campo diz 'Sem pessoa' e é verdade", () => {
    papeis.data = [{ papel: "AM", pessoaId: null, pessoa: null, pessoaInativa: false }];
    render(<PapeisSettings />);

    expect(campo().value).toBe("");
    expect(screen.queryByText(/\(desativada\)/)).not.toBeInTheDocument();
  });
});

describe("PapeisSettings — pessoa desativada é alerta na linha, não só na option", () => {
  it("🔴 o texto da linha diz que está desativada e pede a troca", () => {
    papeis.data = [{ papel: "AM", pessoaId: "user-9", pessoa: "Sicrana", pessoaInativa: true }];
    render(<PapeisSettings />);

    expect(
      screen.getByText(/Sicrana \(desativada\): troque a pessoa; bloqueia a liberação de etapa/),
    ).toBeInTheDocument();
  });

  it("papel fora do método diz que está desativada, sem falar em bloqueio", () => {
    papeis.data = [{ papel: "Closer", pessoaId: "user-9", pessoa: "Sicrana", pessoaInativa: true }];
    render(<PapeisSettings />);

    expect(screen.getByText(/Sicrana \(desativada\): troque a pessoa/)).toBeInTheDocument();
    expect(screen.queryByText(/bloqueia/)).not.toBeInTheDocument();
  });

  it("pessoa ativa: a linha mostra só o nome", () => {
    papeis.data = [{ papel: "AM", pessoaId: "user-1", pessoa: "Fulano", pessoaInativa: false }];
    render(<PapeisSettings />);

    expect(screen.getByText("Fulano", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText(/troque a pessoa/)).not.toBeInTheDocument();
  });
});
