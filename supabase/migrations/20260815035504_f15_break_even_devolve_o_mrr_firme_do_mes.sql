drop function if exists public.get_break_even(date);
drop function if exists private.fn_break_even(date);

create function private.fn_break_even(p_ref_month date)
returns table (
  custo_fixo_total    numeric,
  ticket_medio_mrr    numeric,
  clientes_para_pagar int,
  contratos_mrr       bigint,
  mrr_firme_total     numeric
)
language sql stable set search_path = public as $$
  with custo as (
    select coalesce(sum(c.custo_total), 0) as total
    from private.fn_cost_by_unit(p_ref_month) c
  ),
  mrr as (
    select
      coalesce(avg(ct.monthly_value), 0)                           as ticket,
      count(*)                                                     as contratos,
      coalesce(sum(ct.monthly_value) filter (where ct.is_firm), 0) as firme
    from public.contracts ct
    where ct.contract_type = 'mrr'
      and ct.status <> 'cancelled' and ct.billing_active
      and private.fn_contrato_fatura_em(
            ct.contract_type, ct.start_date, ct.end_date, ct.billing_ends_at, p_ref_month)
  )
  select
    custo.total,
    round(mrr.ticket, 2),
    case when mrr.ticket <= 0 then null else ceil(custo.total / mrr.ticket)::int end,
    mrr.contratos,
    mrr.firme
  from custo cross join mrr
$$;

create function public.get_break_even(p_ref_month date)
returns table (
  custo_fixo_total numeric, ticket_medio_mrr numeric,
  clientes_para_pagar int, contratos_mrr bigint, mrr_firme_total numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.fn_break_even(date_trunc('month', p_ref_month)::date);
end $$;

revoke all on function public.get_break_even(date) from public, anon;
grant execute on function public.get_break_even(date) to authenticated;
