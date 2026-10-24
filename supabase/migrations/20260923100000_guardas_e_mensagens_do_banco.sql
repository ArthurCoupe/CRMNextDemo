create or replace function private.protege_papel_e_situacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and not public.is_owner() then
    raise exception
      'Somente owner altera papel ou situacao de um perfil.'
      using errcode = '42501';
  end if;

  if old.role = 'owner' and old.active
     and not (new.role = 'owner' and new.active) then
    perform pg_advisory_xact_lock(hashtext('profiles_owner_ativo'));
    if (select count(*) from public.profiles p
         where p.role = 'owner' and p.active and p.id <> old.id) = 0 then
      raise exception
        'A Next precisa de pelo menos um owner ativo.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

create or replace function private.fn_gravar_snapshot(p_ref_month date)
returns table(gravou boolean, mes_gravado date, resultado_do_mes numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_mes       date := date_trunc('month', p_ref_month)::date;
  v_id        uuid;
  v_resultado numeric;
  v_resto     numeric;
begin
  if v_mes >= private.fn_mes_corrente() then
    raise exception 'nao se congela mes corrente nem futuro: %', v_mes
      using errcode = '23514';
  end if;

  select coalesce((select k.custo_total from private.fn_cost_by_unit(v_mes) k
                    where k.bu = 'compartilhado'), 0)
       - coalesce((select sum(r.custo_rateado) from private.fn_result_by_unit(v_mes) r), 0)
    into v_resto;

  insert into public.monthly_snapshots (
    ref_month, mrr_demanda, mrr_sistemas, mrr_firme_total,
    tcv_demanda, tcv_sistemas, receita_caixa, receita_liquida,
    custo_total, custo_compartilhado_nao_rateado, resultado, clientes_ativos
  )
  select
    v_mes,
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.business_unit = 'demanda'), 0),
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.business_unit = 'sistemas'), 0),
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.is_firm), 0),
    coalesce(sum(c.total_value) filter (
      where c.contract_type = 'tcv' and c.business_unit = 'demanda'
        and date_trunc('month', c.start_date)::date = v_mes), 0),
    coalesce(sum(c.total_value) filter (
      where c.contract_type = 'tcv' and c.business_unit = 'sistemas'
        and date_trunc('month', c.start_date)::date = v_mes), 0),
    (select coalesce(sum(r.receita_bruta), 0)   from private.fn_result_by_unit(v_mes) r),
    (select coalesce(sum(r.receita_liquida), 0) from private.fn_result_by_unit(v_mes) r),
    (select coalesce(sum(r.custo_direto + r.custo_rateado), 0)
       from private.fn_result_by_unit(v_mes) r) + v_resto,
    v_resto,
    (select coalesce(sum(r.resultado), 0) from private.fn_result_by_unit(v_mes) r) - v_resto,
    count(distinct c.client_id)
  from public.contracts c
  where private.fn_contrato_vigente_em(c, v_mes)
  on conflict (ref_month) do nothing
  returning monthly_snapshots.id, monthly_snapshots.resultado
  into v_id, v_resultado;

  if v_id is null then
    return query
      select false,
             v_mes,
             (select s.resultado from public.monthly_snapshots s where s.ref_month = v_mes);
    return;
  end if;

  insert into public.monthly_snapshot_units (
    snapshot_id, bu, receita_bruta, imposto, taxas, receita_liquida,
    custo_gastos, custo_folha, custo_participacao, custo_direto,
    custo_rateado, resultado, margem_pct, proporcao_pct)
  select v_id, r.bu, r.receita_bruta, r.imposto, r.taxas, r.receita_liquida,
         r.custo_gastos, r.custo_folha, r.custo_participacao, r.custo_direto,
         r.custo_rateado, r.resultado, r.margem_pct, r.proporcao_pct
  from private.fn_result_by_unit(v_mes) r;

  return query select true, v_mes, v_resultado;
end $$;

create or replace function private.fn_libera_etapa(p_phase_id uuid, p_forcar boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
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
    raise exception 'Esta etapa ja foi liberada em %.',
      to_char(v_liberada at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      using errcode = '23505';
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
     and not exists (select 1
                       from public.role_assignments ra
                       join public.profiles p on p.id = ra.profile_id and p.active
                      where ra.role_key = o.papel);

  if v_faltando is not null then
    raise exception
      'Nao da para liberar esta etapa: sem responsavel configurado para %. Defina em Configuracoes > Papeis antes de liberar.',
      v_faltando using errcode = 'P0001';
  end if;

  for r_item in
    select o.*, ra.profile_id
      from public.onboarding_tasks o
      join public.role_assignments ra on ra.role_key = o.papel
      join public.profiles p on p.id = ra.profile_id and p.active
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

create or replace function private.fn_sync_onboarding_vindo_do_quadro()
returns trigger language plpgsql security definer set search_path = public as $$
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

  if (new.col = 'done' or old.col = 'done')
     and auth.uid() is not null
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

