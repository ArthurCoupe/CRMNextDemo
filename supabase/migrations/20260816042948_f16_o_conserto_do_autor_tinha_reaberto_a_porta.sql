drop trigger if exists trg_internal_tasks_carimba_autor on public.internal_tasks;
drop function if exists private.internal_tasks_carimba_autor();

alter table public.internal_tasks alter column created_by set default auth.uid();

alter table public.internal_tasks drop column dia_ancora;

alter table public.internal_tasks
  add column raiz_recorrente uuid references public.internal_tasks(id) on delete set null;

revoke insert (created_by, recorrente_de, raiz_recorrente),
       update (created_by, recorrente_de, raiz_recorrente)
  on public.internal_tasks from authenticated;

update public.internal_tasks f
   set raiz_recorrente = coalesce(p.raiz_recorrente, p.id)
  from public.internal_tasks p
 where f.recorrente_de = p.id and f.raiz_recorrente is null;

create or replace function private.fn_gera_proxima_ocorrencia()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_raiz    uuid     := coalesce(new.raiz_recorrente, new.id);
  v_base    date     := coalesce(new.due_date, public.sp_today());
  v_ancora  smallint;
  v_proximo date;
  v_mes     date;
  v_ultimo  smallint;
begin
  if exists (
    select 1 from public.internal_tasks x
     where coalesce(x.raiz_recorrente, x.id) = v_raiz
       and x.id <> new.id
       and x.col <> 'done'
  ) then
    return new;
  end if;

  select extract(day from r.due_date)::smallint into v_ancora
    from public.internal_tasks r where r.id = v_raiz;
  v_ancora := coalesce(v_ancora, extract(day from v_base)::smallint);

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
    opportunity_id, priority, due_date, recurrence, recorrente_de,
    raiz_recorrente, created_by
  )
  values (
    new.title, new.description, new.category, new.task_type, new.assignee_id,
    new.client_id, new.opportunity_id, new.priority, v_proximo,
    new.recurrence, new.id, v_raiz,
    (select r.created_by from public.internal_tasks r where r.id = v_raiz)
  );

  return new;
end $$;

