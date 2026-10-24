import { FolderOpen, Pencil, X } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/shared/lib/date";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import { type RascunhoDaTarefa, rascunhoDe, validarEdicao } from "../domain/edicao";
import { hostDoLink, validarLink } from "../domain/link";
import {
  podeApagar,
  podeEditar,
  podeGerirParticipantes,
  podeTrocarResponsavel,
} from "../domain/permissoes";
import {
  ehRecorrencia,
  type LinkDaTarefa,
  type PrioridadeDaTarefa,
  type RecorrenciaDaTarefa,
  ROTULO_DA_COLUNA,
  ROTULO_DA_PRIORIDADE,
  ROTULO_DA_RECORRENCIA,
  type Tarefa,
} from "../domain/task";
import {
  useAdicionarLink,
  useAdicionarParticipantes,
  useApagarTarefa,
  useAtualizarLink,
  useAtualizarTarefa,
  useCatalogoDeTarefas,
  useClientesParaSelecao,
  usePessoasDoTime,
  useRemoverLink,
  useRemoverParticipante,
} from "../hooks/use-tasks";

const SELECT = "mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50";

const REMOVER =
  "-m-1.5 rounded-sm p-1.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

const EDITAR =
  "-my-1.5 -ml-1.5 rounded-sm p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export const FECHAMENTO_BARRADO =
  "Há alterações não salvas. Salve, ou feche pelo X para descartar.";

export const PENDENTE_NAO_INCLUIDO =
  "Há link ou participante escolhido e não incluído: inclua ou limpe antes de salvar.";

export const PENDENTE_AO_FECHAR =
  "Há link ou participante escolhido e não incluído: inclua, limpe ou feche pelo X para descartar.";

export const LINK_EM_EDICAO = "Há um link em edição: salve ou cancele a edição do link.";

const SAIU_DA_LISTA =
  "Esta tarefa saiu desta lista: pode ter sido concluída, repassada ou apagada. Participantes e links mexidos aqui só aparecem quando ela voltar.";

function avisoDeRecorrencia(t: Tarefa): string | null {
  if (t.recorrencia === "nenhuma") return null;
  return t.raizRecorrente === null
    ? "Raiz da recorrência: o dia deste prazo ancora o dia do mês das próximas ocorrências."
    : "Tarefa recorrente: a próxima ocorrência nasce do maior prazo da corrente, inclusive este.";
}

function avisoDaMudancaDeRecorrencia(
  original: RecorrenciaDaTarefa,
  coluna: Tarefa["coluna"],
  nova: RecorrenciaDaTarefa,
): string | null {
  if (nova === original) return null;
  if (coluna === "done") {
    return "Esta tarefa já está concluída: a recorrência nova não cria nem muda ocorrência agora. Para mudar a corrente, edite a ocorrência aberta, se houver.";
  }
  if (nova === "nenhuma") {
    return "Ao concluir esta tarefa, ela não gera a próxima ocorrência. Se não houver outra ocorrência aberta desta tarefa, a corrente para aqui.";
  }
  return `A nova recorrência (${ROTULO_DA_RECORRENCIA[nova]}) vale quando esta tarefa for concluída: se não houver outra ocorrência aberta desta tarefa, a próxima nasce com ela e passa a regra adiante.`;
}

export function DialogoDeTarefa({
  tarefa,
  onFechar,
  foraDaLista = false,
}: {
  readonly tarefa: Tarefa;
  readonly onFechar: () => void;
  readonly foraDaLista?: boolean;
}) {
  const { papel, meuId } = useProfile();
  const atualizar = useAtualizarTarefa();
  const apagar = useApagarTarefa();
  const incluirPessoa = useAdicionarParticipantes();
  const removerPessoa = useRemoverParticipante();
  const incluirLink = useAdicionarLink();
  const removerLink = useRemoverLink();
  const atualizarLink = useAtualizarLink();
  const time = usePessoasDoTime();
  const catalogo = useCatalogoDeTarefas();
  const clientes = useClientesParaSelecao();
  const estadoDoTime = estadoDaConsulta(time);
  const estadoDoCatalogo = estadoDaConsulta(catalogo);
  const estadoDosClientes = estadoDaConsulta(clientes);

  const editavel = podeEditar(tarefa, papel, meuId);
  const gereParticipantes = podeGerirParticipantes(tarefa, papel, meuId);
  const trocaResponsavel = podeTrocarResponsavel(papel);
  const apagavel = podeApagar(tarefa, papel, meuId);

  const [inicial] = useState(() => rascunhoDe(tarefa));
  const [rascunho, setRascunho] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [barrados, setBarrados] = useState(0);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [pessoaParaIncluir, setPessoaParaIncluir] = useState("");
  const [rotuloDoLink, setRotuloDoLink] = useState("");
  const [urlDoLink, setUrlDoLink] = useState("");
  const [erroDoLink, setErroDoLink] = useState<string | null>(null);
  const [salvarBarrado, setSalvarBarrado] = useState(false);
  const [linkEmEdicao, setLinkEmEdicao] = useState<{
    readonly id: string;
    readonly rotulo: string;
    readonly url: string;
  } | null>(null);
  const [erroDaEdicao, setErroDaEdicao] = useState<string | null>(null);

  const ocupado = atualizar.isPending || apagar.isPending;
  const sujo = (Object.keys(rascunho) as (keyof RascunhoDaTarefa)[]).some(
    (campo) => rascunho[campo] !== inicial[campo],
  );
  const candidatos = (time.data ?? []).filter(
    (p) => p.id !== tarefa.responsavelId && !tarefa.participantes.some((x) => x.id === p.id),
  );
  const escolhida = candidatos.some((p) => p.id === pessoaParaIncluir) ? pessoaParaIncluir : "";
  const naoIncluido = escolhida !== "" || rotuloDoLink !== "" || urlDoLink !== "";
  const emEdicao =
    editavel && linkEmEdicao !== null && tarefa.links.some((l) => l.id === linkEmEdicao.id)
      ? linkEmEdicao
      : null;
  const pendente = sujo || naoIncluido || emEdicao !== null;

  const categorias = [
    ...new Set([tarefa.categoria, ...(catalogo.data ?? []).map((c) => c.categoria)]),
  ];
  const tipos = [
    ...new Set([
      ...(rascunho.categoria === tarefa.categoria ? [tarefa.tipo] : []),
      ...(catalogo.data ?? []).filter((c) => c.categoria === rascunho.categoria).map((c) => c.tipo),
    ]),
  ];
  const opcoesDeCliente =
    tarefa.clienteId !== null && !(clientes.data ?? []).some((c) => c.id === tarefa.clienteId)
      ? [{ id: tarefa.clienteId, nome: tarefa.cliente ?? "" }, ...(clientes.data ?? [])]
      : (clientes.data ?? []);
  const responsavelSemOpcao =
    tarefa.responsavelId !== null && !(time.data ?? []).some((p) => p.id === tarefa.responsavelId);
  const responsavelForaDaLista = estadoDoTime === "pronto" && responsavelSemOpcao;
  const aviso = avisoDeRecorrencia(tarefa);
  const avisoDaDescricao = tarefa.recorrencia !== "nenhuma" && tarefa.coluna !== "done";
  const avisoDaMudanca = avisoDaMudancaDeRecorrencia(
    inicial.recorrencia,
    tarefa.coluna,
    rascunho.recorrencia,
  );

  function muda<K extends keyof RascunhoDaTarefa>(campo: K, valor: RascunhoDaTarefa[K]) {
    setRascunho((r) => ({ ...r, [campo]: valor }));
    setErro(null);
    setBarrados(0);
  }

  function barrarFechamento(e: Event) {
    e.preventDefault();
    if (!ocupado) setBarrados((n) => n + 1);
  }

  function mexeNaInclusao() {
    setSalvarBarrado(false);
    setBarrados(0);
  }

  function salvar() {
    if (naoIncluido || emEdicao !== null) {
      setSalvarBarrado(true);
      return;
    }
    const resultado = validarEdicao(inicial, rascunho);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    if (Object.keys(resultado.alteracao).length === 0) {
      onFechar();
      return;
    }
    atualizar.mutate({ id: tarefa.id, campos: resultado.alteracao }, { onSuccess: onFechar });
  }

  function incluirOLink() {
    const validado = validarLink(rotuloDoLink, urlDoLink);
    if (!validado.ok) {
      setErroDoLink(validado.erro);
      return;
    }
    incluirLink.mutate(
      { taskId: tarefa.id, rotulo: validado.link.rotulo, url: validado.link.url },
      {
        onSuccess: () => {
          setRotuloDoLink("");
          setUrlDoLink("");
        },
      },
    );
  }

  function editarOLink(l: LinkDaTarefa) {
    setLinkEmEdicao({ id: l.id, rotulo: l.rotulo, url: l.url });
    setErroDaEdicao(null);
    mexeNaInclusao();
  }

  function mudaOLinkEmEdicao(campo: "rotulo" | "url", valor: string) {
    setLinkEmEdicao((atual) => (atual === null ? atual : { ...atual, [campo]: valor }));
    setErroDaEdicao(null);
    mexeNaInclusao();
  }

  function salvarOLink() {
    if (emEdicao === null) return;
    const validado = validarLink(emEdicao.rotulo, emEdicao.url);
    if (!validado.ok) {
      setErroDaEdicao(validado.erro);
      return;
    }
    atualizarLink.mutate(
      { id: emEdicao.id, rotulo: validado.link.rotulo, url: validado.link.url },
      { onSuccess: () => setLinkEmEdicao(null) },
    );
  }

  function cancelarOLink() {
    setLinkEmEdicao(null);
    setErroDaEdicao(null);
    mexeNaInclusao();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !ocupado && onFechar()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onEscapeKeyDown={(e) => {
          if (pendente) barrarFechamento(e);
        }}
        onPointerDownOutside={(e) => {
          if (pendente) barrarFechamento(e);
        }}
      >
        <DialogHeader>
          <DialogTitle>{tarefa.titulo}</DialogTitle>
        </DialogHeader>

        {foraDaLista && <p className="text-xs text-warning">{SAIU_DA_LISTA}</p>}

        {pendente && barrados > 0 && (
          <p key={barrados} role="alert" className="text-xs text-muted-foreground">
            {sujo ? FECHAMENTO_BARRADO : naoIncluido ? PENDENTE_AO_FECHAR : LINK_EM_EDICAO}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {editavel
            ? `Coluna: ${ROTULO_DA_COLUNA[tarefa.coluna]} · mova pelo quadro.`
            : `Coluna: ${ROTULO_DA_COLUNA[tarefa.coluna]}`}
        </p>

        {editavel ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="tarefa-titulo">Título</Label>
              <Input
                id="tarefa-titulo"
                className="mt-1"
                value={rascunho.titulo}
                onChange={(e) => muda("titulo", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="tarefa-descricao">Descrição</Label>
              <Textarea
                id="tarefa-descricao"
                className="mt-1 min-h-40"
                value={rascunho.descricao}
                placeholder="O que fazer, combinados…"
                onChange={(e) => muda("descricao", e.target.value)}
              />
              {avisoDaDescricao && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Tarefa recorrente: esta descrição passa para a próxima ocorrência.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="tarefa-categoria">Categoria</Label>
              {estadoDoCatalogo === "erro" && (
                <FalhaAoLer
                  oQue="os tipos de tarefa"
                  mensagem="Recarregue a página e tente de novo."
                />
              )}
              <select
                id="tarefa-categoria"
                className={SELECT}
                value={rascunho.categoria}
                disabled={estadoDoCatalogo !== "pronto"}
                onChange={(e) => {
                  setRascunho((r) => ({ ...r, categoria: e.target.value, tipo: "" }));
                  setErro(null);
                  setBarrados(0);
                }}
              >
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="tarefa-tipo">Tipo</Label>
              <select
                id="tarefa-tipo"
                className={SELECT}
                value={rascunho.tipo}
                disabled={estadoDoCatalogo !== "pronto"}
                onChange={(e) => muda("tipo", e.target.value)}
              >
                <option value="">Escolha…</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="tarefa-prioridade">Prioridade</Label>
              <select
                id="tarefa-prioridade"
                className={SELECT}
                value={rascunho.prioridade}
                onChange={(e) => muda("prioridade", e.target.value as PrioridadeDaTarefa)}
              >
                {(Object.keys(ROTULO_DA_PRIORIDADE) as PrioridadeDaTarefa[]).map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_DA_PRIORIDADE[p]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="tarefa-prazo">Prazo</Label>
              <Input
                id="tarefa-prazo"
                type="date"
                className="mt-1"
                value={rascunho.prazo}
                onChange={(e) => muda("prazo", e.target.value)}
              />
              {aviso !== null && <p className="mt-1 text-[11px] text-warning">{aviso}</p>}
            </div>

            <div>
              <Label htmlFor="tarefa-cliente">Cliente</Label>
              {estadoDosClientes === "erro" && (
                <FalhaAoLer
                  oQue="a lista de clientes"
                  mensagem="Recarregue a página e tente de novo."
                />
              )}
              <select
                id="tarefa-cliente"
                className={SELECT}
                value={rascunho.clienteId}
                disabled={estadoDosClientes !== "pronto"}
                onChange={(e) => muda("clienteId", e.target.value)}
              >
                <option value="">Nenhum</option>
                {opcoesDeCliente.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              {trocaResponsavel ? (
                <>
                  <Label htmlFor="tarefa-responsavel">Responsável</Label>
                  {estadoDoTime === "erro" && (
                    <FalhaAoLer
                      oQue="a lista de quem pode ser responsável"
                      mensagem="Recarregue a página e tente de novo."
                    />
                  )}
                  <select
                    id="tarefa-responsavel"
                    className={SELECT}
                    value={rascunho.responsavelId}
                    disabled={estadoDoTime !== "pronto"}
                    onChange={(e) => muda("responsavelId", e.target.value)}
                  >
                    <option value="">Sem responsável</option>
                    {responsavelSemOpcao && tarefa.responsavelId !== null && (
                      <option value={tarefa.responsavelId} disabled>
                        {`${tarefa.responsavel ?? ""}${responsavelForaDaLista ? " (fora da lista)" : ""}`}
                      </option>
                    )}
                    {(time.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="mt-6 text-sm">
                  {`Responsável: ${tarefa.responsavel ?? "Sem responsável"}`}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="tarefa-recorrencia">Recorrência</Label>
              <select
                id="tarefa-recorrencia"
                className={SELECT}
                value={rascunho.recorrencia}
                onChange={(e) => {
                  if (ehRecorrencia(e.target.value)) muda("recorrencia", e.target.value);
                }}
              >
                {(Object.keys(ROTULO_DA_RECORRENCIA) as RecorrenciaDaTarefa[]).map((r) => (
                  <option key={r} value={r}>
                    {ROTULO_DA_RECORRENCIA[r]}
                  </option>
                ))}
              </select>
              {avisoDaMudanca !== null && (
                <p className="mt-1 text-[11px] text-warning">{avisoDaMudanca}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Categoria</dt>
              <dd>
                {tarefa.categoria} · {tarefa.tipo}
              </dd>
              <dt className="text-muted-foreground">Prioridade</dt>
              <dd>{ROTULO_DA_PRIORIDADE[tarefa.prioridade]}</dd>
              <dt className="text-muted-foreground">Prazo</dt>
              <dd className="tabular-nums">
                {tarefa.prazo === null ? "Sem prazo" : formatDate(tarefa.prazo)}
              </dd>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd>{tarefa.cliente ?? "Nenhum"}</dd>
              <dt className="text-muted-foreground">Responsável</dt>
              <dd>{tarefa.responsavel ?? "Sem responsável"}</dd>
              <dt className="text-muted-foreground">Recorrência</dt>
              <dd>{ROTULO_DA_RECORRENCIA[tarefa.recorrencia]}</dd>
            </dl>
            {aviso !== null && <p className="text-[11px] text-muted-foreground">{aviso}</p>}
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">Descrição</h3>
              {(tarefa.descricao ?? "").trim() === "" ? (
                <p className="text-sm text-muted-foreground">Sem descrição.</p>
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm">{tarefa.descricao}</p>
              )}
              {avisoDaDescricao && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Tarefa recorrente: esta descrição passa para a próxima ocorrência.
                </p>
              )}
            </div>
          </>
        )}

        <section aria-label="Participantes" className="border-t pt-3">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Participantes</h3>
          {tarefa.participantes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem participantes.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {tarefa.participantes.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
                >
                  <span className={p.ativo ? undefined : "text-muted-foreground"}>{p.nome}</span>
                  {!p.ativo && <span className="text-muted-foreground">(inativo)</span>}
                  {gereParticipantes && (
                    <button
                      type="button"
                      aria-label={`Remover ${p.nome}`}
                      disabled={removerPessoa.isPending}
                      className={REMOVER}
                      onClick={() => removerPessoa.mutate({ taskId: tarefa.id, profileId: p.id })}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {gereParticipantes && (
            <div className="mt-2">
              {estadoDoTime === "erro" && (
                <FalhaAoLer oQue="o time" mensagem="Recarregue a página e tente de novo." />
              )}
              <div className="flex items-end gap-2">
                <select
                  aria-label="Pessoa para incluir"
                  className={SELECT}
                  value={escolhida}
                  disabled={estadoDoTime !== "pronto"}
                  onChange={(e) => {
                    setPessoaParaIncluir(e.target.value);
                    mexeNaInclusao();
                  }}
                >
                  <option value="">Escolha…</option>
                  {candidatos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={escolhida === "" || incluirPessoa.isPending}
                  onClick={() =>
                    incluirPessoa.mutate(
                      { taskId: tarefa.id, profileIds: [escolhida] },
                      { onSuccess: () => setPessoaParaIncluir("") },
                    )
                  }
                >
                  Incluir participante
                </Button>
              </div>
            </div>
          )}
        </section>

        <section aria-label="Links" className="border-t pt-3">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Links</h3>
          <ul className="space-y-1 text-sm">
            {tarefa.pastaDoDriveDoCliente !== null && (
              <li>
                <a
                  href={tarefa.pastaDoDriveDoCliente}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary-texto underline"
                >
                  <FolderOpen className="h-3.5 w-3.5" aria-hidden />
                  Pasta do cliente no Drive
                </a>
              </li>
            )}
            {tarefa.links.map((l) => {
              if (emEdicao !== null && emEdicao.id === l.id) {
                const gravando = atualizarLink.isPending;
                return (
                  <li
                    key={l.id}
                    className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end"
                  >
                    <Input
                      autoFocus
                      aria-label={`Nome do link ${l.rotulo}`}
                      placeholder="Nome do link"
                      disabled={gravando}
                      value={emEdicao.rotulo}
                      onChange={(e) => mudaOLinkEmEdicao("rotulo", e.target.value)}
                    />
                    <Input
                      aria-label={`Endereço do link ${l.rotulo}`}
                      inputMode="url"
                      placeholder="https://"
                      disabled={gravando}
                      value={emEdicao.url}
                      onChange={(e) => mudaOLinkEmEdicao("url", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={gravando}
                      onClick={salvarOLink}
                    >
                      Salvar link
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={gravando}
                      onClick={cancelarOLink}
                    >
                      Cancelar
                    </Button>
                    {erroDaEdicao !== null && (
                      <p role="alert" className="text-[11px] text-destructive sm:col-span-4">
                        {erroDaEdicao}
                      </p>
                    )}
                  </li>
                );
              }
              const host = hostDoLink(l.url);
              return (
                <li key={l.id} className="flex items-center gap-2">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={l.url}
                    className="min-w-0 truncate text-primary-texto underline"
                  >
                    {l.rotulo}
                  </a>
                  {host !== null && (
                    <span className="min-w-0 break-all text-xs text-muted-foreground">{`· ${host}`}</span>
                  )}
                  {editavel && (
                    <button
                      type="button"
                      aria-label={`Editar link ${l.rotulo}`}
                      disabled={emEdicao !== null}
                      className={EDITAR}
                      onClick={() => editarOLink(l)}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                  {editavel && (
                    <button
                      type="button"
                      aria-label={`Remover link ${l.rotulo}`}
                      disabled={removerLink.isPending}
                      className={REMOVER}
                      onClick={() => removerLink.mutate(l.id)}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {tarefa.links.length === 0 && <p className="text-xs text-muted-foreground">Sem links.</p>}
          {editavel && (
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <Input
                aria-label="Nome do link"
                placeholder="Briefing, arte, contrato…"
                value={rotuloDoLink}
                onChange={(e) => {
                  setRotuloDoLink(e.target.value);
                  setErroDoLink(null);
                  mexeNaInclusao();
                }}
              />
              <Input
                aria-label="Endereço do link"
                inputMode="url"
                placeholder="https://"
                value={urlDoLink}
                onChange={(e) => {
                  setUrlDoLink(e.target.value);
                  setErroDoLink(null);
                  mexeNaInclusao();
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={incluirLink.isPending}
                onClick={incluirOLink}
              >
                Incluir link
              </Button>
              {erroDoLink !== null && (
                <p role="alert" className="text-[11px] text-destructive sm:col-span-3">
                  {erroDoLink}
                </p>
              )}
            </div>
          )}
        </section>

        {erro !== null && (
          <p role="alert" className="text-xs text-destructive">
            {erro}
          </p>
        )}
        {salvarBarrado && naoIncluido && (
          <p role="alert" className="text-xs text-destructive">
            {PENDENTE_NAO_INCLUIDO}
          </p>
        )}
        {salvarBarrado && !naoIncluido && emEdicao !== null && (
          <p role="alert" className="text-xs text-destructive">
            {LINK_EM_EDICAO}
          </p>
        )}

        {(apagavel || editavel) && (
          <div className="flex items-center gap-2 border-t pt-3">
            {apagavel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={ocupado}
                onClick={() => setConfirmandoApagar(true)}
              >
                Apagar tarefa
              </Button>
            )}
            {editavel && (
              <Button
                type="button"
                size="sm"
                className="ml-auto"
                disabled={!sujo || ocupado}
                onClick={salvar}
              >
                {atualizar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      <AlertDialog open={confirmandoApagar} onOpenChange={setConfirmandoApagar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar "{tarefa.titulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se esta tarefa já gerou uma ocorrência seguinte, o
              banco recusa o apagamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => apagar.mutate(tarefa.id, { onSuccess: onFechar })}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
