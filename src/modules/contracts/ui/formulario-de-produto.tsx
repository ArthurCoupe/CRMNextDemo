import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Money } from "@/shared/ui/money";
import { interpretarValorEmReais } from "@/modules/financial/domain/expenses";

import type { ProdutoDoCatalogoCompleto } from "../api/products.repository";
import {
  FRENTES_DE_SERVICO,
  frenteLabel,
  linhaDeNegocioDaFrente,
  linhaDeNegocioLabel,
  problemaNasFrentesDoCombo,
  type FrenteDeServico,
  type TipoDeContrato,
} from "../domain/contract";
import { useSalvarProduto } from "../hooks/use-products";

const FRENTES: readonly FrenteDeServico[] = FRENTES_DE_SERVICO;

interface Rascunho {
  nome: string;
  descricao: string;
  frente: FrenteDeServico;
  tipo: TipoDeContrato;
  preco: string;
  ordem: string;
  frentesDoCombo: FrenteDeServico[] | null;
}

function rascunhoDe(produto: ProdutoDoCatalogoCompleto | null): Rascunho {
  if (produto === null) {
    return {
      nome: "",
      descricao: "",
      frente: "posicionamento",
      tipo: "mrr",
      preco: "",
      ordem: "",
      frentesDoCombo: null,
    };
  }
  return {
    nome: produto.nome,
    descricao: produto.descricao ?? "",
    frente: produto.frente,
    tipo: produto.tipo,
    preco: String(produto.preco),
    ordem: String(produto.ordem),
    frentesDoCombo:
      produto.frentesDoCombo !== null && produto.frentesDoCombo.length > 0
        ? [...produto.frentesDoCombo]
        : null,
  };
}

export function FormularioDeProduto({
  aberto,
  produto,
  aoFechar,
}: {
  aberto: boolean;
  produto: ProdutoDoCatalogoCompleto | null;
  aoFechar: () => void;
}) {
  const salvar = useSalvarProduto();
  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoDe(produto));

  const chaveDeAbertura = aberto ? (produto?.id ?? "novo") : null;
  const [ultimaAbertura, setUltimaAbertura] = useState<string | null>(chaveDeAbertura);
  if (chaveDeAbertura !== ultimaAbertura) {
    setUltimaAbertura(chaveDeAbertura);
    setRascunho(rascunhoDe(produto));
  }

  const preco = interpretarValorEmReais(rascunho.preco);
  const linhaDeNegocio = linhaDeNegocioDaFrente(rascunho.frente);
  const ordemValida = produto === null || /^\d{1,6}$/.test(rascunho.ordem.trim());
  const problemaDoCombo =
    rascunho.frentesDoCombo === null
      ? null
      : problemaNasFrentesDoCombo(rascunho.frentesDoCombo, linhaDeNegocio);
  const ordemMudou = produto !== null && Number(rascunho.ordem.trim()) !== produto.ordem;
  const valido =
    rascunho.nome.trim() !== "" &&
    preco !== null &&
    preco > 0 &&
    ordemValida &&
    problemaDoCombo === null;

  function alternarFrente(frente: FrenteDeServico, marcada: boolean) {
    setRascunho((r) => {
      if (r.frentesDoCombo === null) return r;
      const conjunto = new Set(r.frentesDoCombo);
      if (marcada) conjunto.add(frente);
      else conjunto.delete(frente);
      return { ...r, frentesDoCombo: FRENTES.filter((f) => conjunto.has(f)) };
    });
  }

  function aoSalvar() {
    if (!valido || preco === null) return;
    salvar.mutate(
      {
        id: produto?.id ?? null,
        nome: rascunho.nome.trim(),
        descricao: rascunho.descricao.trim() || null,
        frente: rascunho.frente,
        linhaDeNegocio,
        tipo: rascunho.tipo,
        preco,
        ...(ordemMudou ? { ordem: Number(rascunho.ordem.trim()) } : {}),
        ...(rascunho.frentesDoCombo === null ? {} : { frentesDoCombo: rascunho.frentesDoCombo }),
      },
      {
        onSuccess: () => aoFechar(),
        onError: (erro) =>
          toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar o produto."),
      },
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{produto === null ? "Novo produto" : "Editar produto"}</DialogTitle>
          <DialogDescription>
            {produto === null
              ? "O preço cadastrado aqui é o que o formulário de contrato oferece."
              : "Contratos que já usaram este produto mantêm o preço com que foram fechados."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="produto-nome">Nome</Label>
            <Input
              id="produto-nome"
              value={rascunho.nome}
              onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="produto-descricao">Descrição (opcional)</Label>
            <Textarea
              id="produto-descricao"
              value={rascunho.descricao}
              onChange={(e) => setRascunho((r) => ({ ...r, descricao: e.target.value }))}
              className="min-h-16 text-xs"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="produto-frente">Frente</Label>
              <Select
                value={rascunho.frente}
                onValueChange={(v) => setRascunho((r) => ({ ...r, frente: v as FrenteDeServico }))}
              >
                <SelectTrigger id="produto-frente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRENTES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {frenteLabel(f)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="produto-bu">BU</Label>
              <Input id="produto-bu" disabled value={linhaDeNegocioLabel(linhaDeNegocio)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="produto-tipo">Tipo</Label>
              <Select
                value={rascunho.tipo}
                onValueChange={(v) => setRascunho((r) => ({ ...r, tipo: v as TipoDeContrato }))}
              >
                <SelectTrigger id="produto-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mrr">Mensalidade (MRR)</SelectItem>
                  <SelectItem value="tcv">Projeto (TCV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="produto-preco">Preço (R$)</Label>
              <Input
                id="produto-preco"
                inputMode="decimal"
                className="tabular-nums"
                value={rascunho.preco}
                onChange={(e) => setRascunho((r) => ({ ...r, preco: e.target.value }))}
                placeholder="24.637,00"
              />
              {rascunho.preco.trim() !== "" && preco === null && (
                <p className="text-[11px] text-destructive">
                  Valor não reconhecido. Use vírgula ou ponto para os centavos: 24.637,00 ou
                  24637.00.
                </p>
              )}
              {preco !== null && (
                <p className="text-[11px] text-muted-foreground">
                  Vai ser gravado como{" "}
                  <Money value={preco} className="font-semibold text-foreground" />.
                </p>
              )}
            </div>
          </div>

          {produto !== null && (
            <div className="grid gap-1">
              <Label htmlFor="produto-ordem">Ordem no catálogo</Label>
              <Input
                id="produto-ordem"
                inputMode="numeric"
                className="tabular-nums"
                value={rascunho.ordem}
                onChange={(e) => setRascunho((r) => ({ ...r, ordem: e.target.value }))}
              />
              {!ordemValida && (
                <p className="text-[11px] text-destructive">
                  Use um número inteiro, sem vírgula: 0, 1, 2 e assim por diante.
                </p>
              )}
            </div>
          )}

          {rascunho.frentesDoCombo !== null && (
            <fieldset className="grid gap-1.5">
              <legend className="text-sm font-medium">Frentes do combo</legend>
              <div className="flex flex-wrap gap-3">
                {FRENTES.map((f) => (
                  <div key={f} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`combo-${f}`}
                      checked={rascunho.frentesDoCombo?.includes(f) ?? false}
                      onCheckedChange={(marcada) => alternarFrente(f, marcada === true)}
                    />
                    <Label htmlFor={`combo-${f}`} className="text-xs">
                      {frenteLabel(f)}
                    </Label>
                  </div>
                ))}
              </div>
              {problemaDoCombo !== null && (
                <p className="text-[11px] text-destructive">{problemaDoCombo}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Contratos e propostas já criados mantêm as frentes com que foram feitos.
              </p>
            </fieldset>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={aoFechar} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={aoSalvar} disabled={!valido || salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
