create function private.fn_contrato_fatura_em(
  p_contract_type   contract_type,
  p_start_date      date,
  p_end_date        date,
  p_billing_ends_at date,
  p_ref_month       date
) returns boolean language sql immutable set search_path = public as $$
  select
    date_trunc('month', p_start_date)::date <= p_ref_month
    and case p_contract_type
      when 'mrr'::contract_type then
        p_end_date is null or p_ref_month <= date_trunc('month', p_end_date)::date
      when 'tcv'::contract_type then
        p_billing_ends_at is null or p_ref_month < date_trunc('month', p_billing_ends_at)::date
      else false
    end
$$;

create function private.fn_cash_revenue_by_unit(p_ref_month date)
returns table (
  bu        business_unit,
  bruto     numeric,
  imposto   numeric,
  taxas     numeric,
  liquido   numeric,
  contratos bigint
)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(n.bruto), 0)                              as bruto,
    coalesce(sum(n.imposto), 0)                            as imposto,
    coalesce(sum(n.taxa_variavel + n.taxa_fixa), 0)        as taxas,
    coalesce(sum(n.liquido), 0)                            as liquido,
    count(n.contract_id)                                   as contratos
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join (
    select n.contract_id, n.business_unit, n.bruto, n.imposto,
           n.taxa_variavel, n.taxa_fixa, n.liquido
    from private.v_net_revenue n
    join public.contracts c on c.id = n.contract_id
    where private.fn_contrato_fatura_em(
            c.contract_type, c.start_date, c.end_date, c.billing_ends_at, p_ref_month)
  ) n on n.business_unit = u.bu
  group by u.bu
$$;

create function public.get_cash_revenue_by_unit(p_ref_month date)
returns table (
  bu business_unit, bruto numeric, imposto numeric,
  taxas numeric, liquido numeric, contratos bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.bu, r.bruto, r.imposto, r.taxas, r.liquido, r.contratos
    from private.fn_cash_revenue_by_unit(date_trunc('month', p_ref_month)::date) r
    order by r.bu;
end $$;

revoke all on function public.get_cash_revenue_by_unit(date) from public, anon;
grant execute on function public.get_cash_revenue_by_unit(date) to authenticated;
