# CRM da Next Business: demonstração

[English version](README.en.md)

> Todos os dados destas telas são fictícios. Empresa, pessoas, clientes e valores foram inventados para esta demonstração.

CRM interno de uma software house: funil comercial, carteira, contratos, financeiro com MRR e TCV separados e fechamento mensal com snapshot, onboarding, tarefas, avisos por e-mail, captação do formulário do site e assistente de IA. Acesso por papel com RLS, segundo fator para o financeiro e testes de IDOR no CI.

**Stack:** TanStack Start, React, TypeScript, Tailwind, TanStack Query e Supabase (PostgreSQL com RLS), com Vitest.

O código está aqui para leitura e para rodar a demonstração na sua máquina. Não há versão hospedada.

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

## Licença

Código publicado só para avaliação de portfólio. Todos os direitos reservados.

## Telas

### Dashboard
Oportunidades abertas, MRR ativo, placar de metas e o funil por estágio.

![Dashboard](prints/dashboard.png)

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
Responde sobre pipeline, tarefas e números com o contexto que o CRM monta para quem pergunta, recortado pelo papel da pessoa. Texto digitado por cliente ou lead entra como dado, nunca como instrução. Na demonstração a resposta é simulada e nenhum provedor de IA é chamado.

![Assistente de IA](prints/assistente-ia.png)
