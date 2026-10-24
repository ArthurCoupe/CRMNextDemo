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
  p_shares            jsonb          default '[]'::jsonb
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

  for v_share in select * from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb))
  loop
    insert into public.contract_shares (contract_id, profile_id, external_name, kind, share_pct)
    values (
      v_contract_id,
      nullif(v_share->>'profile_id', '')::uuid,
      nullif(v_share->>'external_name', ''),
      (v_share->>'kind')::share_kind,
      (v_share->>'share_pct')::numeric
    )
    on conflict (contract_id, profile_id, kind) do update
      set share_pct     = excluded.share_pct,
          external_name = excluded.external_name;
  end loop;

  update public.opportunities set stage = 'fechado' where id = p_opportunity_id;

  return jsonb_build_object('client_id', v_client_id, 'contract_id', v_contract_id);
end $function$;


revoke execute on function public.save_client_and_contract(
  uuid, text, uuid, text, contract_type, business_unit, jsonb, date, text, text,
  text, text, text, client_status, numeric, numeric, integer, integer, integer,
  boolean, date, date, payment_method, integer, boolean, text, jsonb
) from public, anon;

grant execute on function public.save_client_and_contract(
  uuid, text, uuid, text, contract_type, business_unit, jsonb, date, text, text,
  text, text, text, client_status, numeric, numeric, integer, integer, integer,
  boolean, date, date, payment_method, integer, boolean, text, jsonb
) to authenticated, service_role;
