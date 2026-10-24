import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { OportunidadeParaSelecao } from "../api/meetings.repository";
import { LIMITE_DA_BUSCA_DE_OPORTUNIDADES, termoDaBuscaDeOportunidade } from "../domain/meeting";
import { useBuscaDeOportunidades } from "../hooks/use-meetings";

interface CampoDeOportunidadeProps {
  readonly escolhida: OportunidadeParaSelecao | null;
  readonly aoEscolher: (oportunidade: OportunidadeParaSelecao | null) => void;
}

export function CampoDeOportunidade({ escolhida, aoEscolher }: CampoDeOportunidadeProps) {
  const [digitado, setDigitado] = useState("");
  const busca = useBuscaDeOportunidades(escolhida === null ? digitado : "");

  if (escolhida !== null) {
    return (
      <div>
        <Label htmlFor="reuniao-oportunidade">Oportunidade</Label>
        <div className="mt-1 flex gap-2">
          <Input id="reuniao-oportunidade" value={escolhida.nome} readOnly />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDigitado("");
              aoEscolher(null);
            }}
          >
            Trocar
          </Button>
        </div>
      </div>
    );
  }

  const buscando = termoDaBuscaDeOportunidade(digitado) !== null;
  const achadas = buscando ? busca.data : undefined;
  const idDoStatus = "reuniao-oportunidade-status";

  return (
    <div>
      <Label htmlFor="reuniao-oportunidade">Oportunidade</Label>
      <Input
        id="reuniao-oportunidade"
        className="mt-1"
        placeholder="Digite parte do nome"
        autoComplete="off"
        aria-describedby={idDoStatus}
        value={digitado}
        onChange={(e) => setDigitado(e.target.value)}
      />

      {!buscando ? (
        <p id={idDoStatus} role="status" className="mt-1 text-xs text-muted-foreground">
          Digite ao menos 2 letras do nome.
        </p>
      ) : busca.isError ? (
        <p id={idDoStatus} role="alert" className="mt-1 text-xs text-destructive">
          Não deu para buscar as oportunidades. Confira a conexão e digite de novo.
        </p>
      ) : achadas === undefined ? (
        <p id={idDoStatus} role="status" className="mt-1 text-xs text-muted-foreground">
          Buscando…
        </p>
      ) : achadas.itens.length === 0 ? (
        <p id={idDoStatus} role="status" className="mt-1 text-xs text-muted-foreground">
          Nenhuma oportunidade com esse nome.
        </p>
      ) : (
        <>
          <ul
            aria-label="Oportunidades encontradas"
            className="mt-1 max-h-48 overflow-y-auto rounded-md border"
          >
            {achadas.itens.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => aoEscolher(o)}
                >
                  {o.nome}
                </button>
              </li>
            ))}
          </ul>
          {achadas.haMais && (
            <p id={idDoStatus} role="status" className="mt-1 text-xs text-muted-foreground">
              Mostrando as {LIMITE_DA_BUSCA_DE_OPORTUNIDADES} primeiras. Digite mais do nome para
              achar a certa.
            </p>
          )}
        </>
      )}
    </div>
  );
}
