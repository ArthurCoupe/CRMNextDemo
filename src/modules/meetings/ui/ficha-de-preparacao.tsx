import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/shared/lib/date";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import type { Reuniao } from "../api/meetings.repository";
import { rotuloDoTipo } from "../domain/meeting";
import type { Secao } from "../domain/preparacao";
import { usePreparacao } from "../hooks/use-meetings";

export function FichaDePreparacao({
  reuniao,
  aoFechar,
}: {
  reuniao: Reuniao | null;
  aoFechar: () => void;
}) {
  const consulta = usePreparacao(reuniao);
  const estado = estadoDaConsulta(consulta);

  return (
    <Dialog open={reuniao !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          (evento.currentTarget as HTMLElement | null)?.focus();
        }}
        onEscapeKeyDown={() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        }}
      >
        {reuniao !== null && (
          <>
            <DialogHeader>
              <DialogTitle>Preparação: {reuniao.titulo}</DialogTitle>
              <DialogDescription className="text-xs">
                {formatDateTime(reuniao.startsAt)} · {rotuloDoTipo(reuniao.tipo)}
              </DialogDescription>
            </DialogHeader>

            {estado === "erro" ? (
              <div className="grid gap-2">
                <FalhaAoLer
                  oQue="a ficha de preparação"
                  mensagem="Tente de novo; se persistir, é falha de conexão com o banco."
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                  disabled={consulta.isFetching}
                  onClick={() => void consulta.refetch()}
                >
                  Tentar de novo
                </Button>
              </div>
            ) : estado === "carregando" ? (
              <div className="grid gap-2" aria-label="Carregando a ficha">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="grid gap-4">
                {(consulta.data ?? []).map((secao) => (
                  <BlocoDaSecao key={secao.chave} secao={secao} />
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BlocoDaSecao({ secao }: { secao: Secao }) {
  return (
    <section className="grid gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {secao.titulo}
      </h3>
      {secao.aviso !== null && <p className="text-[11px] text-muted-foreground">{secao.aviso}</p>}
      {secao.linhas.length === 0 ? (
        <p className="text-xs text-muted-foreground">{secao.vazio}</p>
      ) : (
        <ul className="grid gap-1">
          {secao.linhas.map((linha) => (
            <li
              key={linha.id}
              id={linha.id}
              className={
                linha.estado === "atencao"
                  ? "text-xs tabular-nums text-warning"
                  : "text-xs tabular-nums"
              }
            >
              {linha.estado === "atencao" && <span className="sr-only">Atenção: </span>}
              <span>{linha.texto}</span>
              {linha.detalhe !== null && (
                <span className="block text-[11px] text-muted-foreground">{linha.detalhe}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
