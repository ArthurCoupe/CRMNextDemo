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
    (select coalesce(sum(r.custo_direto + r.custo_rateado), 0)
       from private.fn_result_by_unit(v_mes) r),
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

update public.monthly_snapshots s
set custo_total = d.pelo_detalhe
from (
  select u.snapshot_id, sum(u.custo_direto + u.custo_rateado) as pelo_detalhe
  from public.monthly_snapshot_units u
  group by u.snapshot_id
) d
where d.snapshot_id = s.id
  and s.custo_total is distinct from d.pelo_detalhe;

create or replace function private.fn_result_history(p_meses int default 12)
returns table (
  mes             date,
  receita_liquida numeric,
  custo_total     numeric,
  resultado       numeric,
  congelado       boolean,
  parcial         boolean
)
language sql stable set search_path = public as $$
  with meses as (
    select (private.fn_mes_corrente() - make_interval(months => g))::date as mes
    from generate_series(0, greatest(coalesce(p_meses, 12), 1) - 1) g
  )
  select
    m.mes,
    t.receita_liquida,
    t.custo_total,
    t.resultado,
    t.congelado,
    m.mes >= private.fn_mes_corrente() as parcial
  from meses m
  cross join lateral private.fn_result_total_do_mes(m.mes) t
  order by m.mes
$$;

