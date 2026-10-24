import { ChevronRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/ui/empty-state";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { Script } from "../api/scripts.repository";
import {
  CANAIS_POR_TIPO,
  MOMENTOS_POR_TIPO,
  rotuloDoCanal,
  rotuloDoMomento,
  rotuloDoTipo,
  type CanalDeScript,
  type MomentoDeScript,
  type TipoDeScript,
} from "../domain/script";
import {
  useApagarScript,
  useDefinirSituacaoDoScript,
  useMaisUsadosRecentemente,
  useNichos,
  useRegistrarUso,
  useScripts,
} from "../hooks/use-scripts";
import { FormularioDeScript } from "./formulario-de-script";

const ESPERA_DA_BUSCA_MS = 250;

export function ScriptsPage({
  tipo,
  aoTrocarTipo,
}: {
  tipo: TipoDeScript;
  aoTrocarTipo: (tipo: TipoDeScript) => void;
}) {
  const { papel } = useProfile();
  const podeEditar = papel === "owner" || papel === "manager";

  const [nicho, setNicho] = useState<string | undefined>(undefined);
  const [canal, setCanal] = useState<CanalDeScript | undefined>(undefined);
  const [momento, setMomento] = useState<MomentoDeScript | undefined>(undefined);
  const [scriptNoFormulario, setScriptNoFormulario] = useState<Script | null | undefined>(
    undefined,
  );

  const [buscaAberta, setBuscaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const devolverFocoALupa = useRef(false);

  useEffect(() => {
    const espera = setTimeout(() => setTermo(busca), ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [busca]);

  const scripts = useScripts({ tipo, nicho, canal, momento, busca: termo });
  const nichos = useNichos(tipo);
  const registrarUso = useRegistrarUso();
  const definirSituacao = useDefinirSituacaoDoScript();
  const apagar = useApagarScript();
  const estado = estadoDaConsulta(scripts);
  const temScripts = (scripts.data ?? []).length > 0;
  const filtroAplicado =
    nicho !== undefined || canal !== undefined || momento !== undefined || busca.trim() !== "";

  function limparFiltros() {
    setNicho(undefined);
    setCanal(undefined);
    setMomento(undefined);
    fecharBusca();
  }

  function fecharBusca({ devolverFoco = false } = {}) {
    setBusca("");
    setTermo("");
    setBuscaAberta(false);
    devolverFocoALupa.current = devolverFoco;
  }

  function alternar(id: string) {
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (!proximo.delete(id)) proximo.add(id);
      return proximo;
    });
  }

  const [tipoAnterior, setTipoAnterior] = useState(tipo);
  if (tipo !== tipoAnterior) {
    setTipoAnterior(tipo);
    setNicho(undefined);
    setCanal(undefined);
    setMomento(undefined);
    if (scriptNoFormulario !== undefined && scriptNoFormulario !== null) {
      setScriptNoFormulario(undefined);
    }
  }

  function trocarTipo(novoTipo: TipoDeScript) {
    aoTrocarTipo(novoTipo);
  }

  async function copiar(script: Script) {
    try {
      await navigator.clipboard.writeText(script.body);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie à mão.");
      return;
    }
    toast.success("Copiado.");
    registrarUso.mutate(script.id);
  }

  return (
    <>
      <PageHeader
        title="Scripts"
        description="Roteiros prontos para SDR e Closer: copie e cole na conversa"
        actions={
          podeEditar && estado === "pronto" && temScripts ? (
            <Button size="sm" onClick={() => setScriptNoFormulario(null)}>
              <span className="mr-1">+</span>
              Novo script
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={tipo === "sdr" ? "default" : "outline"}
          onClick={() => trocarTipo("sdr")}
        >
          {rotuloDoTipo("sdr")}
        </Button>
        <Button
          size="sm"
          variant={tipo === "closer" ? "default" : "outline"}
          onClick={() => trocarTipo("closer")}
        >
          {rotuloDoTipo("closer")}
        </Button>
        {buscaAberta ? (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              autoFocus
              aria-label="Buscar scripts"
              placeholder="Buscar no título ou no texto…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") fecharBusca({ devolverFoco: true });
              }}
              className="h-8 w-[260px] pl-7 pr-7 text-xs"
            />
            <button
              type="button"
              aria-label="Fechar busca"
              onClick={() => fecharBusca({ devolverFoco: true })}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            aria-label="Buscar scripts"
            title="Buscar scripts"
            onClick={() => setBuscaAberta(true)}
            ref={(botao) => {
              if (botao !== null && devolverFocoALupa.current) {
                devolverFocoALupa.current = false;
                botao.focus();
              }
            }}
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FiltroDeChips
          rotuloTodos="Todo canal"
          selecionado={canal}
          opcoes={CANAIS_POR_TIPO[tipo]}
          rotulo={rotuloDoCanal}
          aoSelecionar={setCanal}
        />
        <FiltroDeChips
          rotuloTodos="Todo momento"
          selecionado={momento}
          opcoes={MOMENTOS_POR_TIPO[tipo]}
          rotulo={rotuloDoMomento}
          aoSelecionar={setMomento}
        />
        {(nichos.data ?? []).length > 0 && (
          <select
            aria-label="Nicho"
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            value={nicho ?? ""}
            onChange={(e) => setNicho(e.target.value === "" ? undefined : e.target.value)}
          >
            <option value="">Todo nicho</option>
            {(nichos.data ?? []).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
      </div>

      <MaisUsados tipo={tipo} />

      {estado === "erro" ? (
        <FalhaAoLer oQue="os scripts" />
      ) : estado === "carregando" ? (
        <p className="text-sm text-muted-foreground">Carregando scripts…</p>
      ) : (scripts.data ?? []).length === 0 ? (
        filtroAplicado ? (
          <EmptyState
            title="Nenhum script bate com estes filtros"
            description="Tente outro termo, canal, momento ou nicho, ou limpe os filtros."
            action={
              <Button size="sm" variant="outline" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Nenhum script cadastrado ainda"
            description={
              podeEditar
                ? "Crie o primeiro em Novo script."
                : "Peça a um gestor para cadastrar os primeiros scripts."
            }
            action={
              podeEditar ? (
                <Button size="sm" onClick={() => setScriptNoFormulario(null)}>
                  Novo script
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div
          className={cn(
            "grid items-start gap-2 xl:grid-cols-2",
            scripts.isPlaceholderData && "opacity-60",
          )}
        >
          {(scripts.data ?? []).map((script) => {
            const aberto = abertos.has(script.id);
            return (
              <Card key={script.id} className="min-w-0">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      aria-expanded={aberto}
                      aria-controls={`script-${script.id}`}
                      onClick={() => alternar(script.id)}
                      className="flex min-w-0 items-center gap-2 text-left hover:text-primary-texto"
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          aberto && "rotate-90",
                        )}
                        aria-hidden
                      />
                      <span className="font-medium">{script.title}</span>
                    </button>
                    <div className="flex flex-wrap gap-1.5 text-[10.5px] text-muted-foreground">
                      <span className="rounded-full border px-2 py-px">
                        {rotuloDoCanal(script.canal)}
                      </span>
                      <span className="rounded-full border px-2 py-px">
                        {rotuloDoMomento(script.momento)}
                      </span>
                      <span className="rounded-full border px-2 py-px">{script.nicho}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" onClick={() => void copiar(script)}>
                      Copiar
                    </Button>
                    {podeEditar && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setScriptNoFormulario(script)}
                        >
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              Arquivar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Arquivar "{script.title}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O script some da lista e continua no banco, mas hoje não há como
                                reativar por aqui: só alterando a linha direto no banco.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className={buttonVariants({ variant: "destructive" })}
                                onClick={() =>
                                  definirSituacao.mutate({ id: script.id, ativo: false })
                                }
                              >
                                Arquivar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <DialogoDeExclusao
                          gatilho={
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={apagar.isPending}
                            >
                              Apagar
                            </Button>
                          }
                          titulo={`Apagar "${script.title}"?`}
                          pendente={apagar.isPending}
                          onConfirmar={() => apagar.mutate(script.id)}
                        >
                          <p>Apaga o script. O histórico de uso fica, sem o script.</p>
                          <p>Para só tirar da lista, use Arquivar.</p>
                          <p>Não pode ser desfeito.</p>
                        </DialogoDeExclusao>
                      </>
                    )}
                  </div>
                </div>
                <pre
                  id={`script-${script.id}`}
                  hidden={!aberto}
                  className="whitespace-pre-wrap wrap-anywhere border-t px-4 py-3 font-sans text-sm text-muted-foreground"
                >
                  {script.body}
                </pre>
              </Card>
            );
          })}
        </div>
      )}

      <FormularioDeScript
        tipo={tipo}
        aberto={scriptNoFormulario !== undefined}
        script={scriptNoFormulario ?? null}
        aoFechar={() => setScriptNoFormulario(undefined)}
      />
    </>
  );
}

function MaisUsados({ tipo }: { tipo: TipoDeScript }) {
  const maisUsados = useMaisUsadosRecentemente(tipo);
  const estado = estadoDaConsulta(maisUsados);

  if (estado === "carregando") return null;
  if (estado === "erro") return <FalhaAoLer oQue="os mais usados ultimamente" />;
  if ((maisUsados.data ?? []).length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Usados com frequência ultimamente</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(maisUsados.data ?? []).map((item) => (
          <span
            key={item.scriptId}
            className="rounded-full border px-2 py-1 text-xs"
            title={`${item.usos} uso(s) recentes`}
          >
            {item.titulo}
          </span>
        ))}
      </div>
    </div>
  );
}

function FiltroDeChips<T extends string>({
  rotuloTodos,
  selecionado,
  opcoes,
  rotulo,
  aoSelecionar,
}: {
  rotuloTodos: string;
  selecionado: T | undefined;
  opcoes: readonly T[];
  rotulo: (valor: T) => string;
  aoSelecionar: (valor: T | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant={selecionado === undefined ? "default" : "outline"}
        onClick={() => aoSelecionar(undefined)}
      >
        {rotuloTodos}
      </Button>
      {opcoes.map((opcao) => (
        <Button
          key={opcao}
          size="sm"
          variant={selecionado === opcao ? "default" : "outline"}
          onClick={() => aoSelecionar(opcao)}
        >
          {rotulo(opcao)}
        </Button>
      ))}
    </div>
  );
}
