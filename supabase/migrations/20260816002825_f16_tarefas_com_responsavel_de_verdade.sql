create type task_priority   as enum ('baixa', 'media', 'alta', 'urgente');
create type task_col        as enum ('todo', 'doing', 'review', 'done');
create type task_recurrence as enum ('nenhuma', 'semanal', 'quinzenal', 'mensal');

create table public.task_catalog (
  category  text not null,
  task_type text not null,
  ordem     int  not null,
  ativo     boolean not null default true,
  primary key (category, task_type)
);
alter table public.task_catalog enable row level security;

insert into public.task_catalog (category, task_type, ordem) values
  ('Posicionamento · conteúdo', 'Post estático', 1),
  ('Posicionamento · conteúdo', 'Carrossel', 2),
  ('Posicionamento · conteúdo', 'Reels / vídeo curto', 3),
  ('Posicionamento · conteúdo', 'Legenda / copy de post', 4),
  ('Posicionamento · conteúdo', 'Roteiro de vídeo', 5),
  ('Posicionamento · conteúdo', 'Cronograma editorial do mês', 6),
  ('Posicionamento · conteúdo', 'Definir linha editorial', 7),
  ('Posicionamento · conteúdo', 'Isca digital (e-book / checklist)', 8),
  ('Posicionamento · conteúdo', 'Landing page', 9),
  ('Posicionamento · conteúdo', 'Identidade visual / template', 10),
  ('Posicionamento · conteúdo', 'Revisão interna (checklist anti-erro)', 11),
  ('Tráfego · performance', 'Estruturar BM e ativos', 1),
  ('Tráfego · performance', 'Criar campanha', 2),
  ('Tráfego · performance', 'Criar criativo de anúncio', 3),
  ('Tráfego · performance', 'Otimização diária de campanha', 4),
  ('Tráfego · performance', 'Configurar pixel / GTM', 5),
  ('Tráfego · performance', 'Configurar API de conversões', 6),
  ('Tráfego · performance', 'Montar públicos e segmentações', 7),
  ('Tráfego · performance', 'Teste A/B de criativo', 8),
  ('Tráfego · performance', 'Relatório de performance', 9),
  ('Tráfego · performance', 'Auditoria de conta', 10),
  ('Comercial · vendas', 'Montar lista de prospecção', 1),
  ('Comercial · vendas', 'Escrever script SDR', 2),
  ('Comercial · vendas', 'Escrever script de fechamento', 3),
  ('Comercial · vendas', 'Montar apresentação comercial', 4),
  ('Comercial · vendas', 'Elaborar proposta', 5),
  ('Comercial · vendas', 'Fazer follow-up', 6),
  ('Comercial · vendas', 'Agendar reunião', 7),
  ('Comercial · vendas', 'Preparar pauta de R1', 8),
  ('Comercial · vendas', 'Preparar pauta de R2', 9),
  ('Comercial · vendas', 'Registrar ata de reunião', 10),
  ('Sistemas & IA · software', 'Levantamento de requisitos', 1),
  ('Sistemas & IA · software', 'Modelagem de banco de dados', 2),
  ('Sistemas & IA · software', 'Desenvolver tela / componente', 3),
  ('Sistemas & IA · software', 'Integração / API', 4),
  ('Sistemas & IA · software', 'Correção de bug', 5),
  ('Sistemas & IA · software', 'Teste e QA', 6),
  ('Sistemas & IA · software', 'Deploy / publicação', 7),
  ('Sistemas & IA · software', 'Documentação técnica', 8),
  ('Sistemas & IA · software', 'Criar automação', 9),
  ('Sistemas & IA · software', 'Criar agente de IA', 10),
  ('Sistemas & IA · software', 'Revisão de RLS e segurança', 11),
  ('Sistemas & IA · software', 'Migração de dados', 12),
  ('Gestão · operação', 'Reunião de kick-off', 1),
  ('Gestão · operação', 'Relatório mensal do cliente', 2),
  ('Gestão · operação', 'Consolidar números do mês', 3),
  ('Gestão · operação', 'Coletar acessos do cliente', 4),
  ('Gestão · operação', 'Enviar formulário de briefing', 5),
  ('Gestão · operação', 'Estudo / pesquisa', 6),
  ('Gestão · operação', 'Treinamento interno', 7),
  ('Gestão · operação', 'Auditoria de processo', 8),
  ('Gestão · operação', 'Documentar processo', 9);

create policy "staff le o catalogo" on public.task_catalog
  for select using (public.is_staff());
create policy "owner edita o catalogo" on public.task_catalog
  for all using (public.is_owner()) with check (public.is_owner());

create table public.role_assignments (
  role_key   text primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.role_assignments enable row level security;

insert into public.role_assignments (role_key) values
  ('AM'), ('Trafego'), ('Design'), ('Copy'), ('Closer');

create policy "staff le os papeis" on public.role_assignments
  for select using (public.is_staff());
create policy "owner edita os papeis" on public.role_assignments
  for all using (public.is_owner()) with check (public.is_owner());

create table public.internal_tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (btrim(title) <> ''),
  description    text,
  category       text not null,
  task_type      text not null,
  assignee_id    uuid references public.profiles(id) on delete set null,
  client_id      uuid references public.clients(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  col            task_col        not null default 'todo',
  priority       task_priority   not null default 'media',
  due_date       date,
  recurrence     task_recurrence not null default 'nenhuma',
  recorrente_de  uuid references public.internal_tasks(id) on delete set null,
  concluida_em   timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (category, task_type) references public.task_catalog(category, task_type)
);
alter table public.internal_tasks enable row level security;

create index internal_tasks_assignee_col_idx on public.internal_tasks (assignee_id, col);
create index internal_tasks_due_idx          on public.internal_tasks (due_date) where col <> 'done';
create index internal_tasks_client_idx       on public.internal_tasks (client_id) where client_id is not null;

create trigger trg_internal_tasks_updated_at
  before update on public.internal_tasks
  for each row execute function public.set_updated_at();

create policy "le conforme papel" on public.internal_tasks
  for select using (
    public.is_owner()
    or public.current_app_role() = 'manager'
    or assignee_id = auth.uid()
    or created_by  = auth.uid()
  );

create policy "staff cria tarefa" on public.internal_tasks
  for insert with check (public.is_staff());

create policy "edita quem responde" on public.internal_tasks
  for update using (
    public.is_owner()
    or public.current_app_role() = 'manager'
    or assignee_id = auth.uid()
  ) with check (
    public.is_owner()
    or public.current_app_role() = 'manager'
    or assignee_id = auth.uid()
  );

create policy "owner e manager apagam" on public.internal_tasks
  for delete using (public.is_owner() or public.current_app_role() = 'manager');

revoke all on table public.internal_tasks   from anon;
revoke all on table public.task_catalog     from anon;
revoke all on table public.role_assignments from anon;
grant select, insert, update, delete on table public.internal_tasks   to authenticated;
grant select, insert, update, delete on table public.task_catalog     to authenticated;
grant select, insert, update, delete on table public.role_assignments to authenticated;

create function private.fn_gera_proxima_ocorrencia()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_passo interval := case new.recurrence
                        when 'semanal'   then interval '7 days'
                        when 'quinzenal' then interval '14 days'
                        when 'mensal'    then interval '1 month'
                      end;
begin
  if v_passo is null then
    return new;
  end if;

  insert into public.internal_tasks (
    title, description, category, task_type, assignee_id, client_id,
    opportunity_id, priority, due_date, recurrence, recorrente_de, created_by
  )
  values (
    new.title, new.description, new.category, new.task_type, new.assignee_id,
    new.client_id, new.opportunity_id, new.priority,
    (coalesce(new.due_date, public.sp_today()) + v_passo)::date,
    new.recurrence, new.id, new.created_by
  );

  return new;
end $fn$;

create trigger trg_internal_tasks_recorrencia
  after update of col on public.internal_tasks
  for each row
  when (new.col = 'done' and old.col <> 'done' and new.recurrence <> 'nenhuma')
  execute function private.fn_gera_proxima_ocorrencia();

create function private.fn_carimba_conclusao()
returns trigger
language plpgsql set search_path = public as $fn$
begin
  new.concluida_em := case when new.col = 'done' then coalesce(new.concluida_em, now()) end;
  return new;
end $fn$;

create trigger trg_internal_tasks_conclusao
  before update of col on public.internal_tasks
  for each row when (new.col is distinct from old.col)
  execute function private.fn_carimba_conclusao();
