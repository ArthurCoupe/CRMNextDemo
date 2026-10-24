alter policy "le conforme papel" on public.internal_tasks
  using (public.is_staff());

create table public.internal_task_participants (
  task_id uuid not null references public.internal_tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, profile_id)
);

create index idx_internal_task_participants_profile
  on public.internal_task_participants (profile_id);

alter table public.internal_task_participants enable row level security;
alter table public.internal_task_participants force row level security;

create table public.internal_task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.internal_tasks(id) on delete cascade,
  label text not null check (label ~ '\S' and char_length(label) <= 80),
  url text not null check (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 2000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_internal_task_links_task on public.internal_task_links (task_id);
create index idx_internal_task_links_created_by on public.internal_task_links (created_by);

alter table public.internal_task_links enable row level security;
alter table public.internal_task_links force row level security;

create or replace function public.participa_da_tarefa(p_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    return false;
  end if;
  return exists (
    select 1 from public.internal_task_participants p
     where p.task_id = p_task_id and p.profile_id = auth.uid()
  );
end $$;

revoke all on function public.participa_da_tarefa(uuid) from public, anon;
grant execute on function public.participa_da_tarefa(uuid) to authenticated;

create or replace function public.pode_editar_tarefa(p_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    return false;
  end if;
  return exists (
    select 1 from public.internal_tasks t
     where t.id = p_task_id
       and (
         public.is_owner()
         or public.current_app_role() = 'manager'
         or t.assignee_id = auth.uid()
         or public.participa_da_tarefa(p_task_id)
       )
  );
end $$;

revoke all on function public.pode_editar_tarefa(uuid) from public, anon;
grant execute on function public.pode_editar_tarefa(uuid) to authenticated;

alter policy "edita quem responde" on public.internal_tasks
  using (
    public.is_staff()
    and (
      public.is_owner()
      or public.current_app_role() = 'manager'
      or assignee_id = (select auth.uid())
      or public.participa_da_tarefa(id)
    )
  )
  with check (
    public.is_staff()
    and (
      public.is_owner()
      or public.current_app_role() = 'manager'
      or assignee_id = (select auth.uid())
      or public.participa_da_tarefa(id)
    )
  );

create or replace function private.fn_so_owner_e_manager_trocam_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not (public.is_owner() or public.current_app_role() = 'manager') then
    raise exception 'Só owner e manager trocam o responsável principal. Para ajudar na tarefa, entre como participante.'
      using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.fn_so_owner_e_manager_trocam_responsavel() from public, anon, authenticated;

create trigger trg_internal_tasks_so_owner_e_manager_trocam_responsavel
  before update of assignee_id on public.internal_tasks
  for each row
  when (new.assignee_id is distinct from old.assignee_id)
  execute function private.fn_so_owner_e_manager_trocam_responsavel();

drop policy "owner e manager apagam" on public.internal_tasks;
create policy "owner, manager e quem criou apagam"
  on public.internal_tasks for delete
  using (
    public.is_staff()
    and (
      public.is_owner()
      or (
        public.pode_apagar_cartao(id)
        and (public.current_app_role() = 'manager' or created_by = (select auth.uid()))
      )
    )
  );

create policy "staff lê participantes"
  on public.internal_task_participants for select to authenticated
  using (public.is_staff());
create policy "quem edita a tarefa inclui"
  on public.internal_task_participants for insert to authenticated
  with check (public.is_staff() and public.pode_editar_tarefa(task_id));
create policy "quem edita a tarefa remove"
  on public.internal_task_participants for delete to authenticated
  using (public.is_staff() and public.pode_editar_tarefa(task_id));

revoke all on table public.internal_task_participants from anon, authenticated;
grant select, delete on table public.internal_task_participants to authenticated;
grant insert (task_id, profile_id) on table public.internal_task_participants to authenticated;

create policy "staff lê links"
  on public.internal_task_links for select to authenticated
  using (public.is_staff());
create policy "quem edita a tarefa inclui"
  on public.internal_task_links for insert to authenticated
  with check (public.is_staff() and public.pode_editar_tarefa(task_id));
create policy "quem edita a tarefa remove"
  on public.internal_task_links for delete to authenticated
  using (public.is_staff() and public.pode_editar_tarefa(task_id));

revoke all on table public.internal_task_links from anon, authenticated;
grant select, delete on table public.internal_task_links to authenticated;
grant insert (task_id, label, url) on table public.internal_task_links to authenticated;

create or replace function private.fn_copia_participantes_da_ocorrencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.internal_task_participants (task_id, profile_id)
  select new.id, p.profile_id
    from public.internal_task_participants p
   where p.task_id = new.recorrente_de
  on conflict do nothing;
  return new;
end $$;

revoke all on function private.fn_copia_participantes_da_ocorrencia() from public, anon, authenticated;

create trigger trg_internal_tasks_copia_participantes
  after insert on public.internal_tasks
  for each row
  when (new.recorrente_de is not null)
  execute function private.fn_copia_participantes_da_ocorrencia();

insert into public.task_catalog (category, task_type, ordem) values
  ('Site · web', 'Desenvolver site', 1),
  ('Site · web', 'Subir em domínio', 2);
