create or replace function private.fn_assinatura_ancora_a_jornada()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ancoradas uuid[];
begin
  with ancorada as (
    update public.onboarding_journeys j
       set dia_zero = new.signed_at
     where j.client_id = new.id
       and j.dia_zero is null
    returning j.id
  )
  select array_agg(id) into v_ancoradas from ancorada;

  if array_length(v_ancoradas, 1) is null then
    return null;
  end if;

  update public.internal_tasks t
     set due_date = new.signed_at + o.deadline_days
    from public.onboarding_tasks o
    join public.onboarding_phases f on f.id = o.phase_id
   where t.id = o.internal_task_id
     and f.journey_id = any (v_ancoradas)
     and o.concluida_em is null;

  return null;
end $$;

drop trigger if exists trg_clients_assinatura_ancora_jornada on public.clients;

create trigger trg_clients_assinatura_ancora_jornada
  after update of signed_at on public.clients
  for each row
  when (new.signed_at is not null and old.signed_at is distinct from new.signed_at)
  execute function private.fn_assinatura_ancora_a_jornada();

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
  v_pula      integer;
  v_task      uuid;
  v_n         integer := 0;
  v_marcou    integer;
  v_prox      uuid;
  r_item      record;
begin
  select f.journey_id, f.liberada_em, f.ordem, j.client_id, j.created_by,
         coalesce(j.dia_zero, (j.iniciada_em at time zone 'America/Sao_Paulo')::date)
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

  if p_forcar then
    select count(*) into v_pula
      from public.onboarding_phases f
     where f.journey_id = v_journey and f.ordem < v_ordem and f.liberada_em is null;
    if v_pula > 0 then
      raise exception
        'Forcar avanco vale so para a primeira etapa bloqueada: ha % etapa(s) anterior(es) ainda nao liberada(s).',
        v_pula using errcode = 'P0001';
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

