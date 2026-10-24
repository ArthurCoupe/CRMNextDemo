import type { ItemDaProposta } from "./grupos";

export type Direcao = "subir" | "descer";

export interface MudancaDeOrdem {
  readonly id: string;
  readonly ordem: number;
}

export function moverItem(
  itens: readonly ItemDaProposta[],
  itemId: string,
  direcao: Direcao,
): MudancaDeOrdem[] {
  const item = itens.find((i) => i.id === itemId);
  if (item === undefined) return [];
  const doGrupo = itens.filter((i) => i.tipo === item.tipo);
  const noGrupo = doGrupo.indexOf(item);
  const vizinho = doGrupo[direcao === "subir" ? noGrupo - 1 : noGrupo + 1];
  if (vizinho === undefined) return [];
  const nova = itens.map((i) => (i === item ? vizinho : i === vizinho ? item : i));
  return nova
    .map((i, indice) => ({ id: i.id, ordem: indice + 1, antes: i.ordem }))
    .filter((m) => m.ordem !== m.antes)
    .map(({ id, ordem }) => ({ id, ordem }));
}
