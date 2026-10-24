import { Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { dataEHoraSP, formatDateTime, somaDias, todaySP } from "@/shared/lib/date";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { EventoDoPost, Opcao, PostDoQuadro } from "../api/content.repository";
import {
  type CamposDoPost,
  type CorrecaoDaPublicacao,
  ehLinkHttps,
  LIMITE_DA_LEGENDA,
  type RascunhoDaPublicacao,
  type RascunhoDoPost,
  tamanho,
  validarCorrecaoDaPublicacao,
  validarPost,
} from "../domain/formulario";
import {
  agendaEditavel,
  CANAIS,
  type CanalDoPost,
  conteudoEditavel,
  COR_DO_STATUS,
  FORMATOS,
  type FormatoDoPost,
  ROTULO_DO_CANAL,
  ROTULO_DO_FORMATO,
  ROTULO_DO_STATUS,
  type StatusDoPost,
  TRAVA_DE_CONTEUDO,
  TRAVA_DE_PUBLICADO,
} from "../domain/post";
import { destinosDe, rotuloDaAcao } from "../domain/transicoes";

const SELECT = "mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50";

export const FECHAMENTO_BARRADO =
  "Há alterações não salvas. Salve, ou feche pelo X para descartar.";
export const CORRECAO_BARRADA =
  "Há correção não gravada. Use Corrigir publicação, ou feche pelo X para descartar.";

const AUTOR_FORA_DA_LISTA: Record<EstadoDaConsulta, string> = {
  carregando: "…",
  erro: "-",
  pronto: "Alguém que saiu da equipe",
};

function rascunhoInicial(
  post: PostDoQuadro | null,
  padrao: { clienteId: string; responsavelId: string; agora: Date },
): RascunhoDoPost {
  if (post === null) {
    return {
      clienteId: padrao.clienteId,
      titulo: "",
      legenda: "",
      formato: "reel",
      canal: "instagram",
      linkDaArte: "",
      data: somaDias(todaySP(padrao.agora), 1),
      hora: "18:00",
      responsavelId: padrao.responsavelId,
    };
  }
  const { data, hora } = dataEHoraSP(post.agendadoPara);
  return {
    clienteId: post.clienteId,
    titulo: post.titulo,
    legenda: post.legenda ?? "",
    formato: post.formato,
    canal: post.canal,
    linkDaArte: post.linkDaArte ?? "",
    data,
    hora,
    responsavelId: post.responsavelId,
  };
}

function rascunhoDaPublicacao(post: PostDoQuadro | null): RascunhoDaPublicacao {
  if (post === null || post.publicadoEm === null) return { link: "", data: "", hora: "" };
  const { data, hora } = dataEHoraSP(post.publicadoEm);
  return { link: post.linkPublicado ?? "", data, hora };
}

function comAtual(opcoes: readonly Opcao[], atual: Opcao | null): readonly Opcao[] {
  return atual === null || opcoes.some((o) => o.id === atual.id) ? opcoes : [atual, ...opcoes];
}

function Erro({ texto }: { readonly texto: string | undefined }) {
  if (texto === undefined) return null;
  return (
    <p role="alert" className="mt-1 text-[11px] text-destructive">
      {texto}
    </p>
  );
}

export function DialogoDoPost({
  post,
  clientes,
  responsaveis,
  eventos,
  estadoDosEventos,
  estadoDosResponsaveis,
  clienteInicial,
  meuId,
  podeApagar,
  agora,
  salvando,
  apagando,
  corrigindo = false,
  onFechar,
  onSalvar,
  onMover,
  onApagar,
  onCorrigirPublicacao,
}: {
  readonly post: PostDoQuadro | null;
  readonly clientes: readonly Opcao[];
  readonly responsaveis: readonly Opcao[];
  readonly eventos: readonly EventoDoPost[];
  readonly estadoDosEventos: EstadoDaConsulta;
  readonly estadoDosResponsaveis: EstadoDaConsulta;
  readonly clienteInicial: string | null;
  readonly meuId: string | null;
  readonly podeApagar: boolean;
  readonly agora: Date;
  readonly salvando: boolean;
  readonly apagando: boolean;
  readonly corrigindo?: boolean;
  readonly onFechar: () => void;
  readonly onSalvar: (campos: CamposDoPost) => void;
  readonly onMover: (para: StatusDoPost) => void;
  readonly onApagar: () => void;
  readonly onCorrigirPublicacao?: (correcao: CorrecaoDaPublicacao) => void;
}) {
  const [inicial] = useState(() =>
    rascunhoInicial(post, {
      clienteId: clienteInicial ?? "",
      responsavelId: meuId !== null && responsaveis.some((r) => r.id === meuId) ? meuId : "",
      agora,
    }),
  );
  const [rascunho, setRascunho] = useState(inicial);
  const [tentou, setTentou] = useState(false);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [barrados, setBarrados] = useState(0);
  const [publicacaoInicial] = useState(() => rascunhoDaPublicacao(post));
  const [publicacao, setPublicacao] = useState(publicacaoInicial);
  const [tentouCorrigir, setTentouCorrigir] = useState(false);

  const status: StatusDoPost = post?.status ?? "rascunho";
  const podeConteudo = conteudoEditavel(status);
  const podeAgenda = agendaEditavel(status);
  const resultado = validarPost(rascunho);
  const erros = tentou && !resultado.ok ? resultado.erros : {};
  const ocupado = salvando || apagando || corrigindo;
  const linkDaArte = rascunho.linkDaArte.trim();
  const etapas = post === null ? [] : destinosDe(status);
  const sujo = (Object.keys(rascunho) as (keyof RascunhoDoPost)[]).some(
    (campo) => rascunho[campo] !== inicial[campo],
  );
  const correcaoSuja = (Object.keys(publicacao) as (keyof RascunhoDaPublicacao)[]).some(
    (campo) => publicacao[campo] !== publicacaoInicial[campo],
  );
  const resultadoDaCorrecao = validarCorrecaoDaPublicacao(publicacao, agora);
  const podeCorrigirPublicacao = status === "publicado" && onCorrigirPublicacao !== undefined;

  const opcoesDeCliente = comAtual(
    clientes,
    post === null ? null : { id: post.clienteId, nome: post.clienteNome },
  );
  const opcoesDeResponsavel = comAtual(
    responsaveis,
    post === null ? null : { id: post.responsavelId, nome: post.responsavelNome },
  );
  const nomeDe = (id: string) =>
    responsaveis.find((r) => r.id === id)?.nome ?? AUTOR_FORA_DA_LISTA[estadoDosResponsaveis];

  function muda<K extends keyof RascunhoDoPost>(campo: K, valor: RascunhoDoPost[K]) {
    setRascunho((r) => ({ ...r, [campo]: valor }));
    setBarrados(0);
  }

  function mudaPublicacao(campo: keyof RascunhoDaPublicacao, valor: string) {
    setPublicacao((p) => ({ ...p, [campo]: valor }));
    setBarrados(0);
  }

  function enviarCorrecao() {
    setTentouCorrigir(true);
    if (!resultadoDaCorrecao.ok) return;
    const { correcao } = resultadoDaCorrecao;
    const lido = post?.publicadoEm;
    const dataIntocada =
      publicacao.data === publicacaoInicial.data && publicacao.hora === publicacaoInicial.hora;
    onCorrigirPublicacao?.(
      dataIntocada && lido != null ? { ...correcao, publicadoEm: lido } : correcao,
    );
  }

  function barrarFechamento(e: Event) {
    e.preventDefault();
    if (!ocupado) setBarrados((n) => n + 1);
  }

  function salvar() {
    setTentou(true);
    if (resultado.ok) onSalvar(resultado.campos);
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !ocupado && onFechar()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onEscapeKeyDown={(e) => {
          if (sujo || correcaoSuja) barrarFechamento(e);
        }}
        onPointerDownOutside={(e) => {
          if (sujo || correcaoSuja) barrarFechamento(e);
        }}
      >
        <DialogHeader>
          <DialogTitle>{post === null ? "Novo post" : post.titulo}</DialogTitle>
        </DialogHeader>

        {(sujo || correcaoSuja) && barrados > 0 && (
          <p key={barrados} role="alert" className="text-xs text-muted-foreground">
            {sujo ? FECHAMENTO_BARRADO : CORRECAO_BARRADA}
          </p>
        )}

        {post !== null && (
          <p className="text-xs">
            <span className={cn("rounded px-1.5 py-0.5", COR_DO_STATUS[status])}>
              {ROTULO_DO_STATUS[status]}
            </span>
          </p>
        )}
        {status === "publicado" ? (
          <p className="text-xs text-muted-foreground">{TRAVA_DE_PUBLICADO}</p>
        ) : (
          !podeConteudo && <p className="text-xs text-muted-foreground">{TRAVA_DE_CONTEUDO}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="post-cliente">Cliente</Label>
            <select
              id="post-cliente"
              className={SELECT}
              value={rascunho.clienteId}
              disabled={!podeConteudo}
              onChange={(e) => muda("clienteId", e.target.value)}
            >
              <option value="">Escolha…</option>
              {opcoesDeCliente.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <Erro texto={erros.clienteId} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="post-titulo">Título</Label>
            <Input
              id="post-titulo"
              className="mt-1"
              value={rascunho.titulo}
              disabled={!podeConteudo}
              onChange={(e) => muda("titulo", e.target.value)}
            />
            <Erro texto={erros.titulo} />
          </div>

          <div>
            <Label htmlFor="post-formato">Formato</Label>
            <select
              id="post-formato"
              className={SELECT}
              value={rascunho.formato}
              disabled={!podeConteudo}
              onChange={(e) => muda("formato", e.target.value as FormatoDoPost)}
            >
              {FORMATOS.map((f) => (
                <option key={f} value={f}>
                  {ROTULO_DO_FORMATO[f]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="post-canal">Canal</Label>
            <select
              id="post-canal"
              className={SELECT}
              value={rascunho.canal}
              disabled={!podeConteudo}
              onChange={(e) => muda("canal", e.target.value as CanalDoPost)}
            >
              {CANAIS.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_DO_CANAL[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="post-arte">Link da arte</Label>
            <Input
              id="post-arte"
              className="mt-1"
              inputMode="url"
              placeholder="https://"
              value={rascunho.linkDaArte}
              disabled={!podeConteudo}
              onChange={(e) => muda("linkDaArte", e.target.value)}
            />
            <Erro texto={erros.linkDaArte} />
            {ehLinkHttps(linkDaArte) && (
              <a
                href={linkDaArte}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-primary-texto underline"
              >
                Abrir arte
              </a>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="post-legenda">Legenda</Label>
            <Textarea
              id="post-legenda"
              className="mt-1 min-h-24"
              value={rascunho.legenda}
              disabled={!podeConteudo}
              onChange={(e) => muda("legenda", e.target.value)}
            />
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
              {tamanho(rascunho.legenda.trim())}/{LIMITE_DA_LEGENDA}
            </p>
            <Erro texto={erros.legenda} />
          </div>

          <div>
            <Label htmlFor="post-data">Data</Label>
            <Input
              id="post-data"
              type="date"
              className="mt-1"
              value={rascunho.data}
              disabled={!podeAgenda}
              onChange={(e) => muda("data", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="post-hora">Hora</Label>
            <Input
              id="post-hora"
              type="time"
              className="mt-1"
              value={rascunho.hora}
              disabled={!podeAgenda}
              onChange={(e) => muda("hora", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Erro texto={erros.data} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="post-responsavel">Responsável</Label>
            <select
              id="post-responsavel"
              className={SELECT}
              value={rascunho.responsavelId}
              disabled={!podeAgenda}
              onChange={(e) => muda("responsavelId", e.target.value)}
            >
              <option value="">Escolha…</option>
              {opcoesDeResponsavel.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
            <Erro texto={erros.responsavelId} />
          </div>
        </div>

        {post?.linkPublicado != null && (
          <a
            href={post.linkPublicado}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary-texto underline"
          >
            Ver post publicado
          </a>
        )}

        {podeCorrigirPublicacao && (
          <section
            aria-label="Corrigir publicação"
            className="grid gap-3 border-t pt-3 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <Label htmlFor="post-link-publicado">Link publicado</Label>
              <Input
                id="post-link-publicado"
                className="mt-1"
                inputMode="url"
                placeholder="https://"
                value={publicacao.link}
                disabled={ocupado}
                onChange={(e) => mudaPublicacao("link", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="post-data-publicacao">Data da publicação</Label>
              <Input
                id="post-data-publicacao"
                type="date"
                className="mt-1"
                value={publicacao.data}
                disabled={ocupado}
                onChange={(e) => mudaPublicacao("data", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="post-hora-publicacao">Hora da publicação</Label>
              <Input
                id="post-hora-publicacao"
                type="time"
                className="mt-1"
                value={publicacao.hora}
                disabled={ocupado}
                onChange={(e) => mudaPublicacao("hora", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!correcaoSuja || ocupado}
                onClick={enviarCorrecao}
              >
                {corrigindo ? "Corrigindo…" : "Corrigir publicação"}
              </Button>
              <Erro
                texto={
                  tentouCorrigir && !resultadoDaCorrecao.ok ? resultadoDaCorrecao.erro : undefined
                }
              />
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {etapas.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-2">
                {etapas.map((para) => (
                  <Button
                    key={para}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ocupado || sujo}
                    onClick={() => onMover(para)}
                  >
                    {rotuloDaAcao(status, para)}
                  </Button>
                ))}
              </div>
              {sujo && (
                <p className="text-xs text-muted-foreground">
                  Salve as alterações antes de mudar a etapa.
                </p>
              )}
            </div>
          )}
          <span className="ml-auto flex gap-2">
            {post !== null && podeApagar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={ocupado}
                onClick={() => setConfirmandoApagar(true)}
              >
                Apagar post
              </Button>
            )}
            {status !== "publicado" && (
              <Button type="button" size="sm" disabled={ocupado} onClick={salvar}>
                {salvando ? "Salvando…" : post === null ? "Criar post" : "Salvar"}
              </Button>
            )}
          </span>
        </div>

        {post !== null && (
          <section aria-label="Histórico" className="border-t pt-3">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Histórico</h3>
            {estadoDosEventos === "erro" ? (
              <FalhaAoLer
                oQue="o histórico do post"
                mensagem="Recarregue a página e tente de novo."
              />
            ) : estadoDosEventos === "carregando" ? (
              <p className="text-xs text-muted-foreground">Carregando…</p>
            ) : (
              <ol className="space-y-2">
                {eventos.map((e) => (
                  <li key={e.id} className="text-xs">
                    <p>
                      <span className="font-medium">{nomeDe(e.autorId)}</span>
                      {" · "}
                      {formatDateTime(e.criadoEm)}
                      {" · "}
                      {e.de === null
                        ? `Criou o post (${ROTULO_DO_STATUS[e.para]})`
                        : e.de === e.para
                          ? "Corrigiu a publicação"
                          : `${ROTULO_DO_STATUS[e.de]} → ${ROTULO_DO_STATUS[e.para]}`}
                    </p>
                    {e.nota !== null && (
                      <p className="whitespace-pre-wrap text-muted-foreground">{e.nota}</p>
                    )}
                    {e.tarefaId !== null && (
                      <Link to="/tasks" className="text-primary-texto underline">
                        Tarefa de ajuste criada
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </DialogContent>

      <AlertDialog open={confirmandoApagar} onOpenChange={setConfirmandoApagar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar post</AlertDialogTitle>
            <AlertDialogDescription>
              O post e o histórico dele saem para sempre. A tarefa de ajuste, se houver, continua no
              quadro de tarefas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onApagar}>Sim, apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
