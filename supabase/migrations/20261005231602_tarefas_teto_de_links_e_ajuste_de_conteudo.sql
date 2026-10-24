create or replace function private.fn_teto_de_links_da_tarefa()
returns trigger
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.pode_editar_tarefa(new.task_id) then
    return new;
  end if;
  perform 1 from public.internal_tasks where id = new.task_id for update;
  if (select count(*) from public.internal_task_links where task_id = new.task_id) >= 20 then
    raise exception 'A tarefa já tem 20 links. Remova um antes de incluir outro.'
      using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function private.fn_teto_de_links_da_tarefa() from public, anon, authenticated;

create trigger trg_internal_task_links_teto
  before insert on public.internal_task_links
  for each row
  execute function private.fn_teto_de_links_da_tarefa();

create or replace function public.tarefa_sem_evento_de_conteudo(p_task_id uuid)
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
  return not exists (
    select 1 from public.content_post_events e where e.internal_task_id = p_task_id
  );
end $$;

revoke all on function public.tarefa_sem_evento_de_conteudo(uuid) from public, anon;
grant execute on function public.tarefa_sem_evento_de_conteudo(uuid) to authenticated;

drop policy "owner, manager e quem criou apagam" on public.internal_tasks;
create policy "owner, manager e quem criou apagam"
  on public.internal_tasks for delete
  using (
    public.is_staff()
    and (
      public.is_owner()
      or (
        public.pode_apagar_cartao(id)
        and (
          public.current_app_role() = 'manager'
          or (created_by = (select auth.uid()) and public.tarefa_sem_evento_de_conteudo(id))
        )
      )
    )
  );

create or replace function public.pode_gerir_participantes(p_task_id uuid)
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
  return public.pode_editar_tarefa(p_task_id)
    or exists (
      select 1 from public.internal_tasks t
       where t.id = p_task_id and t.created_by = auth.uid()
    );
end $$;

revoke all on function public.pode_gerir_participantes(uuid) from public, anon;
grant execute on function public.pode_gerir_participantes(uuid) to authenticated;

drop policy "quem edita a tarefa inclui" on public.internal_task_participants;
create policy "quem edita a tarefa inclui"
  on public.internal_task_participants for insert to authenticated
  with check (public.is_staff() and public.pode_gerir_participantes(task_id));
drop policy "quem edita a tarefa remove" on public.internal_task_participants;
create policy "quem edita a tarefa remove"
  on public.internal_task_participants for delete to authenticated
  using (public.is_staff() and public.pode_gerir_participantes(task_id));

