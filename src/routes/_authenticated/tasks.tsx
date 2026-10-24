import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/hooks/use-auth";
import { exigirPapel } from "@/integrations/supabase/papel";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { FiltrosDeTarefa } from "@/modules/tasks/api/tasks.repository";
import { contarVencidas, ROTULO_DA_PRIORIDADE } from "@/modules/tasks/domain/task";
import type { PrioridadeDaTarefa, Tarefa } from "@/modules/tasks/domain/task";
import {
  useCatalogoDeTarefas,
  useClientesParaSelecao,
  useCriarTarefa,
  useMoverTarefa,
  usePessoasDoTime,
  useTarefas,
} from "@/modules/tasks/hooks/use-tasks";
import { DialogoDeTarefa } from "@/modules/tasks/ui/dialogo-de-tarefa";
import { FormularioDeTarefa } from "@/modules/tasks/ui/formulario-de-tarefa";
import { QuadroDeTarefas } from "@/modules/tasks/ui/quadro-de-tarefas";

export const Route = createFileRoute("/_authenticated/tasks")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: TasksPage,
});

export function TasksPage() {
  const { user } = useAuth();
  const meuId = user?.id ?? null;

  const [responsavelId, setResponsavelId] = useState<string | null | undefined>(undefined);
  const [prioridade, setPrioridade] = useState<PrioridadeDaTarefa | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [somenteVencidas, setSomenteVencidas] = useState(false);
  const [incluirConcluidas, setIncluirConcluidas] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [aberta, setAberta] = useState<Tarefa | null>(null);

  const filtros: FiltrosDeTarefa = {
    responsavelId: responsavelId === undefined ? meuId : responsavelId,
    prioridade,
    clienteId,
    categoria,
    somenteVencidas,
    incluirConcluidas,
  };

  const sabeQuemSou = responsavelId !== undefined || meuId !== null;
  const tarefas = useTarefas(filtros, sabeQuemSou);
  const catalogo = useCatalogoDeTarefas();
  const time = usePessoasDoTime();
  const clientes = useClientesParaSelecao();
  const criar = useCriarTarefa();
  const mover = useMoverTarefa();

  const estado = sabeQuemSou ? estadoDaConsulta(tarefas) : "carregando";
  const estadoDoCatalogo = estadoDaConsulta(catalogo);
  const estadoDoTime = estadoDaConsulta(time);
  const estadoDosClientes = estadoDaConsulta(clientes);
  const lista = tarefas.data?.tarefas ?? [];
  const categorias = [...new Set((catalogo.data ?? []).map((c) => c.categoria))];
  const vendoAsMinhas = (responsavelId === undefined ? meuId : responsavelId) === meuId;
  const daLista = aberta === null ? undefined : lista.find((t) => t.id === aberta.id);
  if (daLista !== undefined && daLista !== aberta) setAberta(daLista);

  return (
    <>
      <PageHeader
        title="Tarefas Internas"
        description="O que cada pessoa precisa fazer, e o que está parado."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Responsável"
          value={responsavelId === undefined ? (meuId ?? "") : (responsavelId ?? "__todas")}
          onChange={(e) => setResponsavelId(e.target.value === "__todas" ? null : e.target.value)}
        >
          {meuId !== null && <option value={meuId}>Minhas tarefas</option>}
          <option value="__todas">Todas as pessoas</option>
          {(time.data ?? [])
            .filter((p) => p.id !== meuId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
        </select>

        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={prioridade ?? ""}
          onChange={(e) =>
            setPrioridade(e.target.value === "" ? null : (e.target.value as PrioridadeDaTarefa))
          }
        >
          <option value="">Qualquer prioridade</option>
          {(Object.keys(ROTULO_DA_PRIORIDADE) as PrioridadeDaTarefa[]).map((p) => (
            <option key={p} value={p}>
              {ROTULO_DA_PRIORIDADE[p]}
            </option>
          ))}
        </select>

        <select
          className="h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
          aria-label="Categoria"
          value={categoria ?? ""}
          disabled={estadoDoCatalogo === "erro"}
          onChange={(e) => setCategoria(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">Qualquer categoria</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
          aria-label="Cliente"
          value={clienteId ?? ""}
          disabled={estadoDosClientes === "erro"}
          onChange={(e) => setClienteId(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">Qualquer cliente</option>
          {(clientes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <Button
          type="button"
          variant={somenteVencidas ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() => setSomenteVencidas((v) => !v)}
        >
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Só vencidas
        </Button>

        <Button
          type="button"
          variant={incluirConcluidas ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() => setIncluirConcluidas((v) => !v)}
        >
          Mostrar concluídas
        </Button>

        <Button type="button" size="sm" className="ml-auto h-9" onClick={() => setFormAberto(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Nova tarefa
        </Button>
      </div>

      {estadoDoTime === "erro" && (
        <FalhaAoLer
          oQue="o time (filtro de responsável: só Minhas e Todas disponíveis)"
          mensagem="Recarregue a página e tente de novo."
        />
      )}
      {estadoDoCatalogo === "erro" && (
        <FalhaAoLer
          oQue="os tipos de tarefa (filtro de categoria)"
          mensagem="Recarregue a página e tente de novo."
        />
      )}
      {estadoDosClientes === "erro" && (
        <FalhaAoLer
          oQue="a lista de clientes (filtro de cliente)"
          mensagem="Recarregue a página e tente de novo."
        />
      )}

      <p className="mb-3 text-[11px] text-muted-foreground">
        {vendoAsMinhas
          ? "Mostrando as tarefas em que você é responsável ou participante."
          : "Mostrando tarefas de outras pessoas."}{" "}
        {estado !== "pronto" ? (
          <span className="text-muted-foreground/70">
            {estado === "erro" ? "Quantas estão vencidas: desconhecido." : "Contando as vencidas…"}
          </span>
        ) : contarVencidas(lista) > 0 ? (
          <strong className="text-destructive">
            {tarefas.data?.temMais === true ? "pelo menos " : ""}
            {contarVencidas(lista) === 1
              ? "1 está vencida"
              : `${contarVencidas(lista)} estão vencidas`}
            .
          </strong>
        ) : tarefas.data?.temMais === true ? (
          "Nenhuma vencida entre as que couberam nesta página."
        ) : (
          "Nenhuma vencida nesta seleção."
        )}
      </p>

      <QuadroDeTarefas
        tarefas={lista}
        estado={estado}
        concluidasNaLista={incluirConcluidas && !somenteVencidas}
        somenteVencidas={somenteVencidas}
        incluirConcluidas={incluirConcluidas}
        movendo={mover.isPending ? mover.variables?.id : undefined}
        onMover={(id, coluna) => mover.mutate({ id, coluna })}
        onAbrir={(id) => setAberta(lista.find((t) => t.id === id) ?? null)}
      />

      {estado === "pronto" && tarefas.data?.temMais === true && (
        <p className="mt-3 text-[11px] text-warning">
          A página está cheia ({lista.length} tarefas) e pode haver mais. Estreite os filtros. A
          paginação chega com o volume real.
        </p>
      )}

      <FormularioDeTarefa
        aberto={formAberto}
        onFechar={() => setFormAberto(false)}
        catalogo={catalogo.data ?? []}
        time={time.data ?? []}
        clientes={clientes.data ?? []}
        estadoDoCatalogo={estadoDoCatalogo}
        estadoDoTime={estadoDoTime}
        estadoDosClientes={estadoDosClientes}
        salvando={criar.isPending}
        onCriar={(nova) => {
          criar.mutate(nova, { onSuccess: () => setFormAberto(false) });
        }}
      />

      {aberta !== null && (
        <DialogoDeTarefa
          key={aberta.id}
          tarefa={aberta}
          foraDaLista={daLista === undefined}
          onFechar={() => setAberta(null)}
        />
      )}
    </>
  );
}
