import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { exigirPapel } from "@/integrations/supabase/papel";
import { aiAnalyze, carregarConversa, listarConversas } from "@/lib/ai.functions";
import {
  contagemDaPergunta,
  LIMITE_DE_CONVERSA_ABERTA,
  perguntaLongaDemais,
} from "@/modules/ai/domain/pergunta";
import { chavesDeConversas, useApagarConversa } from "@/modules/ai/hooks/use-conversas";
import { RenomearConversa } from "@/modules/ai/ui/renomear-conversa";
import { RespostaMarkdown } from "@/modules/ai/ui/resposta-markdown";
import { avisarErro } from "@/shared/lib/avisar-erro";
import { MODO_DEMO } from "@/shared/lib/demo";
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

export const Route = createFileRoute("/_authenticated/ai")({
  beforeLoad: ({ context }) => exigirPapel(["owner", "manager", "member"], context.papel),
  component: PaginaDaIa,
});

interface Mensagem {
  readonly papel: "usuario" | "assistente";
  readonly texto: string;
}

interface PerguntaSugerida {
  readonly texto: string;
  readonly soOwner?: boolean;
}

const PERGUNTAS_SUGERIDAS: readonly PerguntaSugerida[] = [
  { texto: "Quais tarefas minhas estão atrasadas?" },
  { texto: "Quais oportunidades estão paradas há mais tempo?" },
  { texto: "Quais onboardings estão em curso?" },
  { texto: "Quanto fechamos este mês?", soOwner: true },
];

export function PaginaDaIa() {
  const perguntar = useServerFn(aiAnalyze);
  const listar = useServerFn(listarConversas);
  const carregar = useServerFn(carregarConversa);
  const { papel } = useProfile();
  const qc = useQueryClient();

  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<readonly Mensagem[]>([]);
  const [historicoCortado, setHistoricoCortado] = useState(false);
  const [entrada, setEntrada] = useState("");
  const painel = useRef<HTMLDivElement>(null);

  const conversas = useQuery({ queryKey: chavesDeConversas.lista, queryFn: () => listar() });
  const estadoDasConversas = estadoDaConsulta(conversas);
  const apagar = useApagarConversa();
  const tituloDaAberta = conversas.data?.find((c) => c.id === conversaId)?.titulo ?? null;

  const perguntasVisiveis = PERGUNTAS_SUGERIDAS.filter((p) => !p.soOwner || papel === "owner");

  const novaConversa = () => {
    setConversaId(null);
    setMensagens([]);
    setHistoricoCortado(false);
    setEntrada("");
  };

  const abrirConversa = async (id: string) => {
    if (id === conversaId) return;
    try {
      const historico = await carregar({ data: { conversaId: id } });
      setConversaId(id);
      setHistoricoCortado(historico.length === LIMITE_DE_CONVERSA_ABERTA);
      setMensagens(
        historico.map((m) => ({
          papel: m.papel === "user" ? "usuario" : "assistente",
          texto: m.conteudo,
        })),
      );
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não consegui abrir a conversa");
    }
  };

  const envio = useMutation({
    mutationFn: async (prompt: string) => {
      const fluxo = await perguntar({
        data: conversaId === null ? { prompt } : { prompt, conversaId },
      });

      let comecouAResposta = false;
      let conversaIdRecebida: string | null = null;

      for await (const fragmento of fluxo) {
        if (fragmento.tipo === "delta") {
          if (!comecouAResposta) {
            comecouAResposta = true;
            setMensagens((m) => [...m, { papel: "assistente", texto: fragmento.texto }]);
          } else {
            setMensagens((m) => {
              const ultimo = m[m.length - 1];
              if (ultimo === undefined) return m;
              return [...m.slice(0, -1), { ...ultimo, texto: ultimo.texto + fragmento.texto }];
            });
          }
        } else if (fragmento.tipo === "interrompida") {
          toast.warning(`A resposta pode ter sido cortada (motivo: ${fragmento.motivo}).`);
        } else {
          conversaIdRecebida = fragmento.conversaId;
        }
      }

      return conversaIdRecebida;
    },
    onSuccess: (conversaIdRecebida) => {
      if (conversaIdRecebida !== null) setConversaId(conversaIdRecebida);
      void qc.invalidateQueries({ queryKey: chavesDeConversas.lista });
    },
    onError: avisarErro("Não foi possível perguntar."),
  });

  useEffect(() => {
    const el = painel.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
  }, [mensagens, envio.isPending]);

  const tamanhoDaPergunta = entrada.trim().length;
  const perguntaLonga = perguntaLongaDemais(tamanhoDaPergunta);

  const enviar = () => {
    const prompt = entrada.trim();
    if (prompt === "" || envio.isPending || perguntaLonga !== null) return;
    setMensagens((m) => [...m, { papel: "usuario", texto: prompt }]);
    envio.mutate(prompt);
    setEntrada("");
  };

  return (
    <>
      <PageHeader
        title="Assistente"
        description={
          MODO_DEMO
            ? "Resposta simulada na demonstração: nenhum provedor de IA é chamado"
            : "Gemini 3.6 Flash, com credencial própria da Next"
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {estadoDasConversas === "erro" ? (
          <FalhaAoLer oQue="o histórico de conversas" />
        ) : estadoDasConversas === "carregando" ? (
          <div className="h-9 w-full max-w-xs animate-pulse rounded-md border bg-card" />
        ) : (
          <Select
            value={conversaId ?? ""}
            onValueChange={(id) => void abrirConversa(id)}
            disabled={envio.isPending || apagar.isPending}
          >
            <SelectTrigger className="h-9 w-full max-w-xs text-sm">
              <SelectValue placeholder="Conversas recentes" />
            </SelectTrigger>
            <SelectContent>
              {(conversas.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.titulo ?? "(sem título)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={novaConversa}
          disabled={envio.isPending || apagar.isPending}
        >
          <Plus className="size-4" aria-hidden />
          Nova conversa
        </Button>
        {conversaId !== null && (
          <RenomearConversa
            key={conversaId}
            conversaId={conversaId}
            tituloAtual={tituloDaAberta}
            desabilitado={envio.isPending || apagar.isPending}
          />
        )}
        {conversaId !== null && (
          <DialogoDeExclusao
            gatilho={
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={envio.isPending || apagar.isPending}
              >
                <Trash2 className="size-4" aria-hidden />
                Apagar conversa
              </Button>
            }
            titulo={
              tituloDaAberta === null ? "Apagar esta conversa?" : `Apagar "${tituloDaAberta}"?`
            }
            pendente={apagar.isPending}
            onConfirmar={() => apagar.mutate(conversaId, { onSuccess: novaConversa })}
          >
            <p>Apaga a conversa e as mensagens dela.</p>
            <p>Não pode ser desfeito.</p>
          </DialogoDeExclusao>
        )}
      </div>

      <Card className="flex h-[60vh] flex-col p-4 shadow-card">
        <div ref={painel} className="flex-1 space-y-3 overflow-y-auto">
          {historicoCortado && (
            <p className="text-center text-[11px] text-muted-foreground">
              O começo desta conversa (antes das últimas {LIMITE_DE_CONVERSA_ABERTA} mensagens) pode
              não estar sendo mostrado.
            </p>
          )}
          {mensagens.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Sparkles className="size-6" aria-hidden />
              <p className="text-sm">Faça uma pergunta para começar.</p>
              <p className="text-xs">
                Ele enxerga o seu CRM: suas tarefas, o pipeline, os clientes e os onboardings.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {perguntasVisiveis.map((p) => (
                  <Button
                    key={p.texto}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEntrada(p.texto)}
                  >
                    {p.texto}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) => (
            <div key={i} className={m.papel === "usuario" ? "text-right" : "text-left"}>
              {m.papel === "usuario" ? (
                <span className="inline-block max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-left text-sm text-primary-foreground">
                  {m.texto}
                </span>
              ) : (
                <span className="inline-block max-w-[80%] rounded-lg bg-muted px-3 py-2 text-left text-sm">
                  <RespostaMarkdown texto={m.texto} />
                </span>
              )}
            </div>
          ))}

          {envio.isPending && <p className="text-sm text-muted-foreground">Pensando…</p>}
        </div>

        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Pergunte alguma coisa…"
              rows={2}
              className="resize-none"
              aria-label="Pergunta para o assistente"
              aria-describedby="contagem-da-pergunta"
            />
            <p
              id="contagem-da-pergunta"
              role={perguntaLonga === null ? undefined : "alert"}
              className={`mt-1 text-right text-xs tabular-nums ${
                perguntaLonga === null ? "text-muted-foreground" : "text-destructive"
              }`}
            >
              {perguntaLonga ?? contagemDaPergunta(tamanhoDaPergunta)}
            </p>
          </div>
          <Button
            onClick={enviar}
            disabled={envio.isPending || tamanhoDaPergunta === 0 || perguntaLonga !== null}
            title={perguntaLonga ?? undefined}
          >
            <Send className="size-4" aria-hidden />
            <span className="sr-only">Enviar</span>
          </Button>
        </div>
      </Card>
    </>
  );
}
