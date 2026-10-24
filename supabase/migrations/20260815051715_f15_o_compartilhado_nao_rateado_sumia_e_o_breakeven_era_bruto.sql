alter table public.monthly_snapshots
  add column custo_compartilhado_nao_rateado numeric(12,2) not null default 0;

do $$
declare v_com numeric; v_rat numeric;
begin
  select coalesce(sum(u.custo_rateado), 0) into v_rat
  from public.monthly_snapshots s
  join public.monthly_snapshot_units u on u.snapshot_id = s.id
  where s.ref_month = '2026-07-01';

  select coalesce(sum(k.custo_total), 0) into v_com
  from private.fn_cost_by_unit('2026-07-01') k where k.bu = 'compartilhado';

  if v_com <> v_rat then
    raise exception
      'O default 0 silenciaria dinheiro em 07/2026: compartilhado % contra rateado %', v_com, v_rat;
  end if;
end $$;

create or replace function private.fn_gravar_snapshot(p_ref_month date)
returns table (gravou boolean, mes_gravado date, resultado_do_mes numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_mes       date := date_trunc('month', p_ref_month)::date;
  v_id        uuid;
  v_resultado numeric;
  v_resto     numeric;
begin
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
      where c.contract_type = 'mrr' and c.business_unit = 'demanda' and v.fatura), 0),
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.business_unit = 'sistemas' and v.fatura), 0),
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.is_firm and v.fatura), 0),
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
    count(distinct c.client_id) filter (where v.fatura)
  from public.contracts c
  cross join lateral (
    select private.fn_contrato_fatura_em(
      c.contract_type, c.start_date, c.end_date, c.billing_ends_at, v_mes) as fatura
  ) v
  where c.status <> 'cancelled' and c.billing_active
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

drop function if exists public.get_result_total(date);
drop function if exists private.fn_result_total_do_mes(date);

create function private.fn_result_total_do_mes(p_ref_month date)
returns table (
  receita_bruta                   numeric,
  imposto                         numeric,
  taxas                           numeric,
  receita_liquida                 numeric,
  custo_direto                    numeric,
  custo_rateado                   numeric,
  custo_compartilhado_nao_rateado numeric,
  custo_total                     numeric,
  resultado                       numeric,
  margem_pct                      numeric,
  congelado                       boolean
)
language sql stable set search_path = public as $$
  with m as (select * from private.fn_result_by_unit_do_mes(p_ref_month)),
       agg as (
         select
           coalesce(sum(x.receita_bruta), 0)   as bruta,
           coalesce(sum(x.imposto), 0)         as imposto,
           coalesce(sum(x.taxas), 0)           as taxas,
           coalesce(sum(x.receita_liquida), 0) as liquida,
           coalesce(sum(x.custo_direto), 0)    as direto,
           coalesce(sum(x.custo_rateado), 0)   as rateado,
           coalesce(sum(x.resultado), 0)       as resultado,
           coalesce(bool_and(x.congelado), false) as congelado
         from m x
       ),
       resto as (
         select case
           when (select a.congelado from agg a) then
             coalesce((select s.custo_compartilhado_nao_rateado
                         from public.monthly_snapshots s
                        where s.ref_month = p_ref_month), 0)
           else
             coalesce((select k.custo_total from private.fn_cost_by_unit(p_ref_month) k
                        where k.bu = 'compartilhado'), 0)
             - (select a.rateado from agg a)
         end as valor
       )
  select
    a.bruta, a.imposto, a.taxas, a.liquida,
    a.direto, a.rateado, r.valor,
    a.direto + a.rateado + r.valor            as custo_total,
    a.resultado - r.valor                     as resultado,
    case
      when a.liquida = 0 then null
      else round(100 * (a.resultado - r.valor) / a.liquida, 1)
    end                                       as margem_pct,
    a.congelado
  from agg a cross join resto r
$$;

create function public.get_result_total(p_ref_month date)
returns table (
  receita_bruta numeric, imposto numeric, taxas numeric, receita_liquida numeric,
  custo_direto numeric, custo_rateado numeric, custo_compartilhado_nao_rateado numeric,
  custo_total numeric, resultado numeric, margem_pct numeric, congelado boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select * from private.fn_result_total_do_mes(date_trunc('month', p_ref_month)::date);
end $$;

revoke all on function public.get_result_total(date) from public, anon;
grant execute on function public.get_result_total(date) to authenticated;

drop function if exists public.get_break_even(date);
drop function if exists private.fn_break_even(date);

create function private.fn_break_even(p_ref_month date)
returns table (
  custo_fixo_total     numeric,
  ticket_medio_mrr     numeric,
  ticket_medio_bruto   numeric,
  clientes_para_pagar  int,
  contratos_mrr        bigint,
  mrr_firme_total      numeric
)
language sql stable set search_path = public as $$
  with custo as (
    select coalesce(sum(c.custo_total), 0) as total
    from private.fn_cost_by_unit(p_ref_month) c
  ),
  mrr as (
    select
      coalesce(avg(n.liquido), 0)                                  as ticket_liquido,
      coalesce(avg(ct.monthly_value), 0)                           as ticket_bruto,
      count(*)                                                     as contratos,
      coalesce(sum(ct.monthly_value) filter (where ct.is_firm), 0) as firme
    from public.contracts ct
    join private.v_net_revenue n on n.contract_id = ct.id
    where ct.contract_type = 'mrr'
      and ct.status <> 'cancelled' and ct.billing_active
      and private.fn_contrato_fatura_em(
            ct.contract_type, ct.start_date, ct.end_date, ct.billing_ends_at, p_ref_month)
  )
  select
    custo.total,
    round(mrr.ticket_liquido, 2),
    round(mrr.ticket_bruto, 2),
    case when mrr.ticket_liquido <= 0 then null
         else ceil(custo.total / mrr.ticket_liquido)::int end,
    mrr.contratos,
    mrr.firme
  from custo cross join mrr
$$;

create function public.get_break_even(p_ref_month date)
returns table (
  custo_fixo_total numeric, ticket_medio_mrr numeric, ticket_medio_bruto numeric,
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
