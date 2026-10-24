import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rotuloDoTipo } from "@/modules/scripts/domain/script";
import { useRegistrarUso, useScriptsDeWhatsApp } from "@/modules/scripts/hooks/use-scripts";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { OportunidadeListada } from "../api/pipeline.repository";
import {
  montarLinkDeConversa,
  ordenarScriptsParaOportunidade,
  telefoneDeOutroPais,
  telefoneParaWhatsApp,
  textoDoToque,
} from "../domain/whatsapp";
import { useRegistrarToque } from "../hooks/use-pipeline";

type DadosDoBloco = Pick<
  OportunidadeListada,
  "id" | "nicho" | "estagio" | "contatoNome" | "contatoTelefone"
>;

interface Pendente {
  readonly scriptId: string | null;
  readonly titulo: string | null;
}

const ITEM =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BlocoDeWhatsApp({ oportunidade }: { oportunidade: DadosDoBloco }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const registrarToque = useRegistrarToque();
  const registrarUso = useRegistrarUso();
  const consulta = useScriptsDeWhatsApp(aberto);
  const estado = estadoDaConsulta(consulta);
  const telefone = telefoneParaWhatsApp(oportunidade.contatoTelefone);
  const ordenados =
    estado === "pronto" ? ordenarScriptsParaOportunidade(consulta.data ?? [], oportunidade) : [];

  function abrirConversa(scriptId: string | null, titulo: string | null) {
    setAberto(false);
    setPendente({ scriptId, titulo });
  }

  async function aoRegistrar() {
    if (pendente === null) return;
    const alvo = pendente;
    const { scriptId, titulo } = alvo;
    try {
      await registrarToque.mutateAsync({
        oportunidadeId: oportunidade.id,
        tipo: "whatsapp",
        texto: textoDoToque(titulo),
      });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível registrar o toque.");
      return;
    }
    setPendente((atual) => (atual === alvo ? null : atual));
    toast.success("Toque registrado.");
    if (scriptId !== null) registrarUso.mutate(scriptId);
  }

  return (
    <div className="grid gap-1.5">
      {telefone === null ? (
        <>
          <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled>
            WhatsApp
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {telefoneDeOutroPais(oportunidade.contatoTelefone)
              ? "Número de fora do Brasil: o botão só abre conversa com número brasileiro."
              : "Telefone sem DDD ou inválido. Corrija no campo Telefone."}
          </p>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            aria-expanded={aberto}
            onClick={() => setAberto((valor) => !valor)}
          >
            WhatsApp
          </Button>
          {aberto && (
            <div className="grid max-h-72 gap-0.5 overflow-y-auto rounded-md border p-1">
              {estado === "carregando" && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando…</p>
              )}
              {estado === "erro" && (
                <FalhaAoLer
                  oQue="os scripts de WhatsApp"
                  mensagem="Ainda dá para abrir a conversa sem script."
                />
              )}
              {estado === "pronto" && ordenados.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  Nenhum script de WhatsApp ativo. Cadastre em Scripts.
                </p>
              )}
              {ordenados.map(({ script, sugerido }) => (
                <a
                  key={script.id}
                  href={montarLinkDeConversa(telefone, script.body)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ITEM}
                  onClick={() => abrirConversa(script.id, script.title)}
                >
                  <span className="min-w-0 flex-1 truncate">{script.title}</span>
                  {sugerido && <Badge>Sugerido</Badge>}
                  <span className="text-[11px] text-muted-foreground">
                    {rotuloDoTipo(script.tipo)}
                  </span>
                </a>
              ))}
              <a
                href={montarLinkDeConversa(telefone, "")}
                target="_blank"
                rel="noopener noreferrer"
                className={ITEM}
                onClick={() => abrirConversa(null, null)}
              >
                Sem script
              </a>
            </div>
          )}
        </>
      )}

      {pendente !== null && (
        <div role="status" className="grid gap-2 rounded-md border bg-muted/40 p-2">
          <p className="text-xs">
            Mandou a mensagem para {oportunidade.contatoNome ?? "o contato"}?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={registrarToque.isPending}
              onClick={() => void aoRegistrar()}
            >
              Registrar toque
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={registrarToque.isPending}
              onClick={() => setPendente(null)}
            >
              Não mandei
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
