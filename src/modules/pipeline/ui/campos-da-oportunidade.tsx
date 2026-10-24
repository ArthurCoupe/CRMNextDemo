import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { interpretarValorEmReais } from "@/modules/financial/domain/expenses";
import { CampoEditavel } from "@/shared/ui/campo-editavel";

import {
  type CampoDoPipeline,
  rotuloDoValor,
  type ValorDeCampo,
  type ValoresDeCampos,
} from "../domain/campos";
import { TAMANHO_DO_TEXTO_DO_CAMPO } from "../domain/limites";

const SEM_VALOR = "sem-valor";

function porOrdem(a: CampoDoPipeline, b: CampoDoPipeline): number {
  return a.ordem - b.ordem;
}

function mesclar(
  valores: ValoresDeCampos,
  id: string,
  novo: ValorDeCampo | undefined,
): ValoresDeCampos {
  if (novo !== undefined) return { ...valores, [id]: novo };
  return Object.fromEntries(Object.entries(valores).filter(([chave]) => chave !== id));
}

function assinaturaDe(valores: ValoresDeCampos): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(valores).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  );
}

function numeroDoTexto(texto: string): number | null | undefined {
  if (texto.trim() === "") return undefined;
  return interpretarValorEmReais(texto);
}

function opcoesComOGravado(campo: CampoDoPipeline, valor: ValorDeCampo | undefined) {
  const opcoes = campo.opcoes ?? [];
  return typeof valor === "string" && valor !== "" && !opcoes.includes(valor)
    ? [...opcoes, valor]
    : opcoes;
}

function LinhaSoLeitura({ campo, valor }: { campo: CampoDoPipeline; valor?: ValorDeCampo }) {
  const rotulo = rotuloDoValor(campo, valor);
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground">
        {campo.nome}
        {!campo.ativo && " (campo desativado)"}
      </span>
      <span className="text-right font-medium">{rotulo === "" ? "-" : rotulo}</span>
    </div>
  );
}

export function BlocoDeCampos({
  campos,
  valores: valoresDoServidor,
  podeEditar,
  aoGravar,
}: {
  campos: readonly CampoDoPipeline[];
  valores: ValoresDeCampos;
  podeEditar: boolean;
  aoGravar: (valores: ValoresDeCampos) => Promise<void>;
}) {
  const [valores, setValores] = useState(valoresDoServidor);
  const assinatura = assinaturaDe(valoresDoServidor);
  const aplicada = useRef(assinatura);
  useEffect(() => {
    if (aplicada.current === assinatura) return;
    aplicada.current = assinatura;
    setValores(valoresDoServidor);
  }, [assinatura, valoresDoServidor]);

  const visiveis = campos.filter((c) => c.ativo || valores[c.id] !== undefined).sort(porOrdem);
  if (visiveis.length === 0) return null;

  const gravar = (id: string, novo: ValorDeCampo | undefined) => {
    const anterior = valores[id];
    const proximo = mesclar(valores, id, novo);
    setValores(proximo);
    void aoGravar(proximo).catch(() => setValores((atual) => mesclar(atual, id, anterior)));
  };

  return (
    <section className="grid gap-1.5 rounded-lg border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Campos do pipeline
      </h3>
      {visiveis.map((campo) => {
        const valor = valores[campo.id];
        if (!podeEditar || !campo.ativo) {
          return <LinhaSoLeitura key={campo.id} campo={campo} valor={valor} />;
        }
        const id = `campo-${campo.id}`;
        switch (campo.tipo) {
          case "texto":
            return (
              <CampoEditavel
                key={campo.id}
                id={id}
                rotulo={campo.nome}
                valor={valor === undefined ? null : String(valor)}
                disabled={false}
                maxLength={TAMANHO_DO_TEXTO_DO_CAMPO}
                onGravar={(texto) =>
                  gravar(campo.id, texto.trim() === "" ? undefined : texto.trim())
                }
              />
            );
          case "numero": {
            const rotulo = rotuloDoValor(campo, valor);
            return (
              <div key={campo.id} className="grid gap-1">
                <Label htmlFor={id} className="text-[11px] text-muted-foreground">
                  {campo.nome}
                </Label>
                <Input
                  key={rotulo}
                  id={id}
                  inputMode="decimal"
                  defaultValue={rotulo}
                  className="h-8 text-xs"
                  onBlur={(evento) => {
                    const texto = evento.target.value;
                    if (texto === rotulo) return;
                    const numero = numeroDoTexto(texto);
                    if (numero === null) {
                      toast.error(`${campo.nome}: '${texto}' não é um número.`);
                      return;
                    }
                    gravar(campo.id, numero);
                  }}
                />
              </div>
            );
          }
          case "sim_nao":
            return (
              <div key={campo.id} className="flex items-center justify-between gap-3">
                <Label htmlFor={id} className="text-[11px] text-muted-foreground">
                  {campo.nome}
                </Label>
                <span className="flex items-center gap-2">
                  {valor === undefined && (
                    <span className="text-[11px] italic text-muted-foreground">sem resposta</span>
                  )}
                  <Switch
                    id={id}
                    checked={valor === true}
                    onCheckedChange={(marcado) => gravar(campo.id, marcado)}
                  />
                </span>
              </div>
            );
          case "lista":
            return (
              <div key={campo.id} className="grid gap-1">
                <Label htmlFor={id} className="text-[11px] text-muted-foreground">
                  {campo.nome}
                </Label>
                <Select
                  value={typeof valor === "string" && valor !== "" ? valor : SEM_VALOR}
                  onValueChange={(escolha) =>
                    gravar(campo.id, escolha === SEM_VALOR ? undefined : escolha)
                  }
                >
                  <SelectTrigger id={id} className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>Sem valor</SelectItem>
                    {opcoesComOGravado(campo, valor).map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {opcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
        }
      })}
    </section>
  );
}

export function CamposDoFormulario({
  campos,
  valores,
  aoMudar,
  problemas,
  prefixoDoId,
}: {
  campos: readonly CampoDoPipeline[];
  valores: ValoresDeCampos;
  aoMudar: (valores: ValoresDeCampos) => void;
  problemas: string | null;
  prefixoDoId?: string;
}) {
  const prefixoGerado = useId();
  const prefixo = prefixoDoId ?? prefixoGerado;
  const ativos = campos.filter((c) => c.ativo).sort(porOrdem);
  if (ativos.length === 0) return null;

  const mudar = (id: string, novo: ValorDeCampo | undefined) => aoMudar(mesclar(valores, id, novo));

  const numeroInvalido = ativos.find(
    (c) => c.tipo === "numero" && typeof valores[c.id] === "string",
  );
  const aviso =
    numeroInvalido === undefined
      ? problemas
      : `${numeroInvalido.nome}: '${String(valores[numeroInvalido.id])}' não é um número`;

  return (
    <div className="grid gap-3">
      {ativos.map((campo) => {
        const valor = valores[campo.id];
        const id = `${prefixo}-campo-${campo.id}`;
        const rotulo = campo.obrigatorio ? `${campo.nome} *` : campo.nome;
        const obrigatorio = campo.obrigatorio || undefined;
        switch (campo.tipo) {
          case "texto":
            return (
              <div key={campo.id} className="grid gap-1.5">
                <Label htmlFor={id}>{rotulo}</Label>
                <Input
                  id={id}
                  value={typeof valor === "string" ? valor : ""}
                  maxLength={TAMANHO_DO_TEXTO_DO_CAMPO}
                  aria-required={obrigatorio}
                  onChange={(evento) =>
                    mudar(campo.id, evento.target.value === "" ? undefined : evento.target.value)
                  }
                />
              </div>
            );
          case "numero":
            return (
              <div key={campo.id} className="grid gap-1.5">
                <Label htmlFor={id}>{rotulo}</Label>
                <Input
                  id={id}
                  inputMode="decimal"
                  defaultValue={typeof valor === "string" ? valor : rotuloDoValor(campo, valor)}
                  aria-required={obrigatorio}
                  onChange={(evento) => {
                    const texto = evento.target.value;
                    mudar(
                      campo.id,
                      numeroDoTexto(texto) ?? (texto.trim() === "" ? undefined : texto),
                    );
                  }}
                />
              </div>
            );
          case "sim_nao":
            return (
              <div key={campo.id} className="grid gap-1.5">
                <Label htmlFor={id}>{rotulo}</Label>
                <Select
                  value={typeof valor === "boolean" ? String(valor) : SEM_VALOR}
                  onValueChange={(escolha) =>
                    mudar(campo.id, escolha === SEM_VALOR ? undefined : escolha === "true")
                  }
                >
                  <SelectTrigger id={id} aria-required={obrigatorio}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>-</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          case "lista":
            return (
              <div key={campo.id} className="grid gap-1.5">
                <Label htmlFor={id}>{rotulo}</Label>
                <Select
                  value={typeof valor === "string" && valor !== "" ? valor : SEM_VALOR}
                  onValueChange={(escolha) =>
                    mudar(campo.id, escolha === SEM_VALOR ? undefined : escolha)
                  }
                >
                  <SelectTrigger id={id} aria-required={obrigatorio}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>-</SelectItem>
                    {(campo.opcoes ?? []).map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {opcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
        }
      })}
      {aviso !== null && (
        <p role="alert" className="text-xs text-destructive">
          {aviso}
        </p>
      )}
    </div>
  );
}
