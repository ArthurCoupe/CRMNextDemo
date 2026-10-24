import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAgora } from "@/hooks/use-agora";
import { useProfile } from "@/hooks/use-profile";
import { inicioDaSemanaSP, paraInstante, somaDias, todaySP } from "@/shared/lib/date";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { PostDoQuadro } from "../api/content.repository";
import type { StatusDoPost } from "../domain/post";
import { resumoDosAvisos, textoDoAguardando, textoDosAtrasados } from "../domain/prazos";
import { passoDoMovimento } from "../domain/transicoes";
import {
  useApagarPost,
  useClientesDoConteudo,
  useCorrigirPublicacao,
  useCriarPost,
  useEditarPost,
  useEventosDoPost,
  useMoverPost,
  usePostsDaSemana,
  usePostsDoQuadro,
  useResponsaveis,
} from "../hooks/use-content";
import { CalendarioSemanal } from "./calendario-semanal";
import { DialogoDeNota, type PedidoDeMovimento } from "./dialogo-de-nota";
import { DialogoDoPost } from "./dialogo-do-post";
import { QuadroDeConteudo } from "./quadro-de-conteudo";

type Visao = "quadro" | "calendario";

const RECARREGAR = "Recarregue a página e tente de novo.";

export function PaginaDeConteudo() {
  const agora = useAgora();
  const { papel, meuId } = useProfile();
  const [visao, setVisao] = useState<Visao>("quadro");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [inicio, setInicio] = useState(() => inicioDaSemanaSP(agora));
  const [dialogo, setDialogo] = useState<{ readonly post: PostDoQuadro | null } | null>(null);
  const [pedido, setPedido] = useState<PedidoDeMovimento | null>(null);

  const publicadosDesde = paraInstante(somaDias(todaySP(agora), -14), "00:00");
  const quadro = usePostsDoQuadro(clienteId, publicadosDesde);
  const semana = usePostsDaSemana(inicio, clienteId, visao === "calendario");
  const clientes = useClientesDoConteudo();
  const responsaveis = useResponsaveis();
  const eventos = useEventosDoPost(dialogo?.post?.id ?? null);
  const criar = useCriarPost();
  const editar = useEditarPost();
  const mover = useMoverPost();
  const apagar = useApagarPost();
  const corrigirPublicacao = useCorrigirPublicacao();

  const estadoDoQuadro = estadoDaConsulta(quadro);
  const estadoDaSemana = estadoDaConsulta(semana);
  const posts = quadro.data?.posts ?? [];
  const avisos = resumoDosAvisos(posts, agora);
  const podeApagar = papel === "owner" || papel === "manager";

  function iniciarMovimento(post: PostDoQuadro, para: StatusDoPost) {
    const passo = passoDoMovimento(post.status, para);
    if (passo === "nada") return;
    if (passo === "mover") {
      mover.mutate({ id: post.id, de: post.status, para });
      return;
    }
    setPedido({ post, para: passo === "pedir_nota" ? "ajuste_pedido" : "publicado" });
  }

  const abrir = (post: PostDoQuadro | null) => setDialogo({ post });

  return (
    <>
      <PageHeader
        title="Conteúdo"
        description="Posts dos clientes, da produção à publicação (P·E·CO·L)."
        actions={
          <Button type="button" size="sm" onClick={() => abrir(null)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Novo post
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Visão">
          <Button
            type="button"
            size="sm"
            variant={visao === "quadro" ? "default" : "ghost"}
            aria-pressed={visao === "quadro"}
            onClick={() => setVisao("quadro")}
          >
            Quadro
          </Button>
          <Button
            type="button"
            size="sm"
            variant={visao === "calendario" ? "default" : "ghost"}
            aria-pressed={visao === "calendario"}
            onClick={() => setVisao("calendario")}
          >
            Calendário
          </Button>
        </div>
        <select
          aria-label="Cliente"
          className="h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
          value={clienteId ?? ""}
          disabled={estadoDaConsulta(clientes) === "erro"}
          onChange={(e) => setClienteId(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">Todos os clientes</option>
          {(clientes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        {estadoDoQuadro === "pronto" && avisos.atrasados > 0 && (
          <span className="rounded-md bg-destructive-soft px-2 py-1 text-xs text-destructive">
            {textoDosAtrasados(avisos.atrasados)}
          </span>
        )}
        {estadoDoQuadro === "pronto" && avisos.aguardando > 0 && (
          <span className="rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
            {textoDoAguardando(avisos.aguardando, avisos.aguardandoHaMaisDias)}
          </span>
        )}
      </div>

      {estadoDaConsulta(clientes) === "erro" && (
        <FalhaAoLer oQue="a lista de clientes (filtro e formulário)" mensagem={RECARREGAR} />
      )}
      {estadoDaConsulta(responsaveis) === "erro" && (
        <FalhaAoLer oQue="a equipe (responsável e histórico)" mensagem={RECARREGAR} />
      )}

      {visao === "quadro" ? (
        estadoDoQuadro === "erro" ? (
          <FalhaAoLer oQue="os posts" mensagem={RECARREGAR} />
        ) : estadoDoQuadro === "carregando" ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {'Nenhum post ainda. Crie o primeiro em "Novo post".'}
          </p>
        ) : (
          <QuadroDeConteudo
            posts={posts}
            agora={agora}
            movendoId={mover.isPending ? mover.variables?.id : undefined}
            onAbrir={abrir}
            onMover={iniciarMovimento}
          />
        )
      ) : estadoDaSemana === "erro" ? (
        <FalhaAoLer oQue="os posts da semana" mensagem={RECARREGAR} />
      ) : (
        <CalendarioSemanal
          inicio={inicio}
          carregando={estadoDaSemana === "carregando"}
          posts={semana.data?.posts ?? []}
          agora={agora}
          onAbrir={abrir}
          onSemana={setInicio}
        />
      )}

      {(visao === "quadro" ? quadro.data?.temMais : semana.data?.temMais) === true && (
        <p className="mt-3 text-[11px] text-warning">
          A lista encheu e pode haver mais posts do que os mostrados. Filtre por cliente.
        </p>
      )}

      {dialogo !== null && (
        <DialogoDoPost
          key={dialogo.post?.id ?? "novo"}
          post={dialogo.post}
          clientes={clientes.data ?? []}
          responsaveis={responsaveis.data ?? []}
          eventos={eventos.data ?? []}
          estadoDosEventos={estadoDaConsulta(eventos)}
          estadoDosResponsaveis={estadoDaConsulta(responsaveis)}
          clienteInicial={clienteId}
          meuId={meuId}
          podeApagar={podeApagar}
          agora={agora}
          salvando={criar.isPending || editar.isPending}
          apagando={apagar.isPending}
          corrigindo={corrigirPublicacao.isPending}
          onFechar={() => setDialogo(null)}
          onSalvar={(campos) => {
            const fechar = { onSuccess: () => setDialogo(null) };
            if (dialogo.post === null) criar.mutate(campos, fechar);
            else
              editar.mutate(
                { id: dialogo.post.id, atualizadoEm: dialogo.post.atualizadoEm, campos },
                fechar,
              );
          }}
          onMover={(para) => {
            const post = dialogo.post;
            setDialogo(null);
            if (post !== null) iniciarMovimento(post, para);
          }}
          onApagar={() => {
            if (dialogo.post !== null)
              apagar.mutate(dialogo.post.id, { onSuccess: () => setDialogo(null) });
          }}
          onCorrigirPublicacao={(correcao) => {
            if (dialogo.post !== null)
              corrigirPublicacao.mutate(
                { id: dialogo.post.id, atualizadoEm: dialogo.post.atualizadoEm, correcao },
                { onSuccess: () => setDialogo(null) },
              );
          }}
        />
      )}

      {pedido !== null && (
        <DialogoDeNota
          key={`${pedido.post.id}-${pedido.para}`}
          pedido={pedido}
          enviando={mover.isPending}
          onCancelar={() => setPedido(null)}
          onConfirmar={(texto) =>
            mover.mutate(
              {
                id: pedido.post.id,
                de: pedido.post.status,
                para: pedido.para,
                nota: pedido.para === "ajuste_pedido" ? texto : null,
                link: pedido.para === "publicado" ? texto : null,
              },
              { onSuccess: () => setPedido(null) },
            )
          }
        />
      )}
    </>
  );
}
