import { Check, Lock, Pencil, Play } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";

import {
  concluidosNaEtapa,
  estadoDaEtapa,
  papeisSemPessoa,
  pendentesAntesDe,
  primeiraBloqueada,
  progressoDaJornada,
  proximaLiberavel,
  type EdicaoDaEtapa,
  type EdicaoDoItem,
  type EtapaDaJornada,
  type ItemDaJornada,
  type Jornada,
} from "../domain/onboarding";

const EDITAR =
  "-m-1.5 rounded-sm p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const SELECT =
  "mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50";

export const NOTA_DO_CARTAO =
  "Cartão aberto no quadro recebe o título e o prazo novos, se ninguém os mudou lá. O responsável do cartão não muda.";

export function VisaoDaJornada({
  jornada,
  papeisComPessoa,
  papeisComPessoaDesativada,
  onLiberar,
  onMarcar,
  liberando,
  podeEscrever,
  ondeResolver,
  podeApagar,
  apagando,
  onApagar,
  papeisDisponiveis,
  editando,
  onEditarEtapa,
  onEditarItem,
}: {
  readonly jornada: Jornada;
  readonly papeisComPessoa: readonly string[];
  readonly papeisComPessoaDesativada: readonly string[];
  readonly onLiberar: (etapaId: string, forcar: boolean) => void;
  readonly onMarcar: (itemId: string, concluido: boolean) => void;
  readonly liberando: boolean;
  readonly podeEscrever: boolean;
  readonly ondeResolver: string | null;
  readonly podeApagar: boolean;
  readonly apagando: boolean;
  readonly onApagar: (jornadaId: string) => void;
  readonly papeisDisponiveis: readonly string[];
  readonly editando: boolean;
  readonly onEditarEtapa: (etapaId: string, campos: EdicaoDaEtapa, aoSalvar: () => void) => void;
  readonly onEditarItem: (itemId: string, campos: EdicaoDoItem, aoSalvar: () => void) => void;
}) {
  const progresso = progressoDaJornada(jornada);
  const liberavel = proximaLiberavel(jornada);
  const bloqueada = primeiraBloqueada(jornada);
  const pct = progresso.total === 0 ? 0 : (progresso.concluidas / progresso.total) * 100;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{jornada.cliente}</h3>
            <p className="text-[11px] text-muted-foreground">
              Método v{jornada.versaoDoMetodo} · aberta em{" "}
              {new Date(jornada.iniciadaEm).toLocaleDateString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm tabular-nums">
              <strong>{progresso.concluidas}</strong>
              <span className="text-muted-foreground"> de {progresso.total} etapas</span>
            </p>
            {podeApagar && (
              <DialogoDeExclusao
                gatilho={
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8"
                    disabled={apagando}
                  >
                    Apagar jornada
                  </Button>
                }
                titulo={`Apagar a jornada de "${jornada.cliente}"?`}
                pendente={apagando}
                onConfirmar={() => onApagar(jornada.id)}
              >
                <p>
                  Apaga a jornada com as etapas, os itens e os cartões que ela criou no quadro de
                  tarefas, com as ocorrências recorrentes deles.
                </p>
                <p>Depois dá para abrir uma jornada nova para o cliente.</p>
                <p>Não pode ser desfeito.</p>
              </DialogoDeExclusao>
            )}
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Uma etapa só conta quando todos os itens dela estão concluídos.
        </p>
      </div>

      {jornada.etapas.map((etapa) => (
        <CartaoDaEtapa
          key={etapa.id}
          etapa={etapa}
          ehAProximaLiberavel={liberavel?.id === etapa.id}
          ehAPrimeiraBloqueada={bloqueada?.id === etapa.id}
          papeisFaltando={papeisSemPessoa(etapa, papeisComPessoa)}
          papeisComPessoaDesativada={papeisComPessoaDesativada}
          ondeResolver={ondeResolver}
          onLiberar={(forcar) => onLiberar(etapa.id, forcar)}
          pendentesNaAnterior={pendentesAntesDe(jornada, etapa)}
          onMarcar={onMarcar}
          liberando={liberando}
          podeEscrever={podeEscrever}
          papeisDisponiveis={papeisDisponiveis}
          editando={editando}
          onEditarEtapa={(campos, aoSalvar) => onEditarEtapa(etapa.id, campos, aoSalvar)}
          onEditarItem={onEditarItem}
        />
      ))}
    </div>
  );
}

function CartaoDaEtapa({
  etapa,
  ehAProximaLiberavel,
  ehAPrimeiraBloqueada,
  papeisFaltando,
  papeisComPessoaDesativada,
  ondeResolver,
  pendentesNaAnterior,
  onLiberar,
  onMarcar,
  liberando,
  podeEscrever,
  papeisDisponiveis,
  editando,
  onEditarEtapa,
  onEditarItem,
}: {
  readonly etapa: EtapaDaJornada;
  readonly ehAProximaLiberavel: boolean;
  readonly ehAPrimeiraBloqueada: boolean;
  readonly papeisFaltando: readonly string[];
  readonly papeisComPessoaDesativada: readonly string[];
  readonly ondeResolver: string | null;
  readonly onLiberar: (forcar: boolean) => void;
  readonly pendentesNaAnterior: number;
  readonly onMarcar: (itemId: string, concluido: boolean) => void;
  readonly liberando: boolean;
  readonly podeEscrever: boolean;
  readonly papeisDisponiveis: readonly string[];
  readonly editando: boolean;
  readonly onEditarEtapa: (campos: EdicaoDaEtapa, aoSalvar: () => void) => void;
  readonly onEditarItem: (itemId: string, campos: EdicaoDoItem, aoSalvar: () => void) => void;
}) {
  const estado = estadoDaEtapa(etapa);
  const feitos = concluidosNaEtapa(etapa);
  const [editandoEtapa, setEditandoEtapa] = useState(false);
  const [itemEmEdicao, setItemEmEdicao] = useState<string | null>(null);

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {estado === "concluida" ? (
              <Check className="h-4 w-4 text-success" aria-hidden />
            ) : estado === "bloqueada" ? (
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
            ) : (
              <Play className="h-4 w-4 text-primary-texto" aria-hidden />
            )}
            <h4 className="truncate text-sm font-semibold">{etapa.nome}</h4>
            {podeEscrever && !editandoEtapa && (
              <button
                type="button"
                aria-label={`Editar etapa ${etapa.nome}`}
                className={EDITAR}
                disabled={editando}
                onClick={() => setEditandoEtapa(true)}
              >
                <Pencil className="h-3 w-3" aria-hidden />
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {etapa.periodo} · {etapa.responsavel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{etapa.descricao}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {feitos} / {etapa.itens.length}
          </p>
          {estado === "bloqueada" && ehAProximaLiberavel && podeEscrever && (
            <Button
              type="button"
              size="sm"
              className="mt-2 h-8"
              disabled={liberando || papeisFaltando.length > 0}
              onClick={() => onLiberar(false)}
            >
              Liberar etapa
            </Button>
          )}

          {estado === "bloqueada" &&
            ehAPrimeiraBloqueada &&
            ehAProximaLiberavel === false &&
            podeEscrever &&
            pendentesNaAnterior > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-8"
                disabled={liberando || papeisFaltando.length > 0}
                onClick={() => {
                  const frase =
                    `A etapa anterior ainda tem ${pendentesNaAnterior} ` +
                    `${pendentesNaAnterior === 1 ? "item pendente" : "itens pendentes"}.\n\n` +
                    `Forçar o avanço libera ESTA etapa mesmo assim. As seguintes ` +
                    `continuam bloqueadas enquanto tiverem item aberto.\n\n` +
                    `Os pendentes não são tocados: seguem abertos, e os que já ` +
                    `viraram cartão seguem no quadro de quem os tem. Nada é ` +
                    `cancelado nem reatribuído.\n\nForçar?`;
                  if (window.confirm(frase)) onLiberar(true);
                }}
              >
                Forçar avanço
              </Button>
            )}
        </div>
      </header>

      {editandoEtapa && (
        <FormularioDaEtapa
          etapa={etapa}
          editando={editando}
          onSalvar={(campos) => onEditarEtapa(campos, () => setEditandoEtapa(false))}
          onCancelar={() => setEditandoEtapa(false)}
        />
      )}

      {estado === "bloqueada" && ehAProximaLiberavel && papeisFaltando.length > 0 && (
        <p className="border-b bg-warning/10 px-4 py-2 text-[11px] text-warning">
          Falta configurar quem responde por{" "}
          <strong>
            {papeisFaltando
              .map((p) =>
                papeisComPessoaDesativada.includes(p)
                  ? `${p} (pessoa desativada, precisa de troca)`
                  : p,
              )
              .join(", ")}
          </strong>
          . Sem isso, a etapa criaria tarefa sem dono.
          {ondeResolver !== null && ` ${ondeResolver}`}
        </p>
      )}

      {estado === "bloqueada" ? (
        <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">
          {ehAProximaLiberavel
            ? "Ainda não liberada. Liberar cria as tarefas no quadro, com responsável e prazo."
            : "Ainda não liberada. A etapa anterior precisa terminar primeiro."}
        </p>
      ) : (
        <ul className="divide-y">
          {etapa.itens.map((item) => {
            const concluido = item.concluidoEm !== null;
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)] disabled:opacity-60"
                  checked={concluido}
                  disabled={!podeEscrever}
                  aria-label={item.titulo}
                  onChange={(e) => onMarcar(item.id, e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      concluido
                        ? "text-xs text-muted-foreground line-through"
                        : "text-xs text-foreground"
                    }
                  >
                    {item.titulo}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.papel} · prazo D+{item.prazoEmDias}
                    {item.tarefaId === null && " · sem cartão no quadro"}
                  </p>
                  {itemEmEdicao === item.id && (
                    <FormularioDoItem
                      item={item}
                      papeis={papeisDisponiveis}
                      editando={editando}
                      onSalvar={(campos) =>
                        onEditarItem(item.id, campos, () =>
                          setItemEmEdicao((atual) => (atual === item.id ? null : atual)),
                        )
                      }
                      onCancelar={() => setItemEmEdicao(null)}
                    />
                  )}
                </div>
                {podeEscrever && itemEmEdicao !== item.id && (
                  <button
                    type="button"
                    aria-label={`Editar item ${item.titulo}`}
                    className={EDITAR}
                    disabled={editando || (itemEmEdicao !== null && itemEmEdicao !== item.id)}
                    onClick={() => setItemEmEdicao(item.id)}
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FormularioDaEtapa({
  etapa,
  editando,
  onSalvar,
  onCancelar,
}: {
  readonly etapa: EtapaDaJornada;
  readonly editando: boolean;
  readonly onSalvar: (campos: EdicaoDaEtapa) => void;
  readonly onCancelar: () => void;
}) {
  const [descricao, setDescricao] = useState(etapa.descricao);
  const [responsavel, setResponsavel] = useState(etapa.responsavel);
  return (
    <fieldset disabled={editando} className="grid min-w-0 gap-2 border-b px-4 py-3">
      <div>
        <Label htmlFor={`descricao-${etapa.id}`}>Descrição da etapa</Label>
        <Textarea
          id={`descricao-${etapa.id}`}
          value={descricao}
          maxLength={2000}
          autoFocus
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`responsavel-${etapa.id}`}>Responsável da etapa</Label>
        <Input
          id={`responsavel-${etapa.id}`}
          value={responsavel}
          maxLength={200}
          onChange={(e) => setResponsavel(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => onSalvar({ descricao, responsavel })}>
          Salvar etapa
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </fieldset>
  );
}

function FormularioDoItem({
  item,
  papeis,
  editando,
  onSalvar,
  onCancelar,
}: {
  readonly item: ItemDaJornada;
  readonly papeis: readonly string[];
  readonly editando: boolean;
  readonly onSalvar: (campos: EdicaoDoItem) => void;
  readonly onCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(item.titulo);
  const [prazo, setPrazo] = useState(String(item.prazoEmDias));
  const [papel, setPapel] = useState(item.papel);
  const opcoes = papeis.includes(item.papel) ? papeis : [item.papel, ...papeis];
  return (
    <fieldset disabled={editando} className="mt-2 grid min-w-0 gap-2">
      <div>
        <Label htmlFor={`titulo-${item.id}`}>Título do item</Label>
        <Input
          id={`titulo-${item.id}`}
          value={titulo}
          maxLength={200}
          autoFocus
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`prazo-${item.id}`}>Prazo em dias</Label>
          <Input
            id={`prazo-${item.id}`}
            type="number"
            min={0}
            max={365}
            step={1}
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`papel-${item.id}`}>Papel</Label>
          <select
            id={`papel-${item.id}`}
            className={SELECT}
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
          >
            {opcoes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
      {item.tarefaId !== null && item.concluidoEm === null && (
        <p className="text-[11px] text-muted-foreground">{NOTA_DO_CARTAO}</p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() =>
            onSalvar({
              titulo,
              prazoEmDias: prazo.trim() === "" ? Number.NaN : Number(prazo),
              papel,
            })
          }
        >
          Salvar item
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </fieldset>
  );
}
