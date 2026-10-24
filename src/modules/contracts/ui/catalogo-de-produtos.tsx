import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/hooks/use-profile";
import { brl } from "@/shared/lib/format";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import { EmptyState } from "@/shared/ui/empty-state";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { ProdutoDoCatalogoCompleto } from "../api/products.repository";
import {
  useApagarProduto,
  useCatalogoDeProdutos,
  useDefinirSituacaoDoProduto,
} from "../hooks/use-products";
import { FormularioDeProduto } from "./formulario-de-produto";

export function CatalogoDeProdutos() {
  const { papel } = useProfile();
  const souOwner = papel === "owner";
  const catalogo = useCatalogoDeProdutos();
  const estado = estadoDaConsulta(catalogo);
  const definirSituacao = useDefinirSituacaoDoProduto();
  const apagar = useApagarProduto();
  const apagando = apagar.isPending ? apagar.variables : undefined;

  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<ProdutoDoCatalogoCompleto | null>(null);

  function abrirNovo() {
    setEmEdicao(null);
    setFormAberto(true);
  }

  function abrirEdicao(produto: ProdutoDoCatalogoCompleto) {
    setEmEdicao(produto);
    setFormAberto(true);
  }

  function alternarSituacao(produto: ProdutoDoCatalogoCompleto) {
    definirSituacao.mutate(
      { id: produto.id, ativo: !produto.ativo },
      {
        onError: (erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível mudar a situação."),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        description="O catálogo da Next · fonte única de preço"
        actions={
          souOwner ? (
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="mr-1 h-4 w-4" />
              Novo produto
            </Button>
          ) : undefined
        }
      />

      {estado !== "erro" && catalogo.data?.truncado === true && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          A leitura atingiu o teto. Há produtos do catálogo fora desta tabela. Nenhum produto foi
          apagado.
        </p>
      )}

      {estado === "erro" ? (
        <FalhaAoLer oQue="o catálogo de produtos" />
      ) : estado === "carregando" ? (
        <p className="text-sm text-muted-foreground">Carregando o catálogo…</p>
      ) : (catalogo.data?.produtos ?? []).length === 0 ? (
        <EmptyState title="Nenhum produto cadastrado" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Produto</th>
                <th className="px-4 py-2.5 font-semibold">Frente</th>
                <th className="px-4 py-2.5 font-semibold">BU</th>
                <th className="px-4 py-2.5 font-semibold">Tipo</th>
                <th className="px-4 py-2.5 text-right font-semibold">Preço</th>
                <th className="px-4 py-2.5 font-semibold">Situação</th>
                {souOwner && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {(catalogo.data?.produtos ?? []).map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{p.nome}</span>
                    {p.descricao !== null && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {p.descricao}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.frente}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {p.linhaDeNegocio === "demanda" ? "Demanda" : "Sistemas"}
                  </td>
                  <td className="px-4 py-2.5 uppercase text-muted-foreground">{p.tipo}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {brl(p.preco)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        p.ativo
                          ? "rounded-full border px-2 py-px text-[10.5px] text-emerald-400"
                          : "rounded-full border px-2 py-px text-[10.5px] text-muted-foreground"
                      }
                    >
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  {souOwner && (
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirEdicao(p)}
                          aria-label={`Editar ${p.nome}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={definirSituacao.isPending}
                          onClick={() => alternarSituacao(p)}
                        >
                          {p.ativo ? "Desativar" : "Reativar"}
                        </Button>
                        <DialogoDeExclusao
                          gatilho={
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={apagando === p.id}
                              aria-label={`Apagar ${p.nome}`}
                            >
                              {apagando === p.id ? "Apagando…" : "Apagar"}
                            </Button>
                          }
                          titulo={`Apagar "${p.nome}"?`}
                          pendente={apagando === p.id}
                          onConfirmar={() => apagar.mutate(p.id)}
                        >
                          <p>O produto sai do catálogo.</p>
                          <p>Produto já usado em contrato não se apaga: para ele, use Desativar.</p>
                          <p>
                            Propostas que citavam este produto mantêm o nome e o preço que copiaram
                            dele.
                          </p>
                          <p>Isto não pode ser desfeito.</p>
                        </DialogoDeExclusao>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {souOwner && (
        <FormularioDeProduto
          aberto={formAberto}
          produto={emEdicao}
          aoFechar={() => {
            setFormAberto(false);
            setEmEdicao(null);
          }}
        />
      )}
    </>
  );
}
