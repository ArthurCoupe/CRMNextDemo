update public.role_assignments set role_key = 'Tráfego' where role_key = 'Trafego';

insert into public.task_catalog (category, task_type, ordem) values
  ('Onboarding · método', 'Ler o resumo da venda', 1),
  ('Onboarding · método', 'Criar o quadro de tarefas do cliente', 2),
  ('Onboarding · método', 'Mandar mensagem de boas-vindas', 3),
  ('Onboarding · método', 'Mandar e-mail de boas-vindas com o link do briefing', 4),
  ('Onboarding · método', 'Registrar data de início e prazos', 5),
  ('Onboarding · método', 'Marcar o cliente como em onboarding', 6),
  ('Onboarding · método', 'Enviar o formulário de briefing', 7),
  ('Onboarding · método', 'Acompanhar o preenchimento do briefing', 8),
  ('Onboarding · método', 'Conferir as respostas do briefing', 9),
  ('Onboarding · método', 'Pedir os acessos às contas do cliente', 10),
  ('Onboarding · método', 'Receber logo, cores e fontes', 11),
  ('Onboarding · método', 'Guardar o briefing na pasta do cliente', 12),
  ('Onboarding · método', 'Agendar a reunião de início', 13),
  ('Onboarding · método', 'Preparar a pauta da reunião de início', 14),
  ('Onboarding · método', 'Conduzir a reunião de início', 15),
  ('Onboarding · método', 'Combinar a meta do primeiro mês', 16),
  ('Onboarding · método', 'Combinar como o cliente aprova as peças', 17),
  ('Onboarding · método', 'Enviar o resumo da reunião de início', 18),
  ('Onboarding · método', 'Preparar as contas de anúncio', 19),
  ('Onboarding · método', 'Organizar os arquivos de marca', 20),
  ('Onboarding · método', 'Definir os temas do primeiro mês', 21),
  ('Onboarding · método', 'Montar o calendário do mês', 22),
  ('Onboarding · método', 'Listar os textos necessários', 23),
  ('Onboarding · método', 'Dar notícia do andamento ao cliente', 24),
  ('Onboarding · método', 'Escrever os textos da primeira entrega', 25),
  ('Onboarding · método', 'Criar as peças da primeira entrega', 26),
  ('Onboarding · método', 'Revisar a primeira entrega', 27),
  ('Onboarding · método', 'Apresentar a primeira entrega', 28),
  ('Onboarding · método', 'Recolher aprovações e ajustes', 29),
  ('Onboarding · método', 'Publicar a primeira peça aprovada', 30),
  ('Onboarding · método', 'Ligar as campanhas', 31),
  ('Onboarding · método', 'Acompanhar as campanhas na primeira semana', 32),
  ('Onboarding · método', 'Enviar parcial ao cliente', 33),
  ('Onboarding · método', 'Reunir os números do mês', 34),
  ('Onboarding · método', 'Montar o relatório do primeiro mês', 35),
  ('Onboarding · método', 'Fazer a reunião de resultado', 36),
  ('Onboarding · método', 'Propor os próximos passos', 37),
  ('Onboarding · método', 'Planejar o mês seguinte', 38),
  ('Onboarding · método', 'Manter a aprovação semanal', 39),
  ('Onboarding · método', 'Enviar o relatório mensal', 40);
create table public.onboarding_template_phases (
  versao       smallint not null,
  ordem        smallint not null,
  nome         text     not null,
  descricao    text     not null,
  periodo      text     not null,
  responsavel  text     not null,
  primary key (versao, ordem)
);
alter table public.onboarding_template_phases enable row level security;

create table public.onboarding_template_tasks (
  versao        smallint not null,
  fase_ordem    smallint not null,
  ordem         smallint not null,
  titulo        text     not null,
  papel         text     not null references public.role_assignments(role_key),
  category      text     not null default 'Onboarding · método',
  task_type     text     not null,
  deadline_days smallint not null check (deadline_days >= 0),
  primary key (versao, fase_ordem, ordem),
  foreign key (versao, fase_ordem)
    references public.onboarding_template_phases(versao, ordem) on delete cascade,
  foreign key (category, task_type)
    references public.task_catalog(category, task_type)
);
alter table public.onboarding_template_tasks enable row level security;

insert into public.onboarding_template_phases (versao, ordem, nome, descricao, periodo, responsavel) values
  (1, 0, 'Etapa 0: Contrato assinado', 'Passagem do comercial para o atendimento e primeiro contato com o cliente.', 'Dia 0', 'Comercial e atendimento'),
  (1, 1, 'Etapa 1: Briefing', 'Coleta das informações do cliente para o time começar.', 'Dias 1 a 3', 'Atendimento'),
  (1, 2, 'Etapa 2: Reunião de início', 'Alinhamento de metas, prazos e forma de aprovação.', 'Dias 4 a 5', 'Atendimento e cliente'),
  (1, 3, 'Etapa 3: Preparação interna', 'O time prepara contas, materiais e calendário.', 'Dias 5 a 7', 'Time'),
  (1, 4, 'Etapa 4: Primeira entrega', 'Produção, revisão e aprovação das primeiras peças.', 'Dias 8 a 14', 'Time e cliente'),
  (1, 5, 'Etapa 5: Publicação', 'Primeiras peças no ar e campanhas ligadas.', 'Dias 15 a 21', 'Tráfego e atendimento'),
  (1, 6, 'Etapa 6: Primeiro relatório', 'Resultado do primeiro mês apresentado ao cliente.', 'Dias 30 a 35', 'Atendimento'),
  (1, 7, 'Etapa 7: Rotina mensal', 'Ciclo mensal de planejamento, produção e relatório.', 'Mês 2 em diante', 'Time');
insert into public.onboarding_template_tasks (versao, fase_ordem, ordem, titulo, papel, task_type, deadline_days) values
  (1, 0, 0, 'Ler o resumo da venda', 'AM', 'Ler o resumo da venda', 1),
  (1, 0, 1, 'Criar o quadro de tarefas do cliente', 'AM', 'Criar o quadro de tarefas do cliente', 1),
  (1, 0, 2, 'Mandar mensagem de boas-vindas', 'AM', 'Mandar mensagem de boas-vindas', 1),
  (1, 0, 3, 'Mandar e-mail de boas-vindas com o link do briefing', 'AM', 'Mandar e-mail de boas-vindas com o link do briefing', 1),
  (1, 0, 4, 'Registrar data de início e prazos', 'AM', 'Registrar data de início e prazos', 1),
  (1, 0, 5, 'Marcar o cliente como em onboarding', 'AM', 'Marcar o cliente como em onboarding', 1),
  (1, 1, 0, 'Enviar o formulário de briefing', 'AM', 'Enviar o formulário de briefing', 1),
  (1, 1, 1, 'Acompanhar o preenchimento do briefing', 'AM', 'Acompanhar o preenchimento do briefing', 3),
  (1, 1, 2, 'Conferir as respostas do briefing', 'AM', 'Conferir as respostas do briefing', 3),
  (1, 1, 3, 'Pedir os acessos às contas do cliente', 'AM', 'Pedir os acessos às contas do cliente', 3),
  (1, 1, 4, 'Receber logo, cores e fontes', 'AM', 'Receber logo, cores e fontes', 3),
  (1, 1, 5, 'Guardar o briefing na pasta do cliente', 'AM', 'Guardar o briefing na pasta do cliente', 3),
  (1, 2, 0, 'Agendar a reunião de início', 'AM', 'Agendar a reunião de início', 4),
  (1, 2, 1, 'Preparar a pauta da reunião de início', 'AM', 'Preparar a pauta da reunião de início', 5),
  (1, 2, 2, 'Conduzir a reunião de início', 'AM', 'Conduzir a reunião de início', 5),
  (1, 2, 3, 'Combinar a meta do primeiro mês', 'AM', 'Combinar a meta do primeiro mês', 5),
  (1, 2, 4, 'Combinar como o cliente aprova as peças', 'AM', 'Combinar como o cliente aprova as peças', 5),
  (1, 2, 5, 'Enviar o resumo da reunião de início', 'AM', 'Enviar o resumo da reunião de início', 5),
  (1, 3, 0, 'Preparar as contas de anúncio', 'Tráfego', 'Preparar as contas de anúncio', 7),
  (1, 3, 1, 'Organizar os arquivos de marca', 'Design', 'Organizar os arquivos de marca', 7),
  (1, 3, 2, 'Definir os temas do primeiro mês', 'AM', 'Definir os temas do primeiro mês', 7),
  (1, 3, 3, 'Montar o calendário do mês', 'AM', 'Montar o calendário do mês', 7),
  (1, 3, 4, 'Listar os textos necessários', 'AM', 'Listar os textos necessários', 7),
  (1, 3, 5, 'Dar notícia do andamento ao cliente', 'AM', 'Dar notícia do andamento ao cliente', 7),
  (1, 4, 0, 'Escrever os textos da primeira entrega', 'Copy', 'Escrever os textos da primeira entrega', 11),
  (1, 4, 1, 'Criar as peças da primeira entrega', 'Design', 'Criar as peças da primeira entrega', 13),
  (1, 4, 2, 'Revisar a primeira entrega', 'AM', 'Revisar a primeira entrega', 14),
  (1, 4, 3, 'Apresentar a primeira entrega', 'AM', 'Apresentar a primeira entrega', 14),
  (1, 4, 4, 'Recolher aprovações e ajustes', 'AM', 'Recolher aprovações e ajustes', 14),
  (1, 5, 0, 'Publicar a primeira peça aprovada', 'AM', 'Publicar a primeira peça aprovada', 16),
  (1, 5, 1, 'Ligar as campanhas', 'Tráfego', 'Ligar as campanhas', 17),
  (1, 5, 2, 'Acompanhar as campanhas na primeira semana', 'Tráfego', 'Acompanhar as campanhas na primeira semana', 21),
  (1, 5, 3, 'Enviar parcial ao cliente', 'AM', 'Enviar parcial ao cliente', 21),
  (1, 6, 0, 'Reunir os números do mês', 'AM', 'Reunir os números do mês', 32),
  (1, 6, 1, 'Montar o relatório do primeiro mês', 'AM', 'Montar o relatório do primeiro mês', 33),
  (1, 6, 2, 'Fazer a reunião de resultado', 'AM', 'Fazer a reunião de resultado', 35),
  (1, 6, 3, 'Propor os próximos passos', 'AM', 'Propor os próximos passos', 35),
  (1, 7, 0, 'Planejar o mês seguinte', 'AM', 'Planejar o mês seguinte', 35),
  (1, 7, 1, 'Manter a aprovação semanal', 'AM', 'Manter a aprovação semanal', 35),
  (1, 7, 2, 'Enviar o relatório mensal', 'AM', 'Enviar o relatório mensal', 35);
create table public.onboarding_journeys (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete restrict,
  template_versao smallint not null,
  iniciada_em     timestamptz not null default now(),
  concluida_em    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.onboarding_journeys enable row level security;

create unique index uniq_jornada_aberta_por_cliente
  on public.onboarding_journeys (client_id) where concluida_em is null;

create table public.onboarding_phases (
  id           uuid primary key default gen_random_uuid(),
  journey_id   uuid not null references public.onboarding_journeys(id) on delete cascade,
  ordem        smallint not null,
  nome         text     not null,
  descricao    text     not null,
  periodo      text     not null,
  responsavel  text     not null,
  liberada_em  timestamptz,
  unique (journey_id, ordem)
);
alter table public.onboarding_phases enable row level security;

create table public.onboarding_tasks (
  id               uuid primary key default gen_random_uuid(),
  phase_id         uuid not null references public.onboarding_phases(id) on delete cascade,
  ordem            smallint not null,
  titulo           text     not null,
  papel            text     not null,
  category         text     not null,
  task_type        text     not null,
  deadline_days    smallint not null,
  internal_task_id uuid unique references public.internal_tasks(id) on delete set null,
  concluida_em     timestamptz,
  unique (phase_id, ordem),
  foreign key (category, task_type)
    references public.task_catalog(category, task_type)
);
alter table public.onboarding_tasks enable row level security;

create policy "r template de fase: staff le" on public.onboarding_template_phases
  for select using (public.is_staff());
create policy "w template de fase: owner escreve" on public.onboarding_template_phases
  for all using (public.is_owner()) with check (public.is_owner());

create policy "r template de item: staff le" on public.onboarding_template_tasks
  for select using (public.is_staff());
create policy "w template de item: owner escreve" on public.onboarding_template_tasks
  for all using (public.is_owner()) with check (public.is_owner());

create policy "r jornada: staff le" on public.onboarding_journeys
  for select using (public.is_staff());
create policy "w jornada: owner escreve" on public.onboarding_journeys
  for all using (public.is_owner()) with check (public.is_owner());
create policy "w jornada: manager nos clientes dele" on public.onboarding_journeys
  for update using (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.clients c
                 where c.id = onboarding_journeys.client_id and c.owner_id = auth.uid())
  ) with check (public.current_app_role() = 'manager');

create policy "r etapa: staff le" on public.onboarding_phases
  for select using (public.is_staff());
create policy "w etapa: owner escreve" on public.onboarding_phases
  for all using (public.is_owner()) with check (public.is_owner());
create policy "w etapa: manager nos clientes dele" on public.onboarding_phases
  for update using (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.onboarding_journeys j
                  join public.clients c on c.id = j.client_id
                 where j.id = onboarding_phases.journey_id and c.owner_id = auth.uid())
  ) with check (public.current_app_role() = 'manager');

create policy "r item: staff le" on public.onboarding_tasks
  for select using (public.is_staff());
create policy "w item: owner escreve" on public.onboarding_tasks
  for all using (public.is_owner()) with check (public.is_owner());
create policy "w item: manager nos clientes dele" on public.onboarding_tasks
  for update using (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.onboarding_phases f
                  join public.onboarding_journeys j on j.id = f.journey_id
                  join public.clients c on c.id = j.client_id
                 where f.id = onboarding_tasks.phase_id and c.owner_id = auth.uid())
  ) with check (public.current_app_role() = 'manager');

create trigger trg_onboarding_journeys_updated_at
  before update on public.onboarding_journeys
  for each row execute function public.set_updated_at();

create index idx_onboarding_phases_journey on public.onboarding_phases (journey_id, ordem);
create index idx_onboarding_tasks_phase    on public.onboarding_tasks (phase_id, ordem);
create index idx_onboarding_journeys_client on public.onboarding_journeys (client_id);
