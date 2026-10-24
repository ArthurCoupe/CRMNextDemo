insert into public.playbook_sections (area, title, content, sort_order)
select v.area::public.playbook_area, v.title, v.content, v.sort_order
from (values
  ('comercial', 'O funil de vendas', $md$> **Texto de exemplo.** Este playbook pertence a uma empresa fictícia e existe só para mostrar a tela.

## O funil de vendas

Cada oportunidade passa pelas mesmas etapas, e cada etapa é uma coluna do pipeline.

- **01 · Prospecção**: listar empresas com o perfil atendido
- **02 · Abordagem**: primeiro contato pelo canal combinado
- **03 · Qualificação**: confirmar orçamento, decisão, necessidade e prazo
- **04 · R1 · Diagnóstico**: reunião para entender o problema do cliente
- **05 · R2 · Proposta**: apresentar escopo, prazo e preço
- **06 · Fechamento**: negociar condições e assinar

> **Próxima ação sempre com data.** O card mostra um selo quando a data vence.

> **Origem obrigatória.** Saber de onde veio cada oportunidade é o que permite comparar canais no relatório.
$md$, 1),

  ('comercial', 'Qualificação', $md$## Qualificação

Quatro perguntas somam a nota do lead. A nota aparece no card e ordena a fila.

**Q1 · Orçamento**
Existe orçamento reservado para este projeto? Em que faixa?
- Sem orçamento previsto · 0pt (elimina)
- Até R$ 2.000/mês · 1pt
- R$ 2.000 a 5.000/mês · 2pt
- Acima de R$ 5.000/mês · 2pt

**Q2 · Decisão**
Quem aprova a contratação na empresa?
- Não sabe quem aprova · 0pt (elimina)
- Diretoria ou comitê · 1pt
- Aprova junto com um sócio · 1pt
- Aprova sozinho · 2pt

**Q3 · Necessidade**
Qual problema vocês querem resolver primeiro?
- Nenhum problema claro · 0pt (elimina)
- Concorda quando o problema é apontado · 1pt
- Vendas · 2pt
- Operação · 2pt
- Atendimento · 2pt

**Q4 · Prazo**
Para quando vocês precisam do resultado?
- Sem data · 0pt
- Acima de 90 dias · 1pt
- Entre 60 e 90 dias · 1pt
- Entre 30 e 60 dias · 2pt
- Até 30 dias · 2pt

> **Nota mínima para agendar a R1:** 4 pontos. Resposta que elimina encerra a qualificação, qualquer que seja o total.
$md$, 2),

  ('comercial', 'As duas reuniões', $md$## As duas reuniões

**R1 · Diagnóstico**

Ouvir mais do que falar. O objetivo é entender o cenário do cliente e combinar a próxima reunião.

01 Como os clientes chegam até vocês hoje?
02 Qual parte do processo toma mais tempo da equipe?
03 Que número vocês acompanham toda semana?
04 O que precisa mudar nos próximos três meses?

> A R1 termina com a R2 agendada.

**R2 · Proposta**

Retomar o que foi dito na R1, apresentar a proposta e combinar o próximo passo com data.
$md$, 3),

  ('marketing', 'Princípios de marketing', $md$## Princípios de marketing

- **Oferta antes da peça**: público, oferta e mensagem definidos antes de qualquer criação.
- **Consistência**: a mesma identidade em todos os canais.
- **Medição**: toda ação tem um número para acompanhar.
$md$, 1),

  ('marketing', 'Indicadores', $md$## Indicadores

| Métrica | O que mostra | Exemplo de meta |
|---|---|---|
| **CTR** | Interesse no anúncio | 2% |
| **CPL** | Custo por lead | definido por cliente |
| **CVR** | Leads que viram venda | 10% |
| **CAC** | Custo por cliente novo | menor que o ticket |
| **ROAS** | Retorno do investimento em mídia | definido por cliente |

> Os números são comparados semana a semana no relatório do cliente.
$md$, 2),

  ('marketing', 'Identidade visual', $md$## Identidade visual

Cada cliente tem um guia com os elementos da marca:

- **Logo** e suas versões
- **Cores** principais e de apoio
- **Fontes** de título e de texto
- **Tom de voz** com exemplos do que dizer e do que evitar

> O guia fica na pasta do cliente e é a referência de toda peça.
$md$, 3),

  ('marketing', 'Planejamento de conteúdo', $md$## Planejamento de conteúdo

O calendário do mês é montado na primeira semana e aprovado pelo cliente.

- **Pauta**: temas do mês a partir dos objetivos do cliente
- **Produção**: textos e peças em lotes
- **Aprovação**: uma rodada de ajustes por lote
- **Publicação**: datas fixas no calendário
$md$, 4),

  ('gestao', 'Rotina da equipe', $md$## Rotina da equipe

- **Segunda**: planejamento da semana
- **Diário**: atualização rápida das tarefas no quadro
- **Sexta**: revisão do que foi entregue
$md$, 1),

  ('gestao', 'Ferramentas', $md$## Ferramentas

Toda tarefa nasce no CRM, com responsável e prazo. Arquivos de cliente ficam na pasta do cliente.
$md$, 2),

  ('gestao', 'Reuniões internas', $md$## Reuniões internas

- **Semanal do time**: 45 minutos, pauta enviada na véspera
- **Mensal de resultados**: números do mês contra a meta
- **Trimestral**: revisão de metas e prioridades
$md$, 3),

  ('gestao', 'Indicadores internos', $md$## Indicadores internos

- **01 · Entregas no prazo**: tarefas concluídas até a data combinada
- **02 · Tempo de resposta**: horas até o primeiro retorno ao cliente
- **03 · Retenção**: clientes ativos mês a mês
- **04 · Satisfação**: nota do cliente na reunião mensal
$md$, 4),

  ('gestao', 'Plano de 90 dias', $md$## Plano de 90 dias

**Fase 1 · dias 0 a 30**
Definir metas e responsáveis.

**Fase 2 · dias 31 a 60**
Executar e acompanhar os indicadores toda semana.

**Fase 3 · dias 61 a 90**
Comparar com o ponto de partida e decidir os próximos passos.
$md$, 5)
) as v(area, title, content, sort_order)
where not exists (select 1 from public.playbook_sections);
