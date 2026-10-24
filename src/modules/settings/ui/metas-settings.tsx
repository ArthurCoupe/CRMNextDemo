import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { interpretarValorEmReais } from "@/modules/financial/domain/expenses";
import { brl } from "@/shared/lib/format";
import { useMudou } from "@/shared/lib/use-mudou";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";

import { useMetasDeAtividade, useMetasFinanceiras, useSalvarMetas } from "../hooks/use-settings";

interface Rascunho {
  toquesSemana: string;
  r1Semana: string;
  mrrMensal: string;
  tcvAlvo: string;
}

const VAZIO: Rascunho = { toquesSemana: "", r1Semana: "", mrrMensal: "", tcvAlvo: "" };

function paraTexto(valor: number | null): string {
  return valor === null ? "" : String(valor);
}

const TETO_INTEGER_POSTGRES = 2_147_483_647;

function inteiroPositivo(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d+$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isSafeInteger(n) && n > 0 && n <= TETO_INTEGER_POSTGRES ? n : null;
}

const MENSAGEM_META_NAO_INTEIRA = "Meta de atividade é número inteiro.";

function erroDeMetaDeAtividade(texto: string): string | null {
  return texto.trim() === "" || inteiroPositivo(texto) !== null ? null : MENSAGEM_META_NAO_INTEIRA;
}

const MENSAGEM_META_EM_REAIS_INVALIDA =
  "Valor em reais inválido. Use ponto para milhar e vírgula para decimais (ex.: 50.000 ou 1.500,50).";

function emReaisPositivo(texto: string): number | null {
  const valor = interpretarValorEmReais(texto);
  return valor !== null && valor > 0 ? valor : null;
}

function erroDeMetaFinanceira(texto: string): string | null {
  return texto.trim() === "" || emReaisPositivo(texto) !== null
    ? null
    : MENSAGEM_META_EM_REAIS_INVALIDA;
}

export function MetasSettings() {
  const atividade = useMetasDeAtividade();
  const financeiras = useMetasFinanceiras();
  const salvar = useSalvarMetas();
  const dadosDeAtividade = atividade.data;
  const dadosFinanceiros = financeiras.data;
  const lido =
    dadosDeAtividade === undefined || dadosFinanceiros === undefined
      ? null
      : {
          toquesSemana: paraTexto(dadosDeAtividade.toquesSemana),
          r1Semana: paraTexto(dadosDeAtividade.r1Semana),
          mrrMensal: paraTexto(dadosFinanceiros.mrrMensal),
          tcvAlvo: paraTexto(dadosFinanceiros.tcvAlvo),
        };

  const [rascunho, setRascunho] = useState<Rascunho>(() => lido ?? VAZIO);
  const mudouAtividade = useMudou(dadosDeAtividade);
  const mudouFinanceiro = useMudou(dadosFinanceiros);
  if ((mudouAtividade || mudouFinanceiro) && lido !== null) setRascunho(lido);

  const estado =
    estadoDaConsulta(atividade) === "erro" || estadoDaConsulta(financeiras) === "erro"
      ? "erro"
      : estadoDaConsulta(atividade) === "carregando" ||
          estadoDaConsulta(financeiras) === "carregando"
        ? "carregando"
        : "pronto";
  if (estado === "erro") return <FalhaAoLer oQue="as metas" />;
  if (estado === "carregando") {
    return <div className="h-64 animate-pulse rounded-xl border bg-card" />;
  }

  const numeros = {
    toquesSemana: inteiroPositivo(rascunho.toquesSemana),
    r1Semana: inteiroPositivo(rascunho.r1Semana),
    mrrMensal: emReaisPositivo(rascunho.mrrMensal),
    tcvAlvo: emReaisPositivo(rascunho.tcvAlvo),
  };
  const todosValidos = Object.values(numeros).every((n) => n !== null);
  const confirmado = dadosDeAtividade?.confirmado ?? false;

  return (
    <Card className="space-y-4 p-6 shadow-card">
      <div>
        <h3 className="text-lg font-semibold">Metas comerciais</h3>
        <p className="text-sm text-muted-foreground">
          O denominador do placar do Pipeline e do card de Meta no Resultado.
        </p>
      </div>

      {!confirmado && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-[13px] text-warning">
          Estes quatro números vieram do protótipo e <strong>ninguém os validou</strong>. Enquanto
          for assim, o placar do Pipeline mostra só o número; o Dashboard e o Resultado mostram o %
          com o selo “meta não confirmada”.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="toques"
          rotulo="Toques por semana"
          apoio="Contato registrado: ligação, reunião, proposta ou nota. Mudança de etapa não conta."
          valor={rascunho.toquesSemana}
          erro={erroDeMetaDeAtividade(rascunho.toquesSemana)}
          inputMode="numeric"
          onChange={(v) => setRascunho({ ...rascunho, toquesSemana: v })}
        />
        <Campo
          id="r1"
          rotulo="R1 marcadas por semana"
          apoio="Oportunidades que chegaram à etapa R1 na semana."
          valor={rascunho.r1Semana}
          erro={erroDeMetaDeAtividade(rascunho.r1Semana)}
          inputMode="numeric"
          onChange={(v) => setRascunho({ ...rascunho, r1Semana: v })}
        />
        <Campo
          id="mrr"
          rotulo="MRR mensal"
          apoio={numeros.mrrMensal === null ? "Em reais." : `Em reais: ${brl(numeros.mrrMensal)}`}
          valor={rascunho.mrrMensal}
          erro={erroDeMetaFinanceira(rascunho.mrrMensal)}
          onChange={(v) => setRascunho({ ...rascunho, mrrMensal: v })}
        />
        <Campo
          id="tcv"
          rotulo="TCV alvo"
          apoio={numeros.tcvAlvo === null ? "Em reais." : `Em reais: ${brl(numeros.tcvAlvo)}`}
          valor={rascunho.tcvAlvo}
          erro={erroDeMetaFinanceira(rascunho.tcvAlvo)}
          onChange={(v) => setRascunho({ ...rascunho, tcvAlvo: v })}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={!todosValidos || salvar.isPending}
          onClick={() => {
            const { toquesSemana, r1Semana, mrrMensal, tcvAlvo } = numeros;
            if (
              toquesSemana === null ||
              r1Semana === null ||
              mrrMensal === null ||
              tcvAlvo === null
            ) {
              return;
            }
            salvar.mutate({
              toquesSemana,
              r1Semana,
              mrrMensal,
              tcvAlvo,
              confirmado,
            });
          }}
        >
          Salvar metas
        </Button>
        {!todosValidos && (
          <span className="text-[11px] text-muted-foreground">
            Os quatro precisam ser números maiores que zero.
          </span>
        )}
      </div>
    </Card>
  );
}

function Campo({
  id,
  rotulo,
  apoio,
  valor,
  erro,
  inputMode = "decimal",
  onChange,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly apoio: string;
  readonly valor: string;
  readonly erro?: string | null;
  readonly inputMode?: "decimal" | "numeric";
  readonly onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        inputMode={inputMode}
        className="tabular-nums"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-[11px] text-muted-foreground">{apoio}</p>
      {erro != null && <p className="text-[11px] text-destructive">{erro}</p>}
    </div>
  );
}
