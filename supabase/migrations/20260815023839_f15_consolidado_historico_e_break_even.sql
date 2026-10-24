create function private.fn_result_total(p_ref_month date)
returns table (
  receita_bruta   numeric,
  imposto         numeric,
  taxas           numeric,
  receita_liquida numeric,
  custo_direto    numeric,
  custo_rateado   numeric,
  custo_total     numeric,
  resultado       numeric,
  margem_pct      numeric
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
    end
  from private.fn_result_by_unit(p_ref_month) r
$$;

create function private.fn_result_history(p_meses int default 12)
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
    coalesce(s.receita_liquida, t.receita_liquida),
    coalesce(s.custo_total,     t.custo_total),
    coalesce(s.resultado,       t.resultado),
    s.id is not null                       as congelado,
    m.mes >= private.fn_mes_corrente()     as parcial
  from meses m
  left join public.monthly_snapshots s on s.ref_month = m.mes
  cross join lateral private.fn_result_total(m.mes) t
  order by m.mes
$$;

create function private.fn_break_even(p_ref_month date)
returns table (
  custo_fixo_total   numeric,
  ticket_medio_mrr   numeric,
  clientes_para_pagar int,
  contratos_mrr      bigint
)
language sql stable set search_path = public as $$
  with custo as (
    select coalesce(sum(c.custo_total), 0) as total
    from private.fn_cost_by_unit(p_ref_month) c
  ),
  mrr as (
    select
      coalesce(avg(ct.monthly_value), 0) as ticket,
      count(*)                           as contratos
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
    mrr.contratos
  from custo cross join mrr
$$;

create function public.get_result_total(p_ref_month date)
returns table (
  receita_bruta numeric, imposto numeric, taxas numeric, receita_liquida numeric,
  custo_direto numeric, custo_rateado numeric, custo_total numeric,
  resultado numeric, margem_pct numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.fn_result_total(date_trunc('month', p_ref_month)::date);
end $$;

create function public.get_result_history(p_meses int default 12)
returns table (
  mes date, receita_liquida numeric, custo_total numeric,
  resultado numeric, congelado boolean, parcial boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.fn_result_history(p_meses);
end $$;

create function public.get_break_even(p_ref_month date)
returns table (
  custo_fixo_total numeric, ticket_medio_mrr numeric,
  clientes_para_pagar int, contratos_mrr bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.fn_break_even(date_trunc('month', p_ref_month)::date);
end $$;

revoke all on function public.get_result_total(date)  from public, anon;
revoke all on function public.get_result_history(int) from public, anon;
revoke all on function public.get_break_even(date)    from public, anon;
grant execute on function public.get_result_total(date)  to authenticated;
grant execute on function public.get_result_history(int) to authenticated;
grant execute on function public.get_break_even(date)    to authenticated;
