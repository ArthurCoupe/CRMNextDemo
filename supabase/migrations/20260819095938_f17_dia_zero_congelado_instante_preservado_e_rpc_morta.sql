alter table public.onboarding_journeys add column dia_zero date;

update public.onboarding_journeys j
   set dia_zero = coalesce(
     (select c.signed_at from public.clients c where c.id = j.client_id),
     (j.iniciada_em at time zone 'America/Sao_Paulo')::date)
 where dia_zero is null;

alter table public.onboarding_journeys alter column dia_zero set not null;

revoke insert (dia_zero), update (dia_zero) on public.onboarding_journeys from authenticated;

drop function if exists public.quantos_pendentes_na_etapa(uuid);

create or replace function private.fn_instante_de_conclusao_do_item()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.concluida_em is null then
    return new;
  end if;
  if tg_op = 'INSERT' or old.concluida_em is null then
    new.concluida_em := now();
  else
    new.concluida_em := old.concluida_em;
  end if;
  return new;
end $$;

drop trigger if exists trg_onboarding_tasks_instante_do_servidor on public.onboarding_tasks;

create trigger trg_onboarding_tasks_instante_do_servidor
  before insert or update of concluida_em on public.onboarding_tasks
  for each row
  execute function private.fn_instante_de_conclusao_do_item();

create or replace function private.fn_libera_etapa(p_phase_id uuid, p_forcar boolean default false)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_journey   uuid;
  v_client    uuid;
  v_autor     uuid;
  v_ordem     smallint;
  v_dia_zero  date;
  v_liberada  timestamptz;
  v_faltando  text;
  v_pend      integer;
  v_task      uuid;
  v_n         integer := 0;
  v_marcou    integer;
  v_prox      uuid;
  r_item      record;
begin
  select f.journey_id, f.liberada_em, f.ordem, j.client_id, j.created_by, j.dia_zero
    into v_journey, v_liberada, v_ordem, v_client, v_autor, v_dia_zero
    from public.onboarding_phases f
    join public.onboarding_journeys j on j.id = f.journey_id
   where f.id = p_phase_id
     for update of f;

  if v_journey is null then
    raise exception 'Etapa % nao existe.', p_phase_id using errcode = '22023';
  end if;

  if v_liberada is not null then
    raise exception 'Esta etapa ja foi liberada em %.', v_liberada using errcode = '23505';
  end if;

  if not p_forcar and v_ordem > 0 then
    select count(*) into v_pend
      from public.onboarding_tasks o
      join public.onboarding_phases f on f.id = o.phase_id
     where f.journey_id = v_journey and f.ordem = v_ordem - 1
       and (o.concluida_em is null or f.liberada_em is null);
    if v_pend > 0 then
      raise exception
        'A etapa anterior ainda tem % item(ns) pendente(s). Conclua-os, ou force o avanco.',
        v_pend using errcode = 'P0001';
    end if;
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
      join public.role_assignments ra
        on ra.role_key = o.papel and ra.profile_id is not null
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

  if v_n <> (select count(*) from public.onboarding_tasks o where o.phase_id = p_phase_id) then
    raise exception
      'Os responsaveis mudaram durante a liberacao desta etapa. Tente de novo.'
      using errcode = 'P0001';
  end if;

  update public.onboarding_phases set liberada_em = now()
   where id = p_phase_id and liberada_em is null;
  get diagnostics v_marcou = row_count;
  if v_marcou = 0 then
    raise exception 'Esta etapa foi liberada por outro caminho durante a operacao.'
      using errcode = '23505';
  end if;

  if v_n = 0 then
    select f.id into v_prox from public.onboarding_phases f
     where f.journey_id = v_journey and f.ordem = v_ordem + 1 and f.liberada_em is null;
    if v_prox is not null then
      v_n := v_n + private.fn_libera_etapa(v_prox, p_forcar);
    end if;
  end if;

  return v_n;
end $$;

create or replace function public.iniciar_jornada(p_client_id uuid, p_versao smallint default 1)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_journey uuid;
  v_phase   uuid;
  v_vazia   text;
  v_dia     date;
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

  select string_agg(f.nome, ', ' order by f.ordem) into v_vazia
    from public.onboarding_template_phases f
   where f.versao = p_versao
     and not exists (select 1 from public.onboarding_template_tasks t
                      where t.versao = f.versao and t.fase_ordem = f.ordem);
  if v_vazia is not null then
    raise exception 'A versao % do metodo tem etapa sem nenhum item: %. Corrija o metodo antes de abrir jornada.',
      p_versao, v_vazia using errcode = 'P0001';
  end if;

  select coalesce(c.signed_at, (now() at time zone 'America/Sao_Paulo')::date)
    into v_dia from public.clients c where c.id = p_client_id;

  insert into public.onboarding_journeys (client_id, template_versao, dia_zero)
  values (p_client_id, p_versao, v_dia)
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

