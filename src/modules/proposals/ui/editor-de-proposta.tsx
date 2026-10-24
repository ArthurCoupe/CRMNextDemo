import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MeioDePagamento } from "@/modules/contracts/domain/contract";
import { useProdutosAtivos } from "@/modules/contracts/hooks/use-contracts";
import { interpretarValorEmReais } from "@/modules/financial/domain/expenses";
import { ehDataCivilPlausivel } from "@/shared/lib/date";
import { brl, pct } from "@/shared/lib/format";
import { inteiroPositivoOuNulo } from "@/shared/lib/inteiro-positivo";
import { CampoEditavel } from "@/shared/ui/campo-editavel";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { CamposDaProposta, PropostaListada } from "../api/proposals.repository";
import { NOME_DO_ITEM_EM_BRANCO, podeEditar, PROPOSTA_CONGELADA } from "../domain/ciclo";
import { desconto } from "../domain/desconto";
import { ROTULO_DA_FORMA_DE_PAGAMENTO, type ItemDaProposta } from "../domain/grupos";
import { moverItem, type Direcao } from "../domain/ordem";
import {
  useAdicionarItem,
  useEditarItem,
  useEditarProposta,
  useItensDaProposta,
  useRemoverItem,
  useReordenarItens,
} from "../hooks/use-proposals";

const VALOR_ILEGIVEL =
  "Valor não reconhecido. Use vírgula ou ponto para os centavos: 1.197,00 ou 1197.00.";
const INTEIRO_INVALIDO = "Use um número inteiro maior que zero.";

interface Props {
  readonly proposta: PropostaListada;
  readonly oportunidadeId: string;
}

export function EditorDeProposta({ proposta, oportunidadeId }: Props) {
  const editavel = podeEditar(proposta.status);
  const itens = useItensDaProposta(proposta.id);
  const catalogo = useProdutosAtivos();
  const editarProposta = useEditarProposta();
  const adicionarItem = useAdicionarItem();
  const reordenar = useReordenarItens();
  const alvo = { propostaId: proposta.id, oportunidadeId };

  if (itens.data === undefined && itens.isError) {
    const mensagem = itens.error instanceof Error ? itens.error.message : undefined;
    return <FalhaAoLer oQue="os itens da proposta" mensagem={mensagem} />;
  }
  const catalogoIlegivel = catalogo.data === undefined && catalogo.isError;
  const itensIncertos = itens.data === undefined || itens.isFetching;
  const lista = itens.data ?? [];
  const mensais = lista.filter((i) => i.tipo === "mrr");
  const projeto = lista.filter((i) => i.tipo === "tcv");
  const proximaOrdem = lista.reduce((maior, i) => Math.max(maior, i.ordem), 0) + 1;

  const ordemTravada = itensIncertos || reordenar.isPending;

  function mover(itemId: string, direcao: Direcao) {
    const mudancas = moverItem(lista, itemId, direcao);
    if (mudancas.length > 0) reordenar.mutate({ ...alvo, mudancas });
  }

  function gravar(campos: CamposDaProposta) {
    editarProposta.mutate({ ...alvo, campos });
  }

  function gravarInteiro(texto: string, montar: (n: number | null) => CamposDaProposta) {
    const n = inteiroPositivoOuNulo(texto);
    if (n === undefined) {
      toast.error(INTEIRO_INVALIDO);
      return;
    }
    gravar(montar(n));
  }

  return (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-2.5">
      {!editavel && (
        <p className="text-[11px] text-muted-foreground">
          {proposta.status === "aceita" ? "Proposta aceita." : PROPOSTA_CONGELADA}
        </p>
      )}

      {editavel && (
        <div className="grid gap-1">
          <Label htmlFor={`adicionar-${proposta.id}`} className="text-[11px] text-muted-foreground">
            Adicionar do catálogo
          </Label>
          <Select
            value=""
            onValueChange={(produtoId) =>
              adicionarItem.mutate({ ...alvo, produtoId, ordem: proximaOrdem })
            }
            disabled={adicionarItem.isPending || catalogoIlegivel || itensIncertos}
          >
            <SelectTrigger id={`adicionar-${proposta.id}`} className="h-8 text-xs">
              <SelectValue placeholder="Escolha um produto ativo" />
            </SelectTrigger>
            <SelectContent>
              {(catalogo.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} ({brl(p.preco)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {catalogoIlegivel && (
            <FalhaAoLer
              oQue="o catálogo de produtos"
              mensagem="Recarregue a página para adicionar itens."
            />
          )}
        </div>
      )}

      {lista.length === 0 && !itens.isPending && (
        <p className="text-xs text-muted-foreground">Nenhum item. Adicione do catálogo.</p>
      )}

      {mensais.length > 0 && (
        <GrupoDeItens titulo="Mensal" rotuloDoTotal="Total mensal" total={proposta.totalMensal}>
          {mensais.map((i, indice) => (
            <LinhaDoItem
              key={i.id}
              item={i}
              editavel={editavel}
              alvo={alvo}
              primeiro={indice === 0}
              ultimo={indice === mensais.length - 1}
              ordemTravada={ordemTravada}
              reordenando={reordenar.isPending}
              aoMover={mover}
            />
          ))}
        </GrupoDeItens>
      )}
      {projeto.length > 0 && (
        <GrupoDeItens
          titulo="Projeto"
          rotuloDoTotal="Total do projeto"
          total={proposta.totalProjeto}
        >
          {projeto.map((i, indice) => (
            <LinhaDoItem
              key={i.id}
              item={i}
              editavel={editavel}
              alvo={alvo}
              primeiro={indice === 0}
              ultimo={indice === projeto.length - 1}
              ordemTravada={ordemTravada}
              reordenando={reordenar.isPending}
              aoMover={mover}
            />
          ))}
        </GrupoDeItens>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <CampoEditavel
          id={`validade-${proposta.id}`}
          rotulo="Validade"
          type="date"
          valor={proposta.validaAte}
          disabled={!editavel}
          onGravar={(valor) => {
            if (!ehDataCivilPlausivel(valor)) {
              toast.error("Data inválida. Use um ano entre 2000 e 2100.");
              return;
            }
            gravar({ validaAte: valor });
          }}
        />
        <div className="grid gap-1">
          <Label htmlFor={`pagamento-${proposta.id}`} className="text-[11px] text-muted-foreground">
            Forma de pagamento
          </Label>
          <Select
            value={proposta.formaPagamento}
            onValueChange={(meio) => gravar({ formaPagamento: meio as MeioDePagamento })}
            disabled={!editavel}
          >
            <SelectTrigger id={`pagamento-${proposta.id}`} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROTULO_DA_FORMA_DE_PAGAMENTO) as MeioDePagamento[]).map((meio) => (
                <SelectItem key={meio} value={meio}>
                  {ROTULO_DA_FORMA_DE_PAGAMENTO[meio]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {mensais.length > 0 && (
          <CampoEditavel
            id={`fidelidade-${proposta.id}`}
            rotulo="Fidelidade (meses)"
            valor={proposta.fidelidadeMeses === null ? null : String(proposta.fidelidadeMeses)}
            disabled={!editavel}
            onGravar={(texto) => gravarInteiro(texto, (n) => ({ fidelidadeMeses: n }))}
          />
        )}
        {projeto.length > 0 && (
          <>
            <CampoEditavel
              id={`parcelas-${proposta.id}`}
              rotulo="Parcelas do projeto"
              valor={proposta.parcelasProjeto === null ? null : String(proposta.parcelasProjeto)}
              disabled={!editavel}
              onGravar={(texto) => gravarInteiro(texto, (n) => ({ parcelasProjeto: n }))}
            />
            <CampoEditavel
              id={`prazo-${proposta.id}`}
              rotulo="Prazo de entrega (dias)"
              valor={proposta.prazoEntregaDias === null ? null : String(proposta.prazoEntregaDias)}
              disabled={!editavel}
              onGravar={(texto) => gravarInteiro(texto, (n) => ({ prazoEntregaDias: n }))}
            />
          </>
        )}
      </div>

      <div className="grid gap-1">
        <Label htmlFor={`escopo-${proposta.id}`} className="text-[11px] text-muted-foreground">
          Escopo
        </Label>
        <Textarea
          key={proposta.escopo ?? ""}
          id={`escopo-${proposta.id}`}
          defaultValue={proposta.escopo ?? ""}
          maxLength={5000}
          disabled={!editavel}
          className="min-h-20 text-xs"
          onBlur={(evento) => {
            const texto = evento.target.value.trim();
            if (texto === (proposta.escopo ?? "")) return;
            gravar({ escopo: texto === "" ? null : texto });
          }}
        />
      </div>
    </div>
  );
}

function GrupoDeItens({
  titulo,
  rotuloDoTotal,
  total,
  children,
}: {
  readonly titulo: string;
  readonly rotuloDoTotal: string;
  readonly total: number;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid gap-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h4>
      <ul className="grid gap-1.5">{children}</ul>
      <p className="flex justify-between border-t pt-1 text-xs font-semibold">
        <span>{rotuloDoTotal}</span>
        <span className="tabular-nums">{brl(total)}</span>
      </p>
    </section>
  );
}

function LinhaDoItem({
  item,
  editavel,
  alvo,
  primeiro,
  ultimo,
  ordemTravada,
  reordenando,
  aoMover,
}: {
  readonly item: ItemDaProposta;
  readonly editavel: boolean;
  readonly alvo: { readonly propostaId: string; readonly oportunidadeId: string };
  readonly primeiro: boolean;
  readonly ultimo: boolean;
  readonly ordemTravada: boolean;
  readonly reordenando: boolean;
  readonly aoMover: (itemId: string, direcao: Direcao) => void;
}) {
  const editarItem = useEditarItem();
  const removerItem = useRemoverItem();
  const [ilegivel, setIlegivel] = useState(false);
  const idDoAviso = useId();
  const d = desconto(item.precoCatalogo, item.valor);

  return (
    <li className="grid gap-1 rounded-md border bg-background p-2 text-xs">
      <div className="flex items-center gap-2">
        {editavel ? (
          <Input
            key={`nome-${item.nome}`}
            aria-label={`Nome de ${item.nome}`}
            defaultValue={item.nome}
            maxLength={200}
            className="h-7 min-w-0 flex-1 text-xs font-medium"
            onBlur={(evento) => {
              const campo = evento.target;
              const nome = campo.value.trim();
              if (nome === item.nome) return;
              if (nome === "") {
                toast.error(NOME_DO_ITEM_EM_BRANCO);
                campo.value = item.nome;
                return;
              }
              editarItem.mutate(
                { ...alvo, itemId: item.id, campos: { nome } },
                {
                  onError: () => {
                    campo.value = item.nome;
                  },
                },
              );
            }}
          />
        ) : (
          <span className="font-medium">{item.nome}</span>
        )}
        <Input
          key={`valor-${item.valor}`}
          aria-label={`Valor de ${item.nome}`}
          aria-invalid={ilegivel}
          aria-describedby={ilegivel ? idDoAviso : undefined}
          inputMode="decimal"
          defaultValue={String(item.valor)}
          disabled={!editavel}
          className="ml-auto h-7 w-32 text-right text-xs tabular-nums"
          onChange={() => setIlegivel(false)}
          onBlur={(evento) => {
            const texto = evento.target.value;
            if (texto === String(item.valor)) return;
            const valor = interpretarValorEmReais(texto);
            if (valor === null) {
              setIlegivel(true);
              return;
            }
            if (valor !== item.valor)
              editarItem.mutate({ ...alvo, itemId: item.id, campos: { valor } });
          }}
        />
        {editavel && (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Subir ${item.nome}`}
              disabled={primeiro || ordemTravada}
              onClick={() => aoMover(item.id, "subir")}
            >
              Subir
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Descer ${item.nome}`}
              disabled={ultimo || ordemTravada}
              onClick={() => aoMover(item.id, "descer")}
            >
              Descer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Remover ${item.nome}`}
              disabled={removerItem.isPending || reordenando}
              onClick={() => removerItem.mutate({ ...alvo, itemId: item.id })}
            >
              Remover
            </Button>
          </>
        )}
      </div>
      {ilegivel && (
        <p id={idDoAviso} className="text-[11px] text-destructive">
          {VALOR_ILEGIVEL}
        </p>
      )}
      {d.reais !== 0 && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {d.reais > 0
            ? `Desconto ${brl(d.reais)}${d.fracao === null ? "" : ` (${pct(d.fracao)})`}`
            : `Acima do catálogo em ${brl(-d.reais)}`}
        </p>
      )}
      <CampoEditavel
        id={`descricao-${item.id}`}
        rotulo="Descrição"
        valor={item.descricao}
        maxLength={2000}
        disabled={!editavel}
        onGravar={(texto) =>
          editarItem.mutate({
            ...alvo,
            itemId: item.id,
            campos: { descricao: texto.trim() || null },
          })
        }
      />
    </li>
  );
}
