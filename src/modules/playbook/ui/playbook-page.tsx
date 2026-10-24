import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { AreaDoPlaybook, SecaoDoPlaybook } from "../api/playbook.repository";
import { problemaNaSecao } from "../domain/secao";
import { useBuscaNoPlaybook, usePlaybook, useSalvarSecao } from "../hooks/use-playbook";

const AREAS: readonly { valor: AreaDoPlaybook; rotulo: string }[] = [
  { valor: "comercial", rotulo: "Comercial" },
  { valor: "marketing", rotulo: "Marketing" },
  { valor: "gestao", rotulo: "Gestão" },
];

const COMPONENTES_DO_MARKDOWN: Components = {
  h2: ({ children }) => <h2 className="mt-3 text-[15px] font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-background/60 px-1 py-px text-[0.9em]">{children}</code>
  ),
  table: ({ children }) => <table className="w-full border-collapse text-xs">{children}</table>,
  thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border/50">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1 align-top">{children}</td>,
};

export function PlaybookPage() {
  const { papel } = useProfile();
  const podeEditar = papel === "owner" || papel === "manager";

  const [area, setArea] = useState<AreaDoPlaybook>("comercial");
  const [termo, setTermo] = useState("");
  const buscando = termo.trim() !== "";

  const secoesDaArea = usePlaybook(area);
  const resultadoDaBusca = useBuscaNoPlaybook(termo);

  const consulta = buscando ? resultadoDaBusca : secoesDaArea;
  const estado = estadoDaConsulta(consulta);
  const secoes = consulta.data ?? [];

  return (
    <>
      <PageHeader title="Playbook" description="O método da casa: comercial, marketing e gestão" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {AREAS.map((a) => (
            <Button
              key={a.valor}
              size="sm"
              variant={!buscando && area === a.valor ? "default" : "outline"}
              onClick={() => setArea(a.valor)}
            >
              {a.rotulo}
            </Button>
          ))}
        </div>
        <Input
          type="search"
          aria-label="Buscar no playbook"
          placeholder="Buscar no playbook…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          className="h-8 max-w-xs text-xs"
        />
      </div>

      {estado === "erro" ? (
        <FalhaAoLer oQue="as seções do playbook" />
      ) : estado === "carregando" ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : secoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {buscando ? "Nenhuma seção encontrada." : "Nenhuma seção cadastrada nesta área ainda."}
        </p>
      ) : (
        <div className="grid gap-3">
          {secoes.map((secao) => (
            <SecaoCard key={secao.id} secao={secao} podeEditar={podeEditar} />
          ))}
        </div>
      )}
    </>
  );
}

interface RascunhoDaSecao {
  readonly title: string;
  readonly area: AreaDoPlaybook;
  readonly ordem: string;
  readonly content: string;
  readonly updatedAt: string;
}

function rascunhoDe(secao: SecaoDoPlaybook): RascunhoDaSecao {
  return {
    title: secao.title,
    area: secao.area,
    ordem: String(secao.sort_order),
    content: secao.content,
    updatedAt: secao.updated_at,
  };
}

function ordemDoTexto(texto: string): number {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : Number.NaN;
}

function SecaoCard({ secao, podeEditar }: { secao: SecaoDoPlaybook; podeEditar: boolean }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoDaSecao>(() => rascunhoDe(secao));
  const salvarSecao = useSalvarSecao();

  function abrirEdicao() {
    setRascunho(rascunhoDe(secao));
    setEditando(true);
  }

  function salvar() {
    const sortOrder = ordemDoTexto(rascunho.ordem);
    const problema = problemaNaSecao({ titulo: rascunho.title, ordem: sortOrder });
    if (problema !== null) {
      toast.error(problema);
      return;
    }
    salvarSecao.mutate(
      {
        id: secao.id,
        dados: {
          title: rascunho.title.trim(),
          area: rascunho.area,
          sortOrder,
          content: rascunho.content,
        },
        updatedAt: rascunho.updatedAt,
      },
      { onSuccess: () => setEditando(false) },
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{secao.title}</p>
        {podeEditar && !editando && (
          <Button size="sm" variant="ghost" onClick={abrirEdicao}>
            Editar
          </Button>
        )}
      </div>

      {editando ? (
        <fieldset
          disabled={salvarSecao.isPending}
          className="mt-3 grid min-w-0 gap-3 md:grid-cols-2"
        >
          <div className="grid gap-2 md:col-span-2 md:grid-cols-[1fr_10rem_6rem]">
            <Input
              aria-label="Título da seção"
              className="h-8 text-xs"
              value={rascunho.title}
              onChange={(e) => setRascunho((r) => ({ ...r, title: e.target.value }))}
            />
            <Select
              value={rascunho.area}
              disabled={salvarSecao.isPending}
              onValueChange={(v) => {
                const area = AREAS.find((a) => a.valor === v)?.valor;
                if (area !== undefined) setRascunho((r) => ({ ...r, area }));
              }}
            >
              <SelectTrigger className="h-8 text-xs" aria-label="Área da seção">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a.valor} value={a.valor}>
                    {a.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Ordem na área"
              inputMode="numeric"
              className="h-8 text-xs tabular-nums"
              value={rascunho.ordem}
              onChange={(e) => setRascunho((r) => ({ ...r, ordem: e.target.value }))}
            />
          </div>
          <Textarea
            aria-label="Conteúdo (markdown)"
            value={rascunho.content}
            onChange={(e) => setRascunho((r) => ({ ...r, content: e.target.value }))}
            className="min-h-[160px] font-mono text-xs"
          />
          <div className="min-h-[160px] space-y-1.5 rounded-md border p-3 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTES_DO_MARKDOWN}>
              {rascunho.content}
            </ReactMarkdown>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button size="sm" onClick={salvar} disabled={salvarSecao.isPending}>
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </fieldset>
      ) : (
        <div className="mt-2 space-y-1.5 text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTES_DO_MARKDOWN}>
            {secao.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
