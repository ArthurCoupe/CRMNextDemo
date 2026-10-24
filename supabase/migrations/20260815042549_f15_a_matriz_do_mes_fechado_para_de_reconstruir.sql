alter table public.monthly_snapshot_units
  add column imposto            numeric(12,2) not null default 0,
  add column taxas              numeric(12,2) not null default 0,
  add column custo_gastos       numeric(12,2) not null default 0,
  add column custo_folha        numeric(12,2) not null default 0,
  add column custo_participacao numeric(12,2) not null default 0,
  add column proporcao_pct      numeric(6,1);

update public.monthly_snapshot_units u
set imposto            = r.imposto,
    taxas              = r.taxas,
    custo_gastos       = r.custo_gastos,
    custo_folha        = r.custo_folha,
    custo_participacao = r.custo_participacao,
    proporcao_pct      = r.proporcao_pct
from public.monthly_snapshots s,
     lateral private.fn_result_by_unit(s.ref_month) r
where u.snapshot_id = s.id and r.bu = u.bu;

create or replace function private.fn_gravar_snapshot(p_ref_month date)
returns table (gravou boolean, mes_gravado date, resultado_do_mes numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_mes       date := date_trunc('month', p_ref_month)::date;
  v_id        uuid;
  v_resultado numeric;
begin
  insert into public.monthly_snapshots (
    ref_month, mrr_demanda, mrr_sistemas, mrr_firme_total,
    tcv_demanda, tcv_sistemas, receita_caixa, receita_liquida,
    custo_total, resultado, clientes_ativos
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
    (select coalesce(sum(k.custo_total), 0)     from private.fn_cost_by_unit(v_mes) k),
    (select coalesce(sum(r.resultado), 0)       from private.fn_result_by_unit(v_mes) r),
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

create function private.fn_result_by_unit_do_mes(p_ref_month date)
returns table (
  bu                  business_unit,
  receita_bruta       numeric,
  imposto             numeric,
  taxas               numeric,
  receita_liquida     numeric,
  custo_gastos        numeric,
  custo_folha         numeric,
  custo_participacao  numeric,
  custo_direto        numeric,
  custo_rateado       numeric,
  resultado           numeric,
  margem_pct          numeric,
  proporcao_pct       numeric,
  congelado           boolean
)
language sql stable set search_path = public as $$
  with snap as (
    select u.*
    from public.monthly_snapshots s
    join public.monthly_snapshot_units u on u.snapshot_id = s.id
    where s.ref_month = p_ref_month
  )
  select u.bu, u.receita_bruta, u.imposto, u.taxas, u.receita_liquida,
         u.custo_gastos, u.custo_folha, u.custo_participacao, u.custo_direto,
         u.custo_rateado, u.resultado, u.margem_pct, u.proporcao_pct,
         true
  from snap u
  union all
  select r.bu, r.receita_bruta, r.imposto, r.taxas, r.receita_liquida,
         r.custo_gastos, r.custo_folha, r.custo_participacao, r.custo_direto,
         r.custo_rateado, r.resultado, r.margem_pct, r.proporcao_pct,
         false
  from private.fn_result_by_unit(p_ref_month) r
  where not exists (select 1 from snap)
$$;

create function private.fn_result_total_do_mes(p_ref_month date)
returns table (
  receita_bruta   numeric,
  imposto         numeric,
  taxas           numeric,
  receita_liquida numeric,
  custo_direto    numeric,
  custo_rateado   numeric,
  custo_total     numeric,
  resultado       numeric,
  margem_pct      numeric,
  congelado       boolean
)
language sql stable set search_path = public as $$
  select
    coalesce(sum(r.receita_bruta), 0),
    coalesce(sum(r.imposto), 0),
    coalesce(sum(r.taxas), 0),
    coalesce(sum(r.receita_liquida), 0),
    coalesce(sum(r.custo_direto), 0),
    coalesce(sum(r.custo_rateado), 0),
    coalesce(sum(r.custo_direto), 0) + coalesce(sum(r.custo_rateado), 0),
    coalesce(sum(r.resultado), 0),
    case
      when coalesce(sum(r.receita_liquida), 0) = 0 then null
      else round(100 * sum(r.resultado) / sum(r.receita_liquida), 1)
    end,
    coalesce(bool_and(r.congelado), false)
  from private.fn_result_by_unit_do_mes(p_ref_month) r
$$;

drop function if exists public.get_result_by_unit(date);
drop function if exists public.get_result_total(date);

create function public.get_result_by_unit(p_ref_month date)
returns table (
  bu business_unit, receita_bruta numeric, imposto numeric, taxas numeric,
  receita_liquida numeric, custo_gastos numeric, custo_folha numeric,
  custo_participacao numeric, custo_direto numeric, custo_rateado numeric,
  resultado numeric, margem_pct numeric, proporcao_pct numeric, congelado boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.bu, r.receita_bruta, r.imposto, r.taxas, r.receita_liquida,
           r.custo_gastos, r.custo_folha, r.custo_participacao, r.custo_direto,
           r.custo_rateado, r.resultado, r.margem_pct, r.proporcao_pct, r.congelado
    from private.fn_result_by_unit_do_mes(date_trunc('month', p_ref_month)::date) r
    order by r.bu;
end $$;

create function public.get_result_total(p_ref_month date)
returns table (
  receita_bruta numeric, imposto numeric, taxas numeric, receita_liquida numeric,
  custo_direto numeric, custo_rateado numeric, custo_total numeric,
  resultado numeric, margem_pct numeric, congelado boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select * from private.fn_result_total_do_mes(date_trunc('month', p_ref_month)::date);
end $$;

revoke all on function public.get_result_by_unit(date) from public, anon;
revoke all on function public.get_result_total(date)   from public, anon;
grant execute on function public.get_result_by_unit(date) to authenticated;
grant execute on function public.get_result_total(date)   to authenticated;
