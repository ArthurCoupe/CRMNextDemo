import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { FalhaAoLer } from "@/shared/ui/falha-ao-ler";

import { rotuloDaGanha, type GanhaSemContrato } from "../domain/vinculo";
import {
  useCriarCliente,
  useGanhasSemContrato,
  useResponsaveisPossiveis,
} from "../hooks/use-clients";

const SEM_RESPONSAVEL = "sem-responsavel";
const SEM_GANHA = "sem-ganha";

interface Rascunho {
  nome: string;
  responsavelId: string;
  segmento: string;
  nicho: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  ganhaId: string;
}

const RASCUNHO_VAZIO: Rascunho = {
  nome: "",
  responsavelId: SEM_RESPONSAVEL,
  segmento: "",
  nicho: "",
  contatoNome: "",
  contatoEmail: "",
  contatoTelefone: "",
  ganhaId: SEM_GANHA,
};

function rascunhoDaGanha(atual: Rascunho, ganha: GanhaSemContrato): Rascunho {
  return {
    ...atual,
    nome: ganha.nome,
    segmento: ganha.segmento ?? "",
    nicho: ganha.nicho ?? "",
    contatoNome: ganha.contatoNome ?? "",
    contatoEmail: ganha.contatoEmail ?? "",
    contatoTelefone: ganha.contatoTelefone ?? "",
    ganhaId: ganha.id,
  };
}

export function FormularioDeCliente({
  aberto,
  aoFechar,
  ganhaInicial = null,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  ganhaInicial?: GanhaSemContrato | null;
  aoCriar?: (clienteId: string, ganhaId: string | null) => void;
}) {
  const salvar = useCriarCliente();

  const consultaDeGanhas = useGanhasSemContrato(aberto);
  const ganhasFalharam = estadoDaConsulta(consultaDeGanhas) === "erro";
  const ganhasLidas = consultaDeGanhas.data ?? [];
  const ganhas =
    ganhaInicial !== null && !ganhasLidas.some((g) => g.id === ganhaInicial.id)
      ? [ganhaInicial, ...ganhasLidas]
      : ganhasLidas;

  const consultaDeResponsaveis = useResponsaveisPossiveis(null);
  const responsaveis = consultaDeResponsaveis.data ?? [];
  const responsaveisFalharam = estadoDaConsulta(consultaDeResponsaveis) === "erro";

  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_VAZIO);

  const chaveDeAbertura = aberto ? `aberto:${ganhaInicial?.id ?? ""}` : null;
  const [ultimaAbertura, setUltimaAbertura] = useState<string | null>(null);
  if (chaveDeAbertura !== ultimaAbertura) {
    setUltimaAbertura(chaveDeAbertura);
    setRascunho(
      ganhaInicial === null ? RASCUNHO_VAZIO : rascunhoDaGanha(RASCUNHO_VAZIO, ganhaInicial),
    );
  }

  function escolherGanha(valor: string) {
    if (valor === SEM_GANHA) {
      setRascunho((r) => ({ ...r, ganhaId: SEM_GANHA }));
      return;
    }
    const ganha = ganhas.find((g) => g.id === valor);
    if (ganha !== undefined) setRascunho((r) => rascunhoDaGanha(r, ganha));
  }

  const valido = rascunho.nome.trim() !== "";

  function aoSalvar() {
    if (!valido) return;
    const ganhaId = rascunho.ganhaId === SEM_GANHA ? null : rascunho.ganhaId;
    salvar.mutate(
      {
        nome: rascunho.nome.trim(),
        segmento: rascunho.segmento.trim() || null,
        nicho: rascunho.nicho.trim() || null,
        contatoNome: rascunho.contatoNome.trim() || null,
        contatoEmail: rascunho.contatoEmail.trim() || null,
        contatoTelefone: rascunho.contatoTelefone.trim() || null,
        responsavelId: rascunho.responsavelId === SEM_RESPONSAVEL ? null : rascunho.responsavelId,
      },
      {
        onSuccess: (clienteId) => {
          aoCriar?.(clienteId, ganhaId);
          aoFechar();
        },
        onError: (erro) => {
          toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar o cliente.");
        },
      },
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>
            Cliente nasce em onboarding. Se veio de uma ganha do Pipeline, escolha-a para preencher
            os dados; o contrato abre em seguida, ligado a ela.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="cliente-ganha">Preencher com os dados de uma ganha (opcional)</Label>
            {ganhasFalharam && (
              <FalhaAoLer
                oQue="as ganhas esperando contrato"
                mensagem="Dá para preencher à mão e salvar assim mesmo."
              />
            )}
            <Select value={rascunho.ganhaId} onValueChange={escolherGanha}>
              <SelectTrigger id="cliente-ganha">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_GANHA}>Nenhuma</SelectItem>
                {ganhas.map((ganha) => (
                  <SelectItem key={ganha.id} value={ganha.id}>
                    {rotuloDaGanha(ganha)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label htmlFor="cliente-nome">Nome</Label>
            <Input
              id="cliente-nome"
              value={rascunho.nome}
              onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="cliente-responsavel">Responsável (opcional)</Label>
            {responsaveisFalharam && (
              <FalhaAoLer
                oQue="a lista de quem pode ser responsável"
                mensagem="Recarregue a página e tente de novo."
              />
            )}
            <Select
              value={rascunho.responsavelId}
              onValueChange={(v) => setRascunho((r) => ({ ...r, responsavelId: v }))}
            >
              <SelectTrigger id="cliente-responsavel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
                {responsaveis.map((responsavel) => (
                  <SelectItem key={responsavel.id} value={responsavel.id}>
                    {responsavel.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="cliente-segmento">Segmento (opcional)</Label>
              <Input
                id="cliente-segmento"
                value={rascunho.segmento}
                onChange={(e) => setRascunho((r) => ({ ...r, segmento: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="cliente-nicho">Nicho (opcional)</Label>
              <Input
                id="cliente-nicho"
                value={rascunho.nicho}
                onChange={(e) => setRascunho((r) => ({ ...r, nicho: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label htmlFor="cliente-contato-nome">Contato · nome (opcional)</Label>
            <Input
              id="cliente-contato-nome"
              value={rascunho.contatoNome}
              onChange={(e) => setRascunho((r) => ({ ...r, contatoNome: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="cliente-contato-email">Contato · e-mail (opcional)</Label>
              <Input
                id="cliente-contato-email"
                type="email"
                value={rascunho.contatoEmail}
                onChange={(e) => setRascunho((r) => ({ ...r, contatoEmail: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="cliente-contato-telefone">Contato · telefone (opcional)</Label>
              <Input
                id="cliente-contato-telefone"
                value={rascunho.contatoTelefone}
                onChange={(e) => setRascunho((r) => ({ ...r, contatoTelefone: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={aoFechar} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={aoSalvar} disabled={!valido || salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
