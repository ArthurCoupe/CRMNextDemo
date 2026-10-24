import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContractSharesSection } from "./contract-shares-section";
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
import { DialogoDeExclusao } from "@/shared/ui/dialogo-de-exclusao";
import { Money } from "@/shared/ui/money";
import { estadoDaConsulta } from "@/shared/ui/estado-da-consulta";
import { ehDataCivilPlausivel, somaDias, todaySP } from "@/shared/lib/date";
import { inteiroPositivoOuNulo } from "@/shared/lib/inteiro-positivo";
import { interpretarValorEmReais } from "@/modules/financial/domain/expenses";
import { parcelasParaGravar } from "@/modules/financial/domain/fiscal";
import { SimuladorDeLiquido } from "@/modules/financial/ui/simulador-liquido";

import type { ContratoListado, ProdutoDoCatalogo } from "../api/contracts.repository";
import {
  contractStatusLabel,
  exigeDecisaoAoReativar,
  exigeDecisaoDeCobranca,
  FRENTES_DE_SERVICO,
  frenteCombinaComLinhaDeNegocio,
  frenteLabel,
  type ContratoInicial,
  type FrenteDeServico,
  type ItemDeContrato,
  type LinhaDeNegocio,
  type MeioDePagamento,
  type StatusDeContrato,
  type TipoDeContrato,
} from "../domain/contract";
import {
  avisoDeFrenteSemPreco,
  decomporProduto,
  restanteAAlocar,
  somaFecha,
} from "../domain/items";
import {
  useApagarContrato,
  useClientesParaSelecao,
  useProdutosAtivos,
  useSaveContract,
  useVendasParaContrato,
} from "../hooks/use-contracts";
import { opcoesDeVenda, vendaQueFica, type VendaDeOrigem } from "../domain/venda-de-origem";

const SEM_VENDA = "sem-venda";

interface Rascunho {
  clienteId: string;
  nome: string;
  tipo: TipoDeContrato;
  linhaDeNegocio: LinhaDeNegocio;
  valorMensal: string;
  valorTotal: string;
  mesesDeCobranca: string;
  inicio: string;
  fim: string;
  firme: boolean;
  comissionavel: boolean;
  meioDePagamento: MeioDePagamento;
  status: StatusDeContrato;
  cobrancaAtiva: boolean | null;
  statusOriginal: StatusDeContrato;
  cobrancaAtivaOriginal: boolean;
  motivoDaPausa: string;
  observacoes: string;
  itens: ItemDeContrato[];
  parcelas: number | null;
  prazoDeEntrega: string | null;
  duracaoMeses: string;
  mesesDeFidelidade: string;
  vendaId: string | null;
}

function rascunhoVazio(): Rascunho {
  return {
    clienteId: "",
    nome: "",
    tipo: "mrr",
    linhaDeNegocio: "demanda",
    valorMensal: "",
    valorTotal: "",
    mesesDeCobranca: "",
    inicio: todaySP(),
    fim: "",
    firme: true,
    comissionavel: true,
    meioDePagamento: "transferencia",
    status: "active",
    cobrancaAtiva: true,
    statusOriginal: "active",
    cobrancaAtivaOriginal: true,
    motivoDaPausa: "",
    observacoes: "",
    itens: [],
    parcelas: null,
    prazoDeEntrega: null,
    duracaoMeses: "",
    mesesDeFidelidade: "",
    vendaId: null,
  };
}

function rascunhoDeContrato(contrato: ContratoListado): Rascunho {
  return {
    clienteId: contrato.clienteId,
    nome: contrato.nome,
    tipo: contrato.tipo,
    linhaDeNegocio: contrato.linhaDeNegocio,
    valorMensal: contrato.valorMensal !== null ? String(contrato.valorMensal) : "",
    valorTotal: contrato.valorTotal !== null ? String(contrato.valorTotal) : "",
    mesesDeCobranca: contrato.mesesDeCobranca !== null ? String(contrato.mesesDeCobranca) : "",
    inicio: contrato.inicio,
    fim: contrato.fim ?? "",
    firme: contrato.firme,
    comissionavel: contrato.comissionavel,
    meioDePagamento: contrato.meioDePagamento,
    status: contrato.status,
    cobrancaAtiva: contrato.cobrancaAtiva,
    statusOriginal: contrato.status,
    cobrancaAtivaOriginal: contrato.cobrancaAtiva,
    motivoDaPausa: contrato.motivoDaPausa ?? "",
    observacoes: contrato.observacoes ?? "",
    itens: [...contrato.itens],
    parcelas: contrato.parcelas,
    prazoDeEntrega: contrato.prazoDeEntrega,
    duracaoMeses: contrato.duracaoMeses !== null ? String(contrato.duracaoMeses) : "",
    mesesDeFidelidade:
      contrato.mesesDeFidelidade !== null ? String(contrato.mesesDeFidelidade) : "",
    vendaId: contrato.oportunidadeId,
  };
}

function rascunhoDeInicial(clienteId: string, c: ContratoInicial, vendaId: string): Rascunho {
  const vazio = rascunhoVazio();
  return {
    ...vazio,
    clienteId,
    vendaId,
    nome: c.nome,
    tipo: c.tipo,
    linhaDeNegocio: c.linhaDeNegocio,
    valorMensal: c.tipo === "mrr" ? String(c.valor) : "",
    valorTotal: c.tipo === "tcv" ? String(c.valor) : "",
    mesesDeCobranca: c.mesesDeCobranca !== null ? String(c.mesesDeCobranca) : "",
    meioDePagamento: c.meioDePagamento,
    parcelas: c.meioDePagamento === "credito" ? 1 : null,
    itens: [...c.itens],
    prazoDeEntrega:
      c.prazoDeEntregaDias !== null ? somaDias(vazio.inicio, c.prazoDeEntregaDias) : null,
    mesesDeFidelidade: c.mesesDeFidelidade !== null ? String(c.mesesDeFidelidade) : "",
  };
}

interface ContractFormProps {
  aberto: boolean;
  aoFechar: () => void;
  contrato?: ContratoListado | null;
  inicial?: {
    readonly clienteId: string;
    readonly contrato: ContratoInicial;
    readonly venda: VendaDeOrigem;
  } | null;
  preEscolha?: { readonly clienteId: string | null; readonly vendaId: string | null } | null;
  aoContratoCriado?: (contratoId: string) => void;
  podeApagar?: boolean;
}

export function ContractForm({
  aberto,
  aoFechar,
  contrato,
  inicial,
  preEscolha,
  aoContratoCriado,
  podeApagar = false,
}: ContractFormProps) {
  const consultaDeClientes = useClientesParaSelecao();
  const consultaDeProdutos = useProdutosAtivos();
  const salvar = useSaveContract();
  const consultaDeVendas = useVendasParaContrato(aberto && !inicial);
  const vendasFalharam = !inicial && estadoDaConsulta(consultaDeVendas) === "erro";

  const clientesFalharam = estadoDaConsulta(consultaDeClientes) === "erro";
  const produtosFalharam = estadoDaConsulta(consultaDeProdutos) === "erro";
  const clientes = consultaDeClientes.data ?? [];
  const produtos = consultaDeProdutos.data ?? [];
  const vendasLidas = consultaDeVendas.data;
  const idDaVendaAtual = contrato?.oportunidadeId ?? null;
  const vendaAtual: VendaDeOrigem | null =
    idDaVendaAtual === null || vendasLidas === undefined
      ? null
      : {
          id: idDaVendaAtual,
          nome:
            vendasLidas.origens.find((o) => o.vendaId === idDaVendaAtual)?.vendaNome ??
            "Venda atual",
        };

  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoVazio);
  const [produtoId, setProdutoId] = useState<string>("");
  const [frentesSemPreco, setFrentesSemPreco] = useState<readonly FrenteDeServico[]>([]);

  const [itemEmEdicao, setItemEmEdicao] = useState<{ indice: number; texto: string } | null>(null);
  const [diasDoPrazo, setDiasDoPrazo] = useState<number | null>(null);

  const [ultimaAbertura, setUltimaAbertura] = useState<string | null>(null);
  const chaveDeAbertura = aberto
    ? (contrato?.id ??
      (inicial
        ? "proposta"
        : preEscolha
          ? `pre:${preEscolha.clienteId ?? ""}:${preEscolha.vendaId ?? ""}`
          : "novo"))
    : null;
  if (chaveDeAbertura !== ultimaAbertura) {
    setUltimaAbertura(chaveDeAbertura);
    if (chaveDeAbertura !== null) {
      setRascunho(
        contrato
          ? rascunhoDeContrato(contrato)
          : inicial
            ? rascunhoDeInicial(inicial.clienteId, inicial.contrato, inicial.venda.id)
            : preEscolha
              ? {
                  ...rascunhoVazio(),
                  clienteId: preEscolha.clienteId ?? "",
                  vendaId: preEscolha.vendaId,
                }
              : rascunhoVazio(),
      );
      setProdutoId("");
      setFrentesSemPreco(!contrato && inicial ? inicial.contrato.frentesSemPreco : []);
      setDiasDoPrazo(!contrato && inicial ? inicial.contrato.prazoDeEntregaDias : null);
    }
  }

  const valorMensalEmReais = interpretarValorEmReais(rascunho.valorMensal);
  const valorTotalEmReais = interpretarValorEmReais(rascunho.valorTotal);
  const valorDoContrato = (rascunho.tipo === "mrr" ? valorMensalEmReais : valorTotalEmReais) ?? 0;
  const restante = restanteAAlocar(rascunho.itens, valorDoContrato);
  const fechou = somaFecha(rascunho.itens, valorDoContrato) && valorDoContrato > 0;

  const frentesIncoerentes = useMemo(
    () =>
      rascunho.itens.filter(
        (item) => !frenteCombinaComLinhaDeNegocio(item.frente, rascunho.linhaDeNegocio),
      ),
    [rascunho.itens, rascunho.linhaDeNegocio],
  );

  const decisaoDeCobrancaPendente = rascunho.cobrancaAtiva === null;

  const precisaDecidirReativacao = exigeDecisaoAoReativar(
    rascunho.status,
    rascunho.cobrancaAtivaOriginal,
  );

  const listasDeOpcoesFalharam = clientesFalharam || produtosFalharam;

  const textoDasListasQueFalharam =
    clientesFalharam && produtosFalharam
      ? "nem a lista de clientes nem o catálogo de produtos puderam ser lidos"
      : clientesFalharam
        ? "a lista de clientes não pôde ser lida"
        : "o catálogo de produtos não pôde ser lido";

  const datasPlausiveis =
    ehDataCivilPlausivel(rascunho.inicio) &&
    (rascunho.fim === "" || ehDataCivilPlausivel(rascunho.fim)) &&
    (rascunho.tipo !== "tcv" ||
      rascunho.prazoDeEntrega === null ||
      ehDataCivilPlausivel(rascunho.prazoDeEntrega));

  const mesesInteiros =
    rascunho.tipo === "mrr" ||
    (Number.isInteger(Number(rascunho.mesesDeCobranca)) && Number(rascunho.mesesDeCobranca) > 0);

  const duracaoEmMeses = inteiroPositivoOuNulo(rascunho.duracaoMeses);
  const fidelidadeEmMeses = inteiroPositivoOuNulo(rascunho.mesesDeFidelidade);
  const mesesDoMrrValidos =
    rascunho.tipo !== "mrr" || (duracaoEmMeses !== undefined && fidelidadeEmMeses !== undefined);

  const clienteNovo =
    contrato && rascunho.clienteId !== contrato.clienteId
      ? (clientes.find((c) => c.id === rascunho.clienteId)?.nome ?? null)
      : null;

  const opcoesDaVenda =
    vendasLidas === undefined
      ? []
      : opcoesDeVenda(vendasLidas.ganhas, vendasLidas.origens, rascunho.clienteId, vendaAtual);

  const podeSalvar =
    fechou &&
    frentesIncoerentes.length === 0 &&
    frentesSemPreco.length === 0 &&
    !decisaoDeCobrancaPendente &&
    !listasDeOpcoesFalharam &&
    !vendasFalharam &&
    datasPlausiveis &&
    rascunho.clienteId !== "" &&
    rascunho.nome.trim() !== "" &&
    mesesInteiros &&
    mesesDoMrrValidos &&
    !salvar.isPending;

  function aplicarProduto(produto: ProdutoDoCatalogo) {
    setProdutoId(produto.id);

    const { itens, semPreco } = decomporProduto(produto, produtos);
    setFrentesSemPreco(semPreco);

    setRascunho((r) => ({
      ...r,
      nome: r.nome === "" ? produto.nome : r.nome,
      tipo: produto.tipo,
      linhaDeNegocio: produto.linhaDeNegocio,
      valorMensal: produto.tipo === "mrr" ? String(produto.preco) : "",
      valorTotal: produto.tipo === "tcv" ? String(produto.preco) : "",
      itens,
    }));
  }

  function definirItem(indice: number, mudanca: Partial<ItemDeContrato>) {
    setRascunho((r) => ({
      ...r,
      itens: r.itens.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)),
    }));
  }

  async function aoSalvar() {
    try {
      const contratoId = await salvar.mutateAsync({
        contratoId: contrato?.id ?? null,
        clienteId: rascunho.clienteId,
        nome: rascunho.nome.trim(),
        tipo: rascunho.tipo,
        linhaDeNegocio: rascunho.linhaDeNegocio,
        itens: rascunho.itens,
        inicio: rascunho.inicio,
        valorMensal: rascunho.tipo === "mrr" ? valorMensalEmReais : null,
        valorTotal: rascunho.tipo === "tcv" ? valorTotalEmReais : null,
        mesesDeCobranca: rascunho.tipo === "tcv" ? Number(rascunho.mesesDeCobranca) : null,
        firme: rascunho.firme,
        cobrancaAtiva: rascunho.cobrancaAtiva,
        motivoDaPausa: rascunho.motivoDaPausa || null,
        fim: rascunho.fim || null,
        meioDePagamento: rascunho.meioDePagamento,
        comissionavel: rascunho.comissionavel,
        status: rascunho.status,
        observacoes: rascunho.observacoes || null,
        parcelas: parcelasParaGravar(rascunho.meioDePagamento, rascunho.parcelas),
        prazoDeEntrega: rascunho.tipo === "tcv" ? rascunho.prazoDeEntrega : null,
        duracaoMeses:
          rascunho.tipo === "mrr" ? (duracaoEmMeses ?? null) : (contrato?.duracaoMeses ?? null),
        mesesDeFidelidade:
          rascunho.tipo === "mrr"
            ? (fidelidadeEmMeses ?? null)
            : (contrato?.mesesDeFidelidade ?? null),
        oportunidadeId: rascunho.vendaId,
      });
      toast.success(contrato ? "Contrato atualizado." : "Contrato criado.");
      if (!contrato) aoContratoCriado?.(contratoId);
      aoFechar();
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar.";
      toast.error(mensagem);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contrato ? "Editar contrato" : "Novo contrato"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="produto">Produto do catálogo</Label>
              <Select
                value={produtoId}
                onValueChange={(id) => {
                  const produto = produtos.find((p) => p.id === id);
                  if (produto) aplicarProduto(produto);
                }}
              >
                <SelectTrigger id="produto">
                  <SelectValue placeholder="Pré-preencher por produto…" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {produtosFalharam ? (
                <OpcoesNaoLidas>
                  Não foi possível ler o catálogo de produtos. A lista acima não está vazia porque
                  não há produto. Está vazia porque a leitura falhou. Salvar fica travado:
                  recarregue a página antes de continuar.
                </OpcoesNaoLidas>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Preço de tabela é sugestão: todo valor continua editável.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="contrato-cliente">Cliente</Label>
              <Select
                value={rascunho.clienteId}
                onValueChange={(clienteId) =>
                  setRascunho((r) => ({
                    ...r,
                    clienteId,
                    vendaId:
                      vendasLidas === undefined
                        ? r.vendaId
                        : vendaQueFica(
                            r.vendaId,
                            opcoesDeVenda(
                              vendasLidas.ganhas,
                              vendasLidas.origens,
                              clienteId,
                              vendaAtual,
                            ),
                          ),
                  }))
                }
                disabled={Boolean(inicial)}
              >
                <SelectTrigger id="contrato-cliente">
                  <SelectValue placeholder="Selecionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientesFalharam && (
                <OpcoesNaoLidas>
                  Não foi possível ler a lista de clientes. Isto não é "nenhum cliente cadastrado".
                  É leitura falha, e o cliente do contrato pode estar entre os que não apareceram.
                  Salvar fica travado até a lista voltar.
                </OpcoesNaoLidas>
              )}
              {contrato && clienteNovo !== null && (
                <p className="text-[11px] text-warning">
                  {`Ao salvar, o contrato sai da ficha de ${contrato.nomeDoCliente} e vai para a de ${clienteNovo}. Se o responsável por ${clienteNovo} for gestor, ele passa a ver este contrato; se o responsável por ${contrato.nomeDoCliente} for gestor, ele deixa de ver.`}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contrato-venda">Venda de origem</Label>
            {inicial ? (
              <Input id="contrato-venda" value={inicial.venda.nome} disabled readOnly />
            ) : (
              <Select
                value={rascunho.vendaId ?? SEM_VENDA}
                onValueChange={(valor) =>
                  setRascunho((r) => ({ ...r, vendaId: valor === SEM_VENDA ? null : valor }))
                }
                disabled={vendasLidas === undefined}
              >
                <SelectTrigger id="contrato-venda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VENDA}>Nenhuma</SelectItem>
                  {opcoesDaVenda.map((venda) => (
                    <SelectItem key={venda.id} value={venda.id}>
                      {venda.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {vendasFalharam ? (
              <OpcoesNaoLidas>
                Não foi possível ler a lista de vendas. Isto não é "nenhuma venda". Salvar fica
                travado até a lista voltar.
              </OpcoesNaoLidas>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                A ganha do Pipeline de onde este contrato veio. Ela passa a mostrar o valor deste
                contrato e deixa de aparecer como "Sem contrato".
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Nome do contrato</Label>
            <Input
              value={rascunho.nome}
              onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
              placeholder="Ex.: Combo 3 Frentes · semestral"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Tipo de receita</Label>
              <Select
                value={rascunho.tipo}
                onValueChange={(tipo) =>
                  setRascunho((r) => ({
                    ...r,
                    tipo: tipo as TipoDeContrato,
                    valorMensal: tipo === "mrr" ? r.valorMensal : "",
                    valorTotal: tipo === "tcv" ? r.valorTotal : "",
                    mesesDeCobranca: tipo === "tcv" ? r.mesesDeCobranca : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mrr">Mensalidade (MRR)</SelectItem>
                  <SelectItem value="tcv">Projeto (TCV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Linha de negócio</Label>
              <Select
                value={rascunho.linhaDeNegocio}
                onValueChange={(bu) =>
                  setRascunho((r) => ({ ...r, linhaDeNegocio: bu as LinhaDeNegocio }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demanda">Demanda</SelectItem>
                  <SelectItem value="sistemas">Sistemas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {rascunho.tipo === "mrr" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="contrato-valor-mensal">Valor mensal (R$)</Label>
              <Input
                id="contrato-valor-mensal"
                inputMode="decimal"
                className="tabular-nums"
                value={rascunho.valorMensal}
                onChange={(e) => setRascunho((r) => ({ ...r, valorMensal: e.target.value }))}
                placeholder="1.197,00"
              />
              <EcoDoValor texto={rascunho.valorMensal} valor={valorMensalEmReais} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="contrato-valor-total">Valor total do projeto (R$)</Label>
                <Input
                  id="contrato-valor-total"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={rascunho.valorTotal}
                  onChange={(e) => setRascunho((r) => ({ ...r, valorTotal: e.target.value }))}
                  placeholder="24.637,00"
                />
                <EcoDoValor texto={rascunho.valorTotal} valor={valorTotalEmReais} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contrato-meses-de-cobranca">Meses de cobrança</Label>
                <Input
                  id="contrato-meses-de-cobranca"
                  type="number"
                  min="1"
                  value={rascunho.mesesDeCobranca}
                  onChange={(e) => setRascunho((r) => ({ ...r, mesesDeCobranca: e.target.value }))}
                />
                {rascunho.mesesDeCobranca !== "" && !mesesInteiros && (
                  <p role="alert" className="text-xs text-destructive">
                    Meses de cobrança precisa ser um número inteiro.
                  </p>
                )}
              </div>
            </div>
          )}
          {rascunho.tipo === "mrr" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="contrato-duracao">Duração (meses)</Label>
                <Input
                  id="contrato-duracao"
                  type="text"
                  inputMode="numeric"
                  value={rascunho.duracaoMeses}
                  onChange={(e) => setRascunho((r) => ({ ...r, duracaoMeses: e.target.value }))}
                />
                {duracaoEmMeses === undefined ? (
                  <p role="alert" className="text-xs text-destructive">
                    Duração precisa ser um número inteiro maior que zero.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Opcional. Dá o fim de cobrança previsto (início + duração), que o aviso de
                    contrato vencendo e a ficha do cliente leem. Não encerra a receita: o MRR conta
                    até a data de Fim, quando houver.
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contrato-fidelidade">Fidelidade (meses)</Label>
                <Input
                  id="contrato-fidelidade"
                  type="text"
                  inputMode="numeric"
                  value={rascunho.mesesDeFidelidade}
                  onChange={(e) =>
                    setRascunho((r) => ({ ...r, mesesDeFidelidade: e.target.value }))
                  }
                />
                {fidelidadeEmMeses === undefined ? (
                  <p role="alert" className="text-xs text-destructive">
                    Fidelidade precisa ser um número inteiro maior que zero.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Opcional. É registro do combinado: nenhuma conta de receita usa este número.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label>Decomposição por frente</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setRascunho((r) => ({
                    ...r,
                    itens: [
                      ...r.itens,
                      {
                        frente: r.linhaDeNegocio === "sistemas" ? "sistemas" : "posicionamento",
                        produtoId: null,
                        valor: 0,
                      },
                    ],
                  }))
                }
              >
                Adicionar frente
              </Button>
            </div>

            {rascunho.itens.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma frente. Escolha um produto acima ou adicione manualmente. Contrato sem
                decomposição é recusado pelo banco.
              </p>
            ) : (
              rascunho.itens.map((item, indice) => (
                <div key={indice} className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <Select
                      value={item.frente}
                      onValueChange={(frente) =>
                        definirItem(indice, { frente: frente as FrenteDeServico })
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FRENTES_DE_SERVICO.map((frente) => (
                          <SelectItem key={frente} value={frente}>
                            {frenteLabel(frente)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label={`Valor da frente ${frenteLabel(item.frente)}`}
                      inputMode="decimal"
                      className="w-32 tabular-nums"
                      value={
                        itemEmEdicao?.indice === indice
                          ? itemEmEdicao.texto
                          : item.valor === 0
                            ? ""
                            : String(item.valor)
                      }
                      onChange={(e) => {
                        const texto = e.target.value;
                        setItemEmEdicao({ indice, texto });
                        definirItem(indice, { valor: interpretarValorEmReais(texto) ?? 0 });
                        setFrentesSemPreco([]);
                      }}
                      onBlur={() => setItemEmEdicao(null)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRascunho((r) => ({
                          ...r,
                          itens: r.itens.filter((_, i) => i !== indice),
                        }))
                      }
                    >
                      Remover
                    </Button>
                  </div>
                  <AvisoDeIlegivel
                    texto={itemEmEdicao?.indice === indice ? itemEmEdicao.texto : ""}
                  />
                </div>
              ))
            )}

            <div className="flex items-center justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">
                Restante a alocar:{" "}
                <Money
                  value={restante}
                  className={
                    restante === 0 ? "text-[--verde,#3fb950]" : "font-semibold text-amber-500"
                  }
                />
              </span>
              <span className={fechou ? "text-xs text-muted-foreground" : "text-xs text-amber-500"}>
                {fechou ? "Soma fechada ✓" : "A soma precisa bater com o valor do contrato"}
              </span>
            </div>

            {frentesIncoerentes.length > 0 && (
              <p className="text-xs text-destructive">
                {frentesIncoerentes.length} frente(s) não pertencem à linha de negócio{" "}
                {rascunho.linhaDeNegocio === "demanda" ? "Demanda" : "Sistemas"}. O banco recusaria.
                Corrija antes de salvar.
              </p>
            )}

            {frentesSemPreco.length > 0 && (
              <p role="alert" className="text-xs text-destructive">
                {avisoDeFrenteSemPreco(frentesSemPreco)}
              </p>
            )}
          </div>

          {!datasPlausiveis && (
            <p role="alert" className="text-xs text-destructive">
              {rascunho.inicio === ""
                ? "Informe a data de início."
                : "Data inválida. Use um ano entre 2000 e 2100."}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="contrato-inicio">Início</Label>
              <Input
                id="contrato-inicio"
                type="date"
                value={rascunho.inicio}
                onChange={(e) => {
                  const novo = e.target.value;
                  setRascunho((r) => ({
                    ...r,
                    inicio: novo,
                    prazoDeEntrega:
                      diasDoPrazo !== null && ehDataCivilPlausivel(novo)
                        ? somaDias(novo, diasDoPrazo)
                        : r.prazoDeEntrega,
                  }));
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fim (opcional)</Label>
              <Input
                type="date"
                value={rascunho.fim}
                onChange={(e) => setRascunho((r) => ({ ...r, fim: e.target.value }))}
              />
            </div>

            {rascunho.tipo === "tcv" && (
              <div className="grid gap-1.5">
                <Label htmlFor="contrato-prazo-de-entrega">Prazo de entrega (opcional)</Label>
                <Input
                  id="contrato-prazo-de-entrega"
                  type="date"
                  value={rascunho.prazoDeEntrega ?? ""}
                  onChange={(e) => {
                    setRascunho((r) => ({ ...r, prazoDeEntrega: e.target.value || null }));
                    setDiasDoPrazo(null);
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  Fim de <strong>entrega</strong>, não de cobrança: a cobrança termina sozinha,
                  pelos meses de cobrança. Vencido e sem entrega registrada, o projeto entra no
                  alerta de atraso do Resultado, enquanto o contrato não for cancelado.
                </p>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Pagamento</Label>
              <Select
                value={rascunho.meioDePagamento}
                onValueChange={(meio) =>
                  setRascunho((r) => ({
                    ...r,
                    meioDePagamento: meio as MeioDePagamento,
                    parcelas: meio === "credito" ? (r.parcelas ?? 1) : r.parcelas,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rascunho.meioDePagamento === "credito" && (
              <div className="grid gap-1.5">
                <Label>Parcelas</Label>
                <Select
                  value={String(rascunho.parcelas ?? 1)}
                  onValueChange={(v) => setRascunho((r) => ({ ...r, parcelas: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}×
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <SimuladorDeLiquido
            base={{
              tipo: rascunho.tipo,
              valorMensal: rascunho.tipo === "mrr" ? valorMensalEmReais : null,
              valorTotal: rascunho.tipo === "tcv" ? valorTotalEmReais : null,
              mesesDeCobranca:
                rascunho.tipo === "tcv" ? Number(rascunho.mesesDeCobranca) || null : null,
              meioDePagamento: rascunho.meioDePagamento,
              parcelas: parcelasParaGravar(rascunho.meioDePagamento, rascunho.parcelas),
            }}
          />

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={rascunho.firme}
                onCheckedChange={(firme) => setRascunho((r) => ({ ...r, firme }))}
              />
              Receita firme
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={rascunho.comissionavel}
                onCheckedChange={(comissionavel) => setRascunho((r) => ({ ...r, comissionavel }))}
              />
              Gera participação
            </label>
          </div>

          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select
              value={rascunho.status}
              onValueChange={(valor) =>
                setRascunho((r) => {
                  const status = valor as StatusDeContrato;
                  const mudouDeStatus = status !== r.statusOriginal;
                  const exigeResposta =
                    mudouDeStatus &&
                    (exigeDecisaoDeCobranca(status) ||
                      exigeDecisaoAoReativar(status, r.cobrancaAtivaOriginal));
                  return {
                    ...r,
                    status,
                    cobrancaAtiva: exigeResposta ? null : r.cobrancaAtivaOriginal,
                  };
                })
              }
            >
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="finished">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(exigeDecisaoDeCobranca(rascunho.status) || precisaDecidirReativacao) && (
            <div className="grid gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-sm font-medium">
                {precisaDecidirReativacao
                  ? "Voltar a cobrar?"
                  : rascunho.status === "paused"
                    ? "Suspender a cobrança também?"
                    : "Encerrar a cobrança também?"}
              </p>
              <p className="text-xs text-muted-foreground">
                {precisaDecidirReativacao
                  ? "O contrato está sem cobrança. Reativar a entrega e voltar a cobrar são decisões diferentes: um contrato ativo sem cobrança não conta como receita."
                  : rascunho.status === "paused"
                    ? "Pausar a entrega e pausar a cobrança são decisões diferentes. O contrato pausado que continua sendo cobrado segue contando como receita."
                    : `Fim de entrega e fim de cobrança são campos distintos. Um projeto ${contractStatusLabel(
                        rascunho.status,
                      ).toLowerCase()} com parcelas ainda correndo continua sendo receita, e por isso o sistema pergunta em vez de decidir.`}
              </p>
              <div className="flex gap-2">
                {precisaDecidirReativacao ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={rascunho.cobrancaAtiva === true ? "default" : "outline"}
                      onClick={() => setRascunho((r) => ({ ...r, cobrancaAtiva: true }))}
                    >
                      Sim, voltar a cobrar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rascunho.cobrancaAtiva === false ? "default" : "outline"}
                      onClick={() => setRascunho((r) => ({ ...r, cobrancaAtiva: false }))}
                    >
                      Não, manter sem cobrança
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={rascunho.cobrancaAtiva === false ? "default" : "outline"}
                      onClick={() => setRascunho((r) => ({ ...r, cobrancaAtiva: false }))}
                    >
                      {rascunho.status === "paused"
                        ? "Sim, suspender cobrança"
                        : "Sim, encerrar cobrança"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={rascunho.cobrancaAtiva === true ? "default" : "outline"}
                      onClick={() => setRascunho((r) => ({ ...r, cobrancaAtiva: true }))}
                    >
                      Não, continuar cobrando
                    </Button>
                  </>
                )}
              </div>
              {!precisaDecidirReativacao && rascunho.cobrancaAtiva === false && (
                <Input
                  placeholder={
                    rascunho.status === "paused"
                      ? "Motivo da pausa (opcional)"
                      : "Motivo do encerramento (opcional)"
                  }
                  value={rascunho.motivoDaPausa}
                  onChange={(e) => setRascunho((r) => ({ ...r, motivoDaPausa: e.target.value }))}
                />
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Input
              value={rascunho.observacoes}
              onChange={(e) => setRascunho((r) => ({ ...r, observacoes: e.target.value }))}
              placeholder="Opcional"
            />
          </div>

          {contrato && <ContractSharesSection contrato={contrato} />}

          {listasDeOpcoesFalharam && (
            <p className="flex items-start gap-1.5 border-t pt-4 text-[11px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Não é possível salvar: {textoDasListasQueFalharam}. Salvar agora gravaria valor
                digitado à mão sobre um catálogo que ninguém conseguiu ler. Recarregue a página.
              </span>
            </p>
          )}
          {vendasFalharam && (
            <p className="flex items-start gap-1.5 border-t pt-4 text-[11px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Não é possível salvar: a lista de vendas não pôde ser lida. Salvar agora poderia
                tirar deste contrato a venda de onde ele veio. Recarregue a página.
              </span>
            </p>
          )}

          <div
            className={
              listasDeOpcoesFalharam || vendasFalharam
                ? "flex justify-end gap-2 pt-2"
                : "flex justify-end gap-2 border-t pt-4"
            }
          >
            {contrato && podeApagar && <ApagarContrato contrato={contrato} aoApagar={aoFechar} />}
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="button" disabled={!podeSalvar} onClick={() => void aoSalvar()}>
              {salvar.isPending ? "Salvando…" : "Salvar contrato"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApagarContrato({
  contrato,
  aoApagar,
}: {
  contrato: ContratoListado;
  aoApagar: () => void;
}) {
  const apagar = useApagarContrato();
  const nome = contrato.nome.trim() !== "" ? contrato.nome : contrato.nomeDoCliente;

  return (
    <DialogoDeExclusao
      gatilho={
        <Button type="button" variant="destructive" size="sm" className="mr-auto">
          Apagar contrato
        </Button>
      }
      titulo={`Apagar "${nome}"?`}
      confirmarDigitando={nome}
      pendente={apagar.isPending}
      onConfirmar={() => apagar.mutate(contrato.id, { onSuccess: () => aoApagar() })}
    >
      <p>
        Apaga o contrato junto com os itens por frente, as participações e o registro de
        encerramento automático, se houver.
      </p>
      <p>
        Os itens de proposta que geraram este contrato voltam a aparecer em "Contratos da proposta a
        criar", na ficha do cliente. Meses já fechados no Financeiro não mudam; os meses abertos
        deixam de contar a receita e o custo de participação dele.
      </p>
      <p>Não pode ser desfeito.</p>
      <p>
        Para parar de cobrar mantendo o histórico, não apague: mude o status para "Encerrado",
        confirme "Sim, encerrar cobrança" e salve.
      </p>
    </DialogoDeExclusao>
  );
}

function EcoDoValor({ texto, valor }: { texto: string; valor: number | null }) {
  if (texto.trim() === "") return null;
  if (valor === null) return <AvisoDeIlegivel texto={texto} />;
  return (
    <p className="text-[11px] text-muted-foreground">
      Vai ser gravado como <Money value={valor} className="font-semibold text-foreground" />.
    </p>
  );
}

function AvisoDeIlegivel({ texto }: { texto: string }) {
  if (texto.trim() === "" || interpretarValorEmReais(texto) !== null) return null;
  return (
    <p className="text-[11px] text-destructive">
      Valor não reconhecido. Use vírgula ou ponto para os centavos: 1.197,00 ou 1197.00.
    </p>
  );
}

function OpcoesNaoLidas({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
