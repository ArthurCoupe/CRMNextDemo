create function private.internal_tasks_carimba_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    return new;
  end if;

  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

create trigger trg_internal_tasks_carimba_autor
  before insert or update on public.internal_tasks
  for each row execute function private.internal_tasks_carimba_autor();

drop policy "le conforme papel"      on public.internal_tasks;
drop policy "edita quem responde"    on public.internal_tasks;
drop policy "owner e manager apagam" on public.internal_tasks;

create policy "le conforme papel" on public.internal_tasks
  for select using (
    public.is_staff()
    and (
      public.is_owner()
      or public.current_app_role() = 'manager'
      or assignee_id = auth.uid()
      or created_by  = auth.uid()
    )
  );

create policy "edita quem responde" on public.internal_tasks
  for update using (
    public.is_staff()
    and (
      public.is_owner()
      or public.current_app_role() = 'manager'
      or assignee_id = auth.uid()
    )
  ) with check (
    public.is_staff()
    and (
      public.is_owner()
      or public.current_app_role() = 'manager'
      or assignee_id = auth.uid()
    )
  );

create policy "owner e manager apagam" on public.internal_tasks
  for delete using (
    public.is_staff() and (public.is_owner() or public.current_app_role() = 'manager')
  );

alter table public.internal_tasks
  add column dia_ancora smallint check (dia_ancora between 1 and 31);

update public.internal_tasks
   set dia_ancora = extract(day from due_date)::smallint
 where due_date is not null and dia_ancora is null;

create or replace function private.fn_gera_proxima_ocorrencia()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_base    date     := coalesce(new.due_date, public.sp_today());
  v_ancora  smallint := coalesce(new.dia_ancora, extract(day from v_base)::smallint);
  v_proximo date;
  v_mes     date;
  v_ultimo  smallint;
begin
  if exists (
    select 1 from public.internal_tasks x
     where x.recorrente_de = new.id and x.col <> 'done'
  ) then
    return new;
  end if;

  if new.recurrence = 'semanal' then
    v_proximo := v_base + 7;
  elsif new.recurrence = 'quinzenal' then
    v_proximo := v_base + 14;
  elsif new.recurrence = 'mensal' then
    v_mes    := (date_trunc('month', v_base) + interval '1 month')::date;
    v_ultimo := extract(day from (date_trunc('month', v_mes) + interval '1 month - 1 day'))::smallint;
    v_proximo := v_mes + (least(v_ancora, v_ultimo) - 1);
  else
    return new;
  end if;

  insert into public.internal_tasks (
    title, description, category, task_type, assignee_id, client_id,
    opportunity_id, priority, due_date, recurrence, recorrente_de, created_by,
    dia_ancora
  )
  values (
    new.title, new.description, new.category, new.task_type, new.assignee_id,
    new.client_id, new.opportunity_id, new.priority, v_proximo,
    new.recurrence, new.id, new.created_by, v_ancora
  );

  return new;
end $$;

