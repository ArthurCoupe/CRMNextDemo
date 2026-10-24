# Next Business CRM

[Versão em português](README.md) · [![CI](https://github.com/ArthurCoupe/CRMNextDemo/actions/workflows/ci.yml/badge.svg)](https://github.com/ArthurCoupe/CRMNextDemo/actions/workflows/ci.yml)

> All data in these screens is fictitious. The company, people, clients and amounts were made up for this demo. The interface is in Portuguese.

![Dashboard: open opportunities, active MRR, goal scoreboard and the pipeline by stage](prints/dashboard.png)

Internal CRM for a software house, in production since September 2026: sales pipeline, accounts, contracts, revenue with MRR and TCV kept apart, a monthly close with snapshots, onboarding, tasks, website lead capture and an AI assistant.

**Stack:** TanStack Start, React, TypeScript, Tailwind, TanStack Query and Supabase (PostgreSQL with Row Level Security), with Vitest and GitHub Actions.

## Who built it

Arthur Coupê, full stack engineer and CTO at Next Business. I designed and delivered this CRM and I own its production operation: architecture, database, security, code and deployment. I develop with AI agents and an adversarial review before every merge.

[LinkedIn](https://www.linkedin.com/in/arthurcoupeg/) · [other projects](https://github.com/ArthurCoupe)

## Engineering decisions

- **Permissions are enforced by the database, not the UI.** Business tables have Row Level Security, and the caller's role decides what Postgres returns. The interface only hides what the database would refuse anyway. See [`supabase/migrations`](supabase/migrations) and [`src/shared/lib/permissao.ts`](src/shared/lib/permissao.ts).
- **A second factor for money.** Users who turn on an authenticator app (TOTP) can only read and edit financial data in an `aal2` session, and the check lives in the database policies. See [the migration](supabase/migrations/20260924110000_c21_aal2_para_quem_tem_totp.sql) and [`src/shared/lib/mfa.ts`](src/shared/lib/mfa.ts).
- **An AI assistant that does not trust what it reads.** The server builds the context only from what the caller's role may see (finance only for the owner) and marks text typed by leads as data, never as instructions. The question is validated by a schema, and each user is limited to 20 questions per minute. See [`src/modules/ai/domain/contexto.ts`](src/modules/ai/domain/contexto.ts) and [`src/lib/ai.functions.ts`](src/lib/ai.functions.ts).
- **A closed month does not change.** Closing writes a snapshot in the database, so editing a contract later does not alter past months. Rewriting a snapshot leaves a trail, and undoing a close goes through the same second-factor check. See [the snapshot](supabase/migrations/20260815021747_f15_monthly_snapshots_e_o_mes_que_congela.sql) and [the undo](supabase/migrations/20261005035337_desfazer_fechamento_exige_aal2.sql).
- **4,000+ tests in CI.** Types, lint and Vitest run on every push to this repository ([workflow](.github/workflows/ci.yml)). The IDOR tests, where one user tries to open another user's record, run in the private repository's CI against a Supabase stack the runner starts itself.

## About this repository

This is the public snapshot of a private system in production. The history, with 200+ pull requests, stays in the private repository; here is the current code, with the company, people and numbers replaced by made-up data, ready to run on your machine. There is no hosted version.

## Screens

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
Answers questions about the pipeline, tasks and numbers using the context the CRM builds for the person asking, limited by their role. In the demo the answer is simulated and no AI provider is called.

![AI assistant](prints/assistente-ia.png)

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

To run only the tests: `bun run test`.

## License

Code published for portfolio evaluation only. All rights reserved.
