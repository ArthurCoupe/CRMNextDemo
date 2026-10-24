create or replace function private.pode_mexer_na_jornada(p_journey_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner()
      or (public.current_app_role() = 'manager'
          and exists (select 1 from public.onboarding_journeys j
                        join public.clients c on c.id = j.client_id
                       where j.id = p_journey_id and c.owner_id = auth.uid()));
$$;

create or replace function public.iniciar_jornada(p_client_id uuid, p_versao smallint default 1)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_journey uuid;
  v_phase   uuid;
  r_fase    record;
  r_item    record;
begin
  if not (public.is_owner()
          or (public.current_app_role() = 'manager'
              and exists (select 1 from public.clients c
                           where c.id = p_client_id and c.owner_id = auth.uid()))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.onboarding_template_phases where versao = p_versao) then
    raise exception 'Versao % do metodo de onboarding nao existe.', p_versao
      using errcode = '22023';
  end if;

  insert into public.onboarding_journeys (client_id, template_versao)
  values (p_client_id, p_versao)
  returning id into v_journey;

  for r_fase in
    select * from public.onboarding_template_phases
     where versao = p_versao order by ordem
  loop
    insert into public.onboarding_phases (journey_id, ordem, nome, descricao, periodo, responsavel)
    values (v_journey, r_fase.ordem, r_fase.nome, r_fase.descricao, r_fase.periodo, r_fase.responsavel)
    returning id into v_phase;

    for r_item in
      select * from public.onboarding_template_tasks
       where versao = p_versao and fase_ordem = r_fase.ordem order by ordem
    loop
      insert into public.onboarding_tasks
        (phase_id, ordem, titulo, papel, category, task_type, deadline_days)
      values
        (v_phase, r_item.ordem, r_item.titulo, r_item.papel,
         r_item.category, r_item.task_type, r_item.deadline_days);
    end loop;
  end loop;

  return v_journey;
end $$;

revoke all on function public.iniciar_jornada(uuid, smallint) from public, anon;
grant execute on function public.iniciar_jornada(uuid, smallint) to authenticated;

create or replace function public.liberar_etapa(p_phase_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_journey   uuid;
  v_client    uuid;
  v_abertura  date;
  v_liberada  timestamptz;
  v_faltando  text;
  v_task      uuid;
  v_n         integer := 0;
  r_item      record;
begin
  select f.journey_id, f.liberada_em,
         j.client_id, (j.iniciada_em at time zone 'America/Sao_Paulo')::date
    into v_journey, v_liberada, v_client, v_abertura
    from public.onboarding_phases f
    join public.onboarding_journeys j on j.id = f.journey_id
   where f.id = p_phase_id;

  if v_journey is null then
    raise exception 'Etapa % nao existe.', p_phase_id using errcode = '22023';
  end if;

  if not private.pode_mexer_na_jornada(v_journey) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_liberada is not null then
    raise exception 'Esta etapa ja foi liberada em %.', v_liberada using errcode = '23505';
  end if;

  select string_agg(distinct o.papel, ', ' order by o.papel)
    into v_faltando
    from public.onboarding_tasks o
   where o.phase_id = p_phase_id
     and not exists (select 1 from public.role_assignments ra
                      where ra.role_key = o.papel and ra.profile_id is not null);

  if v_faltando is not null then
    raise exception
      'Nao da para liberar esta etapa: sem responsavel configurado para %. Defina em Configuracoes > Papeis antes de liberar.',
      v_faltando using errcode = 'P0001';
  end if;

  for r_item in
    select o.*, ra.profile_id
      from public.onboarding_tasks o
      join public.role_assignments ra on ra.role_key = o.papel
     where o.phase_id = p_phase_id
     order by o.ordem
  loop
    insert into public.internal_tasks
      (title, description, category, task_type, assignee_id, client_id, due_date)
    values
      (r_item.titulo,
       (select f.nome from public.onboarding_phases f where f.id = p_phase_id),
       r_item.category, r_item.task_type, r_item.profile_id, v_client,
       v_abertura + r_item.deadline_days)
    returning id into v_task;

    update public.onboarding_tasks set internal_task_id = v_task where id = r_item.id;
    v_n := v_n + 1;
  end loop;

  update public.onboarding_phases set liberada_em = now() where id = p_phase_id;
  return v_n;
end $$;

revoke all on function public.liberar_etapa(uuid) from public, anon;
grant execute on function public.liberar_etapa(uuid) to authenticated;

create or replace function private.fn_sync_onboarding_vindo_do_quadro()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.onboarding_tasks o
     set concluida_em = case when new.col = 'done' then coalesce(o.concluida_em, now()) end
   where o.internal_task_id = new.id
     and (o.concluida_em is not null) is distinct from (new.col = 'done');
  return null;
end $$;

create trigger trg_internal_tasks_sincroniza_onboarding
  after update of col on public.internal_tasks
  for each row when (new.col is distinct from old.col)
  execute function private.fn_sync_onboarding_vindo_do_quadro();

create or replace function private.fn_quadro_vindo_do_onboarding()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.internal_task_id is null then
    return null;
  end if;
  update public.internal_tasks t
     set col = case when new.concluida_em is not null then 'done'::task_col
                    else 'todo'::task_col end
   where t.id = new.internal_task_id
     and (t.col = 'done') is distinct from (new.concluida_em is not null);
  return null;
end $$;

create trigger trg_onboarding_tasks_sincroniza_quadro
  after update of concluida_em on public.onboarding_tasks
  for each row when (new.concluida_em is distinct from old.concluida_em)
  execute function private.fn_quadro_vindo_do_onboarding();

