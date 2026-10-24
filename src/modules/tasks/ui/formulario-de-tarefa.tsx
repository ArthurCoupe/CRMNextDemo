import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ehDataCivilPlausivel, todaySP } from "@/shared/lib/date";
import type { EstadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { ItemDoCatalogo, NovaTarefa, PessoaDoTime } from "../api/tasks.repository";
import {
  ehRecorrencia,
  LIMITE_DA_DESCRICAO,
  ROTULO_DA_PRIORIDADE,
  ROTULO_DA_RECORRENCIA,
} from "../domain/task";
import type { PrioridadeDaTarefa, RecorrenciaDaTarefa } from "../domain/task";

export function FormularioDeTarefa({
  aberto,
  onFechar,
  catalogo,
  time,
  clientes,
  estadoDoCatalogo,
  estadoDoTime,
  estadoDosClientes,
  onCriar,
  salvando,
}: {
  readonly aberto: boolean;
  readonly onFechar: () => void;
  readonly catalogo: readonly ItemDoCatalogo[];
  readonly time: readonly PessoaDoTime[];
  readonly clientes: readonly { id: string; nome: string }[];
  readonly estadoDoCatalogo: EstadoDaConsulta;
  readonly estadoDoTime: EstadoDaConsulta;
  readonly estadoDosClientes: EstadoDaConsulta;
  readonly onCriar: (nova: NovaTarefa) => void;
  readonly salvando: boolean;
}) {
  const categorias = useMemo(() => [...new Set(catalogo.map((c) => c.categoria))], [catalogo]);

  const [categoria, setCategoria] = useState("");
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState<PrioridadeDaTarefa>("media");
  const [recorrencia, setRecorrencia] = useState<RecorrenciaDaTarefa>("nenhuma");
  const [participantes, setParticipantes] = useState<readonly string[]>([]);

  const tipos = catalogo.filter((c) => c.categoria === categoria);
  const candidatos = time.filter((p) => p.id !== responsavelId);
  const prazoPlausivel = prazo === "" || ehDataCivilPlausivel(prazo);
  const tamanhoDaDescricao = descricao.trim().length;
  const descricaoCabe = tamanhoDaDescricao <= LIMITE_DA_DESCRICAO;
  const podeSalvar =
    categoria !== "" &&
    tipo !== "" &&
    titulo.trim() !== "" &&
    prazoPlausivel &&
    descricaoCabe &&
    estadoDoTime === "pronto" &&
    !salvando;

  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto) {
      setCategoria("");
      setTipo("");
      setTitulo("");
      setDescricao("");
      setResponsavelId("");
      setClienteId("");
      setPrazo("");
      setPrioridade("media");
      setRecorrencia("nenhuma");
      setParticipantes([]);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="cat">Categoria</Label>
            {estadoDoCatalogo === "erro" && (
              <FalhaAoLer
                oQue="os tipos de tarefa"
                mensagem="Recarregue a página e tente de novo."
              />
            )}
            <select
              id="cat"
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50"
              value={categoria}
              disabled={estadoDoCatalogo !== "pronto"}
              onChange={(e) => {
                setCategoria(e.target.value);
                setTipo("");
              }}
            >
              <option value="">Escolha…</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50"
              value={tipo}
              disabled={categoria === ""}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="">
                {categoria === "" ? "Escolha a categoria antes" : "Escolha…"}
              </option>
              {tipos.map((t) => (
                <option key={t.tipo} value={t.tipo}>
                  {t.tipo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              className="mt-1"
              value={titulo}
              placeholder={tipo === "" ? "" : `${tipo} (para quem, ou sobre o quê)`}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              className="mt-1 min-h-20"
              value={descricao}
              placeholder="Opcional: o que fazer, links, combinados…"
              aria-invalid={!descricaoCabe}
              aria-describedby={descricaoCabe ? undefined : "descricao-acima-do-limite"}
              onChange={(e) => setDescricao(e.target.value)}
            />
            {!descricaoCabe && (
              <div id="descricao-acima-do-limite" className="mt-1 text-[11px] text-destructive">
                <p role="alert">Descrição acima do limite de {LIMITE_DA_DESCRICAO} caracteres.</p>
                <p>{tamanhoDaDescricao} caracteres agora.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="resp">Responsável</Label>
              {estadoDoTime === "erro" && (
                <FalhaAoLer oQue="o time" mensagem="Recarregue a página e tente de novo." />
              )}
              <select
                id="resp"
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50"
                value={responsavelId}
                disabled={estadoDoTime !== "pronto"}
                onChange={(e) => setResponsavelId(e.target.value)}
              >
                <option value="">Sem responsável</option>
                {time.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="cli">Cliente</Label>
              {estadoDosClientes === "erro" && (
                <FalhaAoLer
                  oQue="a lista de clientes"
                  mensagem="Recarregue a página e tente de novo."
                />
              )}
              <select
                id="cli"
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50"
                value={clienteId}
                disabled={estadoDosClientes !== "pronto"}
                onChange={(e) => setClienteId(e.target.value)}
              >
                <option value="">Nenhum</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {estadoDoTime === "pronto" && (
            <fieldset>
              <legend className="text-sm font-medium">Participantes</legend>
              {candidatos.length === 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Ninguém para incluir.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {candidatos.map((p) => (
                    <label key={p.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={participantes.includes(p.id)}
                        onChange={(e) =>
                          setParticipantes((atual) =>
                            e.target.checked ? [...atual, p.id] : atual.filter((id) => id !== p.id),
                          )
                        }
                      />
                      {p.nome}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prazo">Prazo</Label>
              <Input
                id="prazo"
                type="date"
                className="mt-1"
                value={prazo}
                min={todaySP()}
                onChange={(e) => setPrazo(e.target.value)}
              />
              {!prazoPlausivel && (
                <p role="alert" className="mt-1 text-[11px] text-destructive">
                  Prazo inválido. Use um ano entre 2000 e 2100.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="prio">Prioridade</Label>
              <select
                id="prio"
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as PrioridadeDaTarefa)}
              >
                {(Object.keys(ROTULO_DA_PRIORIDADE) as PrioridadeDaTarefa[]).map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_DA_PRIORIDADE[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="rec">Repetição</Label>
            <select
              id="rec"
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={recorrencia}
              onChange={(e) => {
                if (ehRecorrencia(e.target.value)) setRecorrencia(e.target.value);
              }}
            >
              {(Object.keys(ROTULO_DA_RECORRENCIA) as RecorrenciaDaTarefa[]).map((r) => (
                <option key={r} value={r}>
                  {ROTULO_DA_RECORRENCIA[r]}
                </option>
              ))}
            </select>
            {recorrencia !== "nenhuma" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                A próxima ocorrência nasce quando esta for concluída, não numa varredura noturna.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!podeSalvar}
            onClick={() => {
              onCriar({
                titulo: titulo.trim(),
                descricao: descricao.trim() === "" ? null : descricao.trim(),
                categoria,
                tipo,
                responsavelId: responsavelId === "" ? null : responsavelId,
                clienteId: clienteId === "" ? null : clienteId,
                prazo: prazo === "" ? null : prazo,
                prioridade,
                recorrencia,
                participantes: participantes.filter((id) => id !== responsavelId),
              });
            }}
          >
            {salvando ? "Criando…" : "Criar tarefa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
