create or replace function private.fn_sync_onboarding_vindo_do_quadro()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_journey  uuid;
begin
  select f.journey_id into v_journey
    from public.onboarding_tasks o
    join public.onboarding_phases f on f.id = o.phase_id
   where o.internal_task_id = new.id
   limit 1;

  if v_journey is null then
    return null;
  end if;

  if auth.uid() is not null
     and new.assignee_id is distinct from auth.uid()
     and not private.pode_mexer_na_jornada(v_journey) then
    raise exception
      'Este cartao pertence ao onboarding de um cliente que nao e seu. Quem conclui e a pessoa responsavel pela tarefa, ou quem responde pelo cliente.'
      using errcode = '42501';
  end if;

  update public.onboarding_tasks o
     set concluida_em = case when new.col = 'done' then coalesce(o.concluida_em, now()) end
   where o.internal_task_id = new.id
     and (o.concluida_em is not null) is distinct from (new.col = 'done');
  return null;
end $$;

