create or replace view private.v_revenue_by_front with (security_invoker = true) as
select ci.front,
       c.business_unit,
       coalesce(sum(ci.value) filter (where c.contract_type = 'mrr'), 0)  as mrr_mensal,
       coalesce(sum(ci.value) filter (where c.contract_type = 'tcv'), 0)  as tcv_total,
       coalesce(sum(
         case when c.contract_type = 'mrr' then ci.value
              else ci.value / nullif(c.billing_months, 0)::numeric end), 0) as caixa_mes
from public.contract_items ci
join public.contracts c on c.id = ci.contract_id
where c.status <> 'cancelled'
  and c.billing_active
  and private.fn_contrato_fatura_em(
        c.contract_type, c.start_date, c.end_date, c.billing_ends_at,
        private.fn_mes_corrente())
group by ci.front, c.business_unit;

create or replace view private.v_net_revenue with (security_invoker = true) as
select
  c.id            as contract_id,
  c.client_id,
  cl.name         as cliente,
  c.name          as contrato,
  c.contract_type,
  c.business_unit,
  c.payment_method,
  coalesce(c.installments, 1)                                    as parcelas,
  bruto.valor                                                    as bruto,
  round(bruto.valor * fs.tax_pct / 100::numeric, 2)              as imposto,
  round(bruto.valor * taxa.pct / 100::numeric, 2)                as taxa_variavel,
  pmf.fixed_fee                                                  as taxa_fixa,
  bruto.valor
    - round(bruto.valor * fs.tax_pct / 100::numeric, 2)
    - round(bruto.valor * taxa.pct / 100::numeric, 2)
    - pmf.fixed_fee                                              as liquido,
  taxa.pct                                                       as taxa_variavel_pct,
  fs.tax_pct                                                     as imposto_pct,
  fs.is_provisional,
  private.fn_contrato_fatura_em(
    c.contract_type, c.start_date, c.end_date, c.billing_ends_at,
    private.fn_mes_corrente())                                   as fatura_no_mes
from public.contracts c
join public.clients cl on cl.id = c.client_id
cross join lateral (
  select round(case when c.contract_type = 'mrr' then c.monthly_value
                    else c.total_value / nullif(c.billing_months, 0)::numeric
               end, 2) as valor
) bruto
join public.payment_method_fees pmf on pmf.method = c.payment_method
left join public.gateway_fees gf on gf.installments = coalesce(c.installments, 1)
cross join lateral (
  select case when c.payment_method = 'credito' then coalesce(gf.fee_pct, 0::numeric)
              else pmf.variable_pct end as pct
) taxa
cross join public.fiscal_settings fs
where c.status <> 'cancelled' and c.billing_active;

create function private.fn_net_revenue_total()
returns table (bruto numeric, deducoes numeric, liquido numeric, contratos bigint)
language sql stable set search_path = public as $$
  select
    coalesce(sum(n.bruto), 0),
    coalesce(sum(n.imposto + n.taxa_variavel + n.taxa_fixa), 0),
    coalesce(sum(n.liquido), 0),
    count(*)
  from private.v_net_revenue n
  where n.fatura_no_mes
$$;

drop function if exists public.get_net_revenue();

create function public.get_net_revenue()
returns table (
  contract_id uuid, client_id uuid, cliente text, contrato text,
  contract_type contract_type, business_unit business_unit,
  payment_method payment_method, parcelas int,
  bruto numeric, imposto numeric, taxa_variavel numeric, taxa_fixa numeric,
  liquido numeric, taxa_variavel_pct numeric, imposto_pct numeric,
  is_provisional boolean, fatura_no_mes boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select n.contract_id, n.client_id, n.cliente, n.contrato, n.contract_type,
           n.business_unit, n.payment_method, n.parcelas, n.bruto, n.imposto,
           n.taxa_variavel, n.taxa_fixa, n.liquido, n.taxa_variavel_pct,
           n.imposto_pct, n.is_provisional, n.fatura_no_mes
    from private.v_net_revenue n
    order by n.fatura_no_mes desc, n.liquido desc;
end $$;

create function public.get_net_revenue_total()
returns table (bruto numeric, deducoes numeric, liquido numeric, contratos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.fn_net_revenue_total();
end $$;

revoke all on function public.get_net_revenue()       from public, anon;
revoke all on function public.get_net_revenue_total() from public, anon;
grant execute on function public.get_net_revenue()       to authenticated;
grant execute on function public.get_net_revenue_total() to authenticated;

create or replace function private.fn_encerrar_tcv_vencido()
returns table (fechados integer)
language plpgsql security definer set search_path = public as $$
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
      and not private.fn_contrato_fatura_em(
            c.contract_type, c.start_date, c.end_date, c.billing_ends_at, v_mes)
      and c.finished_at is null
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
end $$;

