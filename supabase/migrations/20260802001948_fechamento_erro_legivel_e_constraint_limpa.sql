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
language plpgsql security definer
set search_path = public
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
      billing_paused_at = case when not v_billing then public.sp_today() end,
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

create or replace function public.save_client_and_contract(
  p_opportunity_id    uuid,
  p_client_name       text,
  p_client_owner_id   uuid,
  p_contract_name     text,
  p_type              contract_type,
  p_bu                business_unit,
  p_items             jsonb,
  p_start_date        date,
  p_client_segment    text           default null,
  p_client_nicho      text           default null,
  p_contact_name      text           default null,
  p_contact_email     text           default null,
  p_contact_phone     text           default null,
  p_client_status     client_status  default 'onboarding',
  p_monthly           numeric        default null,
  p_total             numeric        default null,
  p_billing_months    integer        default null,
  p_duration_months   integer        default null,
  p_commitment_months integer        default null,
  p_is_firm           boolean        default true,
  p_end_date          date           default null,
  p_delivery_deadline date           default null,
  p_payment_method    payment_method default 'transferencia',
  p_installments      integer        default null,
  p_is_commissionable boolean        default true,
  p_notes             text           default null,
  p_shares            jsonb          default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_client_id   uuid;
  v_contract_id uuid;
  v_share       jsonb;
  v_pct         numeric;
  v_duplicadas  int;
begin
  if not public.is_owner() then
    raise exception
      'Somente owner fecha negocio: criar cliente e o ato que concede leitura de contrato ao gestor.'
      using errcode = '42501';
  end if;

  if p_client_owner_id is null then
    raise exception
      'O cliente precisa de um responsavel. E esse campo que faz o contrato aparecer para o gestor.'
      using errcode = '23502';
  end if;

  if p_shares is not null then
    for v_share in select * from jsonb_array_elements(p_shares) loop
      if nullif(v_share->>'profile_id', '') is null
         and nullif(v_share->>'external_name', '') is null then
        raise exception
          'Participacao sem beneficiario: escolha alguem do time ou informe o nome de quem indicou. Se a linha ficou em branco por engano, remova-a.'
          using errcode = '22023';
      end if;

      v_pct := nullif(v_share->>'share_pct', '')::numeric;

      if v_pct is null or v_pct <= 0 then
        raise exception
          'Participacao sem percentual: informe um valor maior que zero, ou remova a linha.'
          using errcode = '22023';
      end if;

      if v_pct > 100 then
        raise exception
          'Participacao de %%%: o percentual de uma linha nao pode passar de 100%%.', v_pct
          using errcode = '22023';
      end if;
    end loop;

    select count(*) into v_duplicadas from (
      select nullif(s->>'profile_id', '') as pid, s->>'kind' as k
      from jsonb_array_elements(p_shares) s
      where nullif(s->>'profile_id', '') is not null
      group by 1, 2
      having count(*) > 1
    ) x;

    if v_duplicadas > 0 then
      raise exception
        'Ha duas participacoes para a mesma pessoa no mesmo tipo. Some os percentuais numa linha so.'
        using errcode = '22023';
    end if;
  end if;

  perform 1 from public.opportunities where id = p_opportunity_id for update;
  if not found then
    raise exception 'Oportunidade nao encontrada.' using errcode = '23503';
  end if;

  if exists (select 1 from public.clients where opportunity_id = p_opportunity_id) then
    raise exception
      'Esta oportunidade ja gerou um cliente. Abra a ficha dele para adicionar outro contrato.'
      using errcode = '23505';
  end if;

  insert into public.clients (
    name, segment, nicho, status, contact_name, contact_email, contact_phone,
    owner_id, opportunity_id, signed_at
  ) values (
    p_client_name, p_client_segment, p_client_nicho, p_client_status,
    p_contact_name, p_contact_email, p_contact_phone,
    p_client_owner_id, p_opportunity_id, public.sp_today()
  )
  returning id into v_client_id;

  v_contract_id := public.save_contract(
    p_client_id         => v_client_id,
    p_name              => p_contract_name,
    p_type              => p_type,
    p_bu                => p_bu,
    p_items             => p_items,
    p_start_date        => p_start_date,
    p_monthly           => p_monthly,
    p_total             => p_total,
    p_billing_months    => p_billing_months,
    p_duration_months   => p_duration_months,
    p_commitment_months => p_commitment_months,
    p_is_firm           => p_is_firm,
    p_end_date          => p_end_date,
    p_delivery_deadline => p_delivery_deadline,
    p_payment_method    => p_payment_method,
    p_installments      => p_installments,
    p_is_commissionable => p_is_commissionable,
    p_status            => 'active',
    p_notes             => p_notes
  );

  if p_shares is not null then
    delete from public.contract_shares where contract_id = v_contract_id;

    insert into public.contract_shares (contract_id, profile_id, external_name, kind, share_pct)
    select
      v_contract_id,
      nullif(s->>'profile_id', '')::uuid,
      nullif(s->>'external_name', ''),
      (s->>'kind')::share_kind,
      (s->>'share_pct')::numeric
    from jsonb_array_elements(p_shares) s;
  end if;

  update public.opportunities set stage = 'fechado' where id = p_opportunity_id;

  return jsonb_build_object('client_id', v_client_id, 'contract_id', v_contract_id);
end $function$;
