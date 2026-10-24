# Next Business CRM: demo

[Versão em português](README.md)

> All data in these screens is fictitious. The company, people, clients and amounts were made up for this demo. The interface is in Portuguese.

Internal CRM for a software house: sales pipeline, accounts, contracts, revenue with MRR and TCV kept apart and a monthly close with snapshots, onboarding, tasks, email alerts, website lead capture and an AI assistant. Role-based access with RLS, a second factor for finance and IDOR tests in CI.

**Stack:** TanStack Start, React, TypeScript, Tailwind, TanStack Query and Supabase (PostgreSQL with RLS), tested with Vitest.

The code is here to read and to run the demo on your machine. There is no hosted version.

## How to run

Requirements: [Docker Desktop](https://www.docker.com/products/docker-desktop/) running, [Node.js](https://nodejs.org/) 20 or newer (the Supabase CLI runs through `npx`) and [bun](https://bun.sh/).

```bash
bun install --frozen-lockfile
bun run demo:db:start
bun run demo:db:recriar
bun run demo:dev
```

The first command installs the dependencies. The second starts a local Supabase used only by the demo (ports 547xx). The third applies the migrations and the seed with the fictitious company (`recriar` means "recreate"). The fourth serves the app at http://localhost:8080: click "Entrar na demo" ("Enter the demo"). To shut the database down, run `bun run demo:db:stop`.

The demo reads no `.env` file and calls no external service: email and captcha are off and the AI answer is simulated.

## License

Code published for portfolio evaluation only. All rights reserved.

## Screens

### Dashboard
Open opportunities, active MRR, goal scoreboard and the pipeline by stage.

![Dashboard](prints/dashboard.png)

### Pipeline
The sales pipeline as a board, with filters by business line and owner and a badge for overdue follow-ups.

![Pipeline](prints/pipeline.png)

### Clients
The client base with status, contracts, monthly value and health signals for each client.

![Clients](prints/clientes.png)

### Contracts
Recurring fees (MRR) and projects (TCV), broken down by business line and service.

![Contracts](prints/contratos.png)

### Finance
MRR and TCV kept apart by business line, plus revenue by service. Users who turn on an authenticator app need a second factor to read and edit financial data.

![Finance](prints/financeiro.png)

### Reports
The funnel by stage, counting everyone who reached each step, and conversion by acquisition channel.

![Reports](prints/relatorios.png)

### Onboarding
The new client's journey, from signature to first result, step by step, with owner and deadline.

![Onboarding](prints/onboarding.png)

### Internal tasks
A task board by person, priority, category and client, with overdue tasks highlighted.

![Internal tasks](prints/tarefas.png)

### Meetings
The meeting calendar, with preparation for client meetings.

![Meetings](prints/reunioes.png)

### Products
The catalog, the single source of prices for contracts and proposals.

![Products](prints/produtos.png)

### Playbook
The company handbook (sales, marketing and management), with search. In the demo the text is a placeholder.

![Playbook](prints/playbook.png)

### AI assistant
Answers questions about the pipeline, tasks and numbers using the context the CRM builds for the person asking, limited by their role. Text typed by clients or leads goes in as data, never as instructions. In the demo the answer is simulated and no AI provider is called.

![AI assistant](prints/assistente-ia.png)
