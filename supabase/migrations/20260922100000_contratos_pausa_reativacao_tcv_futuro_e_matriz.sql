create or replace function public.save_contract(
  p_client_id uuid, p_name text, p_type contract_type, p_bu business_unit, p_items jsonb, p_start_date date,
  p_contract_id uuid default null::uuid, p_monthly numeric default null::numeric, p_total numeric default null::numeric,
  p_billing_months integer default null::integer, p_duration_months integer default null::integer,
  p_commitment_months integer default null::integer, p_is_firm boolean default true,
  p_billing_active boolean default null::boolean, p_pause_reason text default null::text,
  p_end_date date default null::date, p_delivery_deadline date default null::date,
  p_payment_method payment_method default 'transferencia'::payment_method, p_installments integer default null::integer,
  p_is_commissionable boolean default true, p_status contract_status default 'active'::contract_status,
  p_notes text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id            uuid;
  v_qtd_itens     int;
  v_incoerentes   int;
  v_soma_itens    numeric;
  v_esperado      numeric;
  v_billing       boolean;
begin
  if not public.is_owner() then
    raise exception 'Somente owner grava contrato.' using errcode = '42501';
  end if;

  set constraints all deferred;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'A decomposição por frente é obrigatória: envie ao menos um item.'
      using errcode = '22023';
  end if;

  select count(*) into v_qtd_itens from jsonb_array_elements(p_items);
  if v_qtd_itens = 0 then
    raise exception 'A decomposição por frente é obrigatória: envie ao menos um item.'
      using errcode = '22023';
  end if;

  select count(*) into v_incoerentes
  from jsonb_array_elements(p_items) it
  where (case (it->>'front')
           when 'sistemas' then 'sistemas'::business_unit
           else 'demanda'::business_unit
         end) <> p_bu;

  if v_incoerentes > 0 then
    raise exception
      'Frente incompatível com a linha de negócio: % item(ns) de outra BU. Posicionamento, tráfego e comercial são de Demanda; sistemas é de Sistemas.',
      v_incoerentes
      using errcode = '22023';
  end if;

  select coalesce(sum((it->>'value')::numeric), 0) into v_soma_itens
  from jsonb_array_elements(p_items) it;

  v_esperado := coalesce(p_monthly, p_total);

  if v_esperado is null then
    raise exception 'Contrato % exige %.',
      p_type,
      case p_type when 'mrr' then 'valor mensal' else 'valor total e meses de cobrança' end
      using errcode = '22023';
  end if;

  if v_soma_itens <> v_esperado then
    raise exception
      'A soma dos itens (%) não fecha com o valor do contrato (%). Ajuste a decomposição por frente.',
      v_soma_itens, v_esperado
      using errcode = '23514';
  end if;

  if p_type = 'tcv' and coalesce(p_billing_months, 0) <= 0 then
    raise exception 'Contrato tcv exige meses de cobrança maior que zero.' using errcode = '22023';
  end if;

  if p_status = 'paused' and p_billing_active is null then
    raise exception
      'Pausar exige decisão explícita sobre a cobrança: informe se ela continua ou não.'
      using errcode = '22023';
  end if;

  v_billing := coalesce(p_billing_active, true);

  if p_contract_id is null then
    insert into public.contracts (
      client_id, name, contract_type, business_unit,
      monthly_value, total_value, billing_months, duration_months, commitment_months,
      is_firm, billing_active, billing_paused_at, pause_reason,
      start_date, end_date, delivery_deadline,
      payment_method, installments, is_commissionable, status, notes
    ) values (
      p_client_id, p_name, p_type, p_bu,
      p_monthly, p_total, p_billing_months, p_duration_months, p_commitment_months,
      p_is_firm, v_billing,
      case when not v_billing then public.sp_today() end,
      p_pause_reason,
      p_start_date, p_end_date, p_delivery_deadline,
      p_payment_method, p_installments, p_is_commissionable, p_status, p_notes
    )
    returning id into v_id;
  else
    update public.contracts set
      client_id = p_client_id, name = p_name, contract_type = p_type, business_unit = p_bu,
      monthly_value = p_monthly, total_value = p_total, billing_months = p_billing_months,
      duration_months = p_duration_months, commitment_months = p_commitment_months,
      is_firm = p_is_firm, billing_active = v_billing,
      billing_paused_at = case when not v_billing then coalesce(billing_paused_at, public.sp_today()) end,
      pause_reason = p_pause_reason,
      start_date = p_start_date, end_date = p_end_date, delivery_deadline = p_delivery_deadline,
      payment_method = p_payment_method, installments = p_installments,
      is_commissionable = p_is_commissionable, status = p_status, notes = p_notes,
      updated_at = now()
    where id = p_contract_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Contrato não encontrado.' using errcode = '23503';
    end if;

    if p_status in ('active', 'paused') then
      update public.contract_closings
         set revertido_em = now(), revertido_por = auth.uid()
       where contract_id = v_id and revertido_em is null;
      if found then
        update public.contracts set finished_at = null where id = v_id;
      end if;
    end if;
  end if;

  delete from public.contract_items where contract_id = v_id;

  insert into public.contract_items (contract_id, front, product_id, value)
  select
    v_id,
    (it->>'front')::service_front,
    nullif(it->>'product_id', '')::uuid,
    (it->>'value')::numeric
  from jsonb_array_elements(p_items) it;

  begin
    set constraints all immediate;
  exception
    when check_violation then
      set constraints all deferred;
      raise exception
        'A soma dos itens não fecha com o valor do contrato. Ajuste a decomposição por frente.'
        using errcode = '23514';
  end;

  set constraints all deferred;

  return v_id;
end $function$;

create or replace function private.fn_encerrar_tcv_vencido()
returns table(fechados integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_hoje date := public.sp_today();
  v_mes  date := private.fn_mes_corrente();
  v_ids  uuid[];
begin
  with alvo as (
    select c.id
    from public.contracts c
    where c.contract_type = 'tcv'
      and c.status = 'active'
      and c.billing_ends_at is not null
      and c.start_date <= (v_mes + interval '1 month - 1 day')::date
      and not private.fn_contrato_fatura_em(
            c.contract_type, c.start_date, c.end_date, c.billing_ends_at, v_mes)
      and c.finished_at is null
      and not exists (
        select 1
        from public.contract_closings cc
        where cc.contract_id = c.id
          and cc.revertido_em is not null
          and (cc.revertido_em at time zone 'America/Sao_Paulo')::date
              >= date_trunc('month', c.billing_ends_at)::date
      )
  ),
  fechado as (
    update public.contracts c
       set status = 'finished',
           billing_active = false,
           finished_at = v_hoje
      from alvo a
     where c.id = a.id
    returning c.id
  )
  select array_agg(id) into v_ids from fechado;

  if v_ids is null then
    return query select 0;
    return;
  end if;

  insert into public.contract_closings (contract_id)
  select unnest(v_ids);

  return query select array_length(v_ids, 1);
end $function$;

revoke all on function private.fn_encerrar_tcv_vencido() from public, anon;

create or replace view private.v_mrr_by_unit
with (security_invoker = true) as
select
  c.business_unit,
  sum(c.monthly_value) as mrr_total,
  sum(c.monthly_value) filter (where c.is_firm) as mrr_firme,
  count(*) as contratos
from public.contracts c
where c.contract_type = 'mrr'
  and c.status <> 'cancelled'
  and c.billing_active
  and private.fn_contrato_fatura_em(
        c.contract_type, c.start_date, c.end_date, c.billing_ends_at, private.fn_mes_corrente())
group by c.business_unit;

create or replace view private.v_tcv_by_unit
with (security_invoker = true) as
select
  c.business_unit,
  sum(c.total_value) as tcv_total,
  count(*) as projetos
from public.contracts c
where c.contract_type = 'tcv'
  and c.status <> 'cancelled'
  and c.billing_active
  and private.fn_contrato_fatura_em(
        c.contract_type, c.start_date, c.end_date, c.billing_ends_at, private.fn_mes_corrente())
group by c.business_unit;

revoke select on private.v_mrr_by_unit from anon;
revoke select on private.v_tcv_by_unit from anon;

