create or replace function public.save_contract(
  p_client_id         uuid,
  p_name              text,
  p_type              contract_type,
  p_bu                business_unit,
  p_items             jsonb,
  p_start_date        date,
  p_contract_id       uuid           default null,
  p_monthly           numeric        default null,
  p_total             numeric        default null,
  p_billing_months    int            default null,
  p_duration_months   int            default null,
  p_commitment_months int            default null,
  p_is_firm           boolean        default true,
  p_billing_active    boolean        default null,
  p_pause_reason      text           default null,
  p_end_date          date           default null,
  p_delivery_deadline date           default null,
  p_payment_method    payment_method default 'transferencia',
  p_installments      int            default null,
  p_is_commissionable boolean        default true,
  p_status            contract_status default 'active',
  p_notes             text           default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id            uuid;
  v_incoerentes   int;
  v_soma_itens    numeric;
  v_esperado      numeric;
  v_billing       boolean;
  v_qtd_itens     int;
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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
      using errcode = '23514';
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

  if round(v_soma_itens, 2) <> round(v_esperado, 2) then
    raise exception
      'Os itens somam R$ % e o contrato vale R$ %. Falta alocar R$ %.',
      to_char(v_soma_itens, 'FM999999990.00'),
      to_char(v_esperado,   'FM999999990.00'),
      to_char(v_esperado - v_soma_itens, 'FM999999990.00')
      using errcode = '23514';
  end if;

  if p_status = 'paused' and p_billing_active is null then
    raise exception
      'Contrato pausado exige decisão explícita: suspender a cobrança também? Envie billing_active como true ou false.'
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
      client_id         = p_client_id,
      name              = p_name,
      contract_type     = p_type,
      business_unit     = p_bu,
      monthly_value     = p_monthly,
      total_value       = p_total,
      billing_months    = p_billing_months,
      duration_months   = p_duration_months,
      commitment_months = p_commitment_months,
      is_firm           = p_is_firm,
      billing_active    = v_billing,
      billing_paused_at = case
                            when not v_billing then coalesce(billing_paused_at, public.sp_today())
                            else null
                          end,
      pause_reason      = p_pause_reason,
      start_date        = p_start_date,
      end_date          = p_end_date,
      delivery_deadline = p_delivery_deadline,
      payment_method    = p_payment_method,
      installments      = p_installments,
      is_commissionable = p_is_commissionable,
      status            = p_status,
      notes             = p_notes
    where id = p_contract_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Contrato % não encontrado.', p_contract_id using errcode = 'P0002';
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
      raise exception
        'A soma dos itens não fecha com o valor do contrato. Ajuste a decomposição por frente.'
        using errcode = '23514';
  end;

  set constraints all deferred;

  return v_id;
end $$;

revoke all on function public.save_contract from public, anon;
grant execute on function public.save_contract to authenticated;
