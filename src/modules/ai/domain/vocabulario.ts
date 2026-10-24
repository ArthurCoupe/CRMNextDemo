import type { Database } from "@/shared/types/database.types";

type Estagio = Database["public"]["Enums"]["opportunity_stage"];

export const ESTAGIOS = [
  "prospeccao",
  "abordagem",
  "qualificacao",
  "r1",
  "r2",
  "fechado",
  "perdido",
  "descartado",
] as const satisfies readonly Estagio[];

type EstagiosFaltando = Exclude<Estagio, (typeof ESTAGIOS)[number]>;
const _todosOsEstagiosCobertos: EstagiosFaltando extends never ? true : false = true;

type Papel = Database["public"]["Enums"]["app_role"];

export const PAPEIS = ["owner", "manager", "member", "client"] as const satisfies readonly Papel[];

type PapeisFaltando = Exclude<Papel, (typeof PAPEIS)[number]>;
const _todosOsPapeisCobertos: PapeisFaltando extends never ? true : false = true;

type StatusDeCliente = Database["public"]["Enums"]["client_status"];

export const STATUS_DE_CLIENTE = [
  "onboarding",
  "active",
  "paused",
  "churned",
] as const satisfies readonly StatusDeCliente[];

type StatusFaltando = Exclude<StatusDeCliente, (typeof STATUS_DE_CLIENTE)[number]>;
const _todosOsStatusCobertos: StatusFaltando extends never ? true : false = true;

type ColunaDeTarefa = Database["public"]["Enums"]["task_col"];

export const COLUNAS_DE_TAREFA = [
  "todo",
  "doing",
  "review",
  "done",
] as const satisfies readonly ColunaDeTarefa[];

type ColunasFaltando = Exclude<ColunaDeTarefa, (typeof COLUNAS_DE_TAREFA)[number]>;
const _todasAsColunasCobertas: ColunasFaltando extends never ? true : false = true;

export const VOCABULARIO = [
  "## Vocabulário do CRM",
  "",
  "### As duas dimensões financeiras são independentes",
  '- Dimensão A, tipo de receita: "mrr" (tem monthly_value) ou "tcv" (tem total_value + billing_months).',
  '- Dimensão B, linha de negócio: "demanda" ou "sistemas".',
  '- As 4 células da matriz existem. BU Sistemas também tem produto recorrente. Nunca assuma "MRR = Demanda, TCV = Sistemas".',
  "- MRR e TCV nunca devem ser somados num total geral: são fluxo e estoque.",
  "",
  "### As duas unidades de negócio e as quatro frentes",
  "- BU1 (Geração de Demanda): Frente 01 Posicionamento, Frente 02 Tráfego, Frente 03 Comercial.",
  "- BU2 (Sistemas & Automações com IA): Frente 04 Sistemas.",
  "",
  `### Os 8 estágios do pipeline (enum opportunity_stage), nesta ordem`,
  ESTAGIOS.join(", ") + ".",
  "",
  `### Os 4 papéis (enum app_role)`,
  PAPEIS.join(", ") + ".",
  "",
  `### Os 4 status de cliente (enum client_status)`,
  STATUS_DE_CLIENTE.join(", ") + ".",
  "",
  `### As 4 colunas de tarefa (enum task_col)`,
  COLUNAS_DE_TAREFA.join(", ") + ".",
  "",
  "### O que cada estágio significa",
  "01 prospeccao: empresa identificada como possível cliente, sem contato feito. O que o CRM mede no tempo até o primeiro contato: tráfego pago 5 min; indicação (parceria entra como indicação) e inbound 1h; outbound, lead sem canal e lead importado ficam sem prazo; o relógio conta de segunda a sexta, das 9h às 18h, no horário de São Paulo.",
  "02 abordagem: primeiro contato feito, conversa aberta ou aguardando resposta.",
  "03 qualificacao: quatro perguntas somam uma nota de 0 a 8; a nota e as respostas ficam gravadas na oportunidade.",
  "04 r1: primeira reunião, para entender o problema do cliente.",
  "05 r2: segunda reunião, para apresentar a proposta.",
  "06 fechado: contrato assinado. Terminal no funil.",
  "07 perdido: era oportunidade real e não fechou. Terminal. ENTRA no cálculo de win rate.",
  "08 descartado: nunca chegou a ser oportunidade real. Terminal. NÃO entra no cálculo de win rate.",
  "",
  "### Frentes e tipo de receita",
  "As frentes 01, 02 e 03 são MRR. A frente 04 é TCV de projeto. Nunca derive uma da outra.",
  "ATENÇÃO: preço de tabela não é preço praticado. Quando perguntarem valor de um cliente, use o valor do contrato que estiver no contexto, nunca o preço de tabela.",
  "",
  "### Regra de conduta",
  "Nunca invente número, nome de cliente, valor ou data.",
  'Quando não houver fonte para o que foi perguntado, responda "não está definido". NUNCA preencha com conhecimento genérico de vendas, marketing ou gestão. Uma explicação genérica que soa convincente é pior que admitir a lacuna: quem lê assume que é o processo documentado da casa.',
].join("\n");
