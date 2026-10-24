# CRM da Next Business

[English version](README.en.md) · [![CI](https://github.com/ArthurCoupe/CRMNextDemo/actions/workflows/ci.yml/badge.svg)](https://github.com/ArthurCoupe/CRMNextDemo/actions/workflows/ci.yml)

> Todos os dados destas telas são fictícios. Empresa, pessoas, clientes e valores foram inventados para esta demonstração.

![Dashboard: oportunidades abertas, MRR ativo, placar de metas e o funil por estágio](prints/dashboard.png)

CRM interno de uma software house, em produção desde setembro de 2026: funil comercial, carteira, contratos, financeiro com MRR e TCV separados, fechamento mensal com snapshot, onboarding, tarefas, captação do formulário do site e assistente de IA.

**Stack:** TanStack Start, React, TypeScript, Tailwind, TanStack Query e Supabase (PostgreSQL com Row Level Security), com Vitest e GitHub Actions.

## Quem fez

Arthur Coupê, engenheiro full stack e CTO da Next Business. Projetei e entreguei este CRM e respondo pela operação dele em produção: arquitetura, banco, segurança, código e deploy. Desenvolvo com agentes de IA e revisão adversarial antes de cada merge.

[LinkedIn](https://www.linkedin.com/in/arthurcoupeg/) · [outros projetos](https://github.com/ArthurCoupe)

## Decisões de engenharia

- **A permissão é decidida no banco, não na tela.** As tabelas de negócio têm Row Level Security, e o papel de quem pede decide o que o Postgres devolve. A interface só esconde o que o banco já recusaria. Veja [`supabase/migrations`](supabase/migrations) e [`src/shared/lib/permissao.ts`](src/shared/lib/permissao.ts).
- **Segundo fator para dinheiro.** Quem ativa o app autenticador (TOTP) só lê e edita o financeiro com sessão `aal2`, e a checagem está nas policies do banco. Veja [a migration](supabase/migrations/20260924110000_c21_aal2_para_quem_tem_totp.sql) e [`src/shared/lib/mfa.ts`](src/shared/lib/mfa.ts).
- **Assistente de IA que não confia no que lê.** O servidor monta o contexto só com o que o papel de quem pergunta pode ver (financeiro só para o dono) e marca texto digitado por lead como dado, nunca como instrução. A pergunta passa por schema, e cada usuário tem limite de 20 perguntas por minuto. Veja [`src/modules/ai/domain/contexto.ts`](src/modules/ai/domain/contexto.ts) e [`src/lib/ai.functions.ts`](src/lib/ai.functions.ts).
- **O mês fechado não muda.** O fechamento grava um snapshot no banco, e editar um contrato depois não altera o mês que passou. Regravar deixa rastro, e desfazer passa pela mesma trava de segundo fator. Veja [o snapshot](supabase/migrations/20260815021747_f15_monthly_snapshots_e_o_mes_que_congela.sql) e [o desfazer](supabase/migrations/20261005035337_desfazer_fechamento_exige_aal2.sql).
- **Mais de 4.000 testes no CI.** Tipos, lint e Vitest rodam a cada push neste repositório ([workflow](.github/workflows/ci.yml)). Os testes de IDOR, em que um usuário tenta abrir o registro de outro, rodam no CI do repositório privado, contra um Supabase que o próprio runner sobe.

## Sobre este repositório

É o retrato público de um sistema privado em produção. O histórico, com mais de 200 pull requests, fica no repositório privado; aqui está o código atual, com empresa, pessoas e números trocados por dados inventados, pronto para rodar na sua máquina. Não há versão hospedada.

## Telas

### Pipeline
O funil comercial em quadro, com filtros por linha de negócio e responsável e o selo de follow-up vencido.

![Pipeline](prints/pipeline.png)

### Clientes
A carteira com status, contratos, valor mensal e sinais de saúde de cada cliente.

![Clientes](prints/clientes.png)

### Contratos
Mensalidades (MRR) e projetos (TCV), decompostos por linha de negócio e frente.

![Contratos](prints/contratos.png)

### Financeiro
MRR e TCV separados por linha de negócio e o faturamento por frente. Quem ativa o app autenticador passa a usar segundo fator para ler e editar dinheiro.

![Financeiro](prints/financeiro.png)

### Relatórios
Funil por etapa, contando quem alcançou cada degrau, e conversão por canal de aquisição.

![Relatórios](prints/relatorios.png)

### Onboarding
A jornada do cliente novo, da assinatura ao primeiro resultado, etapa por etapa, com responsável e prazo.

![Onboarding](prints/onboarding.png)

### Tarefas internas
Quadro de tarefas por pessoa, prioridade, categoria e cliente, com as vencidas em destaque.

![Tarefas internas](prints/tarefas.png)

### Reuniões
Agenda de reuniões, com preparação das reuniões de cliente.

![Reuniões](prints/reunioes.png)

### Produtos
O catálogo, fonte única de preço para contratos e propostas.

![Produtos](prints/produtos.png)

### Playbook
O manual da empresa (comercial, marketing e gestão), com busca. Na demonstração o texto é de exemplo.

![Playbook](prints/playbook.png)

### Assistente de IA
Responde sobre pipeline, tarefas e números com o contexto que o CRM monta para quem pergunta, recortado pelo papel da pessoa. Na demonstração a resposta é simulada e nenhum provedor de IA é chamado.

![Assistente de IA](prints/assistente-ia.png)

## Como rodar

Pré-requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) aberto, [Node.js](https://nodejs.org/) 20 ou mais novo (a CLI do Supabase roda por `npx`) e [bun](https://bun.sh/).

```bash
bun install --frozen-lockfile
bun run demo:db:start
bun run demo:db:recriar
bun run demo:dev
```

O primeiro comando instala as dependências. O segundo sobe um Supabase local só da demo (portas 547xx). O terceiro aplica as migrations e o seed com a empresa fictícia. O quarto abre o app em http://localhost:8080: clique em "Entrar na demo". Para desligar o banco, `bun run demo:db:stop`.

A demo não lê `.env` nem fala com serviço externo: e-mail e captcha ficam desligados e a resposta da IA é simulada.

Para rodar só os testes: `bun run test`.

## Licença

Código publicado só para avaliação de portfólio. Todos os direitos reservados.
