create or replace function private.fn_reatribuir_cartao_de_onboarding_exige_jornada()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_journey  uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  select f.journey_id into v_journey
    from public.onboarding_tasks o
    join public.onboarding_phases f on f.id = o.phase_id
   where o.internal_task_id = new.id
   limit 1;

  if v_journey is null then
    return new;
  end if;

  if not private.pode_mexer_na_jornada(v_journey) then
    raise exception
      'Este cartão é do onboarding de um cliente que não é seu: só quem responde pelo cliente troca o responsável. Quem conclui é a pessoa responsável pela tarefa.'
      using errcode = '42501';
  end if;

  return new;
end $$;

revoke all on function private.fn_reatribuir_cartao_de_onboarding_exige_jornada() from public, anon;

drop trigger if exists trg_internal_tasks_reatribuicao_exige_jornada on public.internal_tasks;

create trigger trg_internal_tasks_reatribuicao_exige_jornada
  before update of assignee_id on public.internal_tasks
  for each row
  when (new.assignee_id is distinct from old.assignee_id)
  execute function private.fn_reatribuir_cartao_de_onboarding_exige_jornada();
