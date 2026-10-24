alter table public.onboarding_journeys
  add column created_by uuid default auth.uid() references public.profiles(id) on delete set null;

revoke insert (created_by), update (created_by)
  on public.onboarding_journeys from authenticated;

drop policy "w jornada: manager nos clientes dele" on public.onboarding_journeys;
create policy "w jornada: manager nos clientes dele" on public.onboarding_journeys
  for update using (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.clients c
                 where c.id = onboarding_journeys.client_id and c.owner_id = auth.uid())
  ) with check (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.clients c
                 where c.id = onboarding_journeys.client_id and c.owner_id = auth.uid())
  );

drop policy "w etapa: manager nos clientes dele" on public.onboarding_phases;
create policy "w etapa: manager nos clientes dele" on public.onboarding_phases
  for update using (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.onboarding_journeys j
                  join public.clients c on c.id = j.client_id
                 where j.id = onboarding_phases.journey_id and c.owner_id = auth.uid())
  ) with check (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.onboarding_journeys j
                  join public.clients c on c.id = j.client_id
                 where j.id = onboarding_phases.journey_id and c.owner_id = auth.uid())
  );

drop policy "w item: manager nos clientes dele" on public.onboarding_tasks;
create policy "w item: manager nos clientes dele" on public.onboarding_tasks
  for update using (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.onboarding_phases f
                  join public.onboarding_journeys j on j.id = f.journey_id
                  join public.clients c on c.id = j.client_id
                 where f.id = onboarding_tasks.phase_id and c.owner_id = auth.uid())
  ) with check (
    public.current_app_role() = 'manager'
    and exists (select 1 from public.onboarding_phases f
                  join public.onboarding_journeys j on j.id = f.journey_id
                  join public.clients c on c.id = j.client_id
                 where f.id = onboarding_tasks.phase_id and c.owner_id = auth.uid())
  );

create or replace function private.fn_libera_etapa(p_phase_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_journey   uuid;
  v_client    uuid;
  v_autor     uuid;
  v_dia_zero  date;
  v_liberada  timestamptz;
  v_faltando  text;
  v_task      uuid;
  v_n         integer := 0;
  v_marcou    integer;
  r_item      record;
begin
  select f.journey_id, f.liberada_em, j.client_id, j.created_by,
         coalesce(c.signed_at, (j.iniciada_em at time zone 'America/Sao_Paulo')::date)
    into v_journey, v_liberada, v_client, v_autor, v_dia_zero
    from public.onboarding_phases f
    join public.onboarding_journeys j on j.id = f.journey_id
    join public.clients c on c.id = j.client_id
   where f.id = p_phase_id
     for update of f;

  if v_journey is null then
    raise exception 'Etapa % nao existe.', p_phase_id using errcode = '22023';
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
      (title, description, category, task_type, assignee_id, client_id, due_date, created_by)
    values
      (r_item.titulo,
       (select f.nome from public.onboarding_phases f where f.id = p_phase_id),
       r_item.category, r_item.task_type, r_item.profile_id, v_client,
       v_dia_zero + r_item.deadline_days,
       v_autor)
    returning id into v_task;

    update public.onboarding_tasks set internal_task_id = v_task where id = r_item.id;
    v_n := v_n + 1;
  end loop;

  update public.onboarding_phases set liberada_em = now()
   where id = p_phase_id and liberada_em is null;
  get diagnostics v_marcou = row_count;
  if v_marcou = 0 then
    raise exception 'Esta etapa foi liberada por outro caminho durante a operacao.'
      using errcode = '23505';
  end if;

  return v_n;
end $$;

create or replace function private.fn_avanca_quando_etapa_fecha()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_journey  uuid;
  v_ordem    smallint;
  v_prox     uuid;
  v_pendente boolean;
begin
  select f.journey_id, f.ordem into v_journey, v_ordem
    from public.onboarding_phases f where f.id = new.phase_id;

  select exists (select 1 from public.onboarding_tasks o
                  where o.phase_id = new.phase_id and o.concluida_em is null)
    into v_pendente;

  if v_pendente then
    begin
      update public.onboarding_journeys
         set concluida_em = null
       where id = v_journey and concluida_em is not null;
    exception when others then
      null;
    end;
    return null;
  end if;

  select f.id into v_prox
    from public.onboarding_phases f
   where f.journey_id = v_journey and f.ordem = v_ordem + 1 and f.liberada_em is null;

  if v_prox is null then
    if not exists (
      select 1 from public.onboarding_phases f
       where f.journey_id = v_journey
         and (f.liberada_em is null
              or exists (select 1 from public.onboarding_tasks o
                          where o.phase_id = f.id and o.concluida_em is null))
    ) then
      begin
        update public.onboarding_journeys
           set concluida_em = coalesce(concluida_em, now())
         where id = v_journey;
      exception when others then
        null;
      end;
    end if;
    return null;
  end if;

  begin
    perform private.fn_libera_etapa(v_prox);
  exception when others then
    null;
  end;

  return null;
end $$;

