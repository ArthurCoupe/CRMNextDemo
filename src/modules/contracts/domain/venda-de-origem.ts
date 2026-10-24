export interface VendaDeOrigem {
  readonly id: string;
  readonly nome: string;
}

export interface OrigemDeContrato {
  readonly vendaId: string;
  readonly vendaNome: string;
  readonly clienteId: string;
}

export function opcoesDeVenda(
  ganhas: readonly VendaDeOrigem[],
  origens: readonly OrigemDeContrato[],
  clienteId: string,
  atual: VendaDeOrigem | null = null,
): VendaDeOrigem[] {
  const porId = new Map<string, VendaDeOrigem>();
  if (atual !== null) porId.set(atual.id, atual);
  for (const ganha of ganhas) porId.set(ganha.id, ganha);
  for (const origem of origens) {
    if (origem.clienteId === clienteId) {
      porId.set(origem.vendaId, { id: origem.vendaId, nome: origem.vendaNome });
    }
  }
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function vendaQueFica(
  vendaId: string | null,
  opcoes: readonly VendaDeOrigem[],
): string | null {
  return vendaId !== null && opcoes.some((venda) => venda.id === vendaId) ? vendaId : null;
}
