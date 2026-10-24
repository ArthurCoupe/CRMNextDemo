create table public.monthly_snapshots (
  id               uuid primary key default gen_random_uuid(),
  ref_month        date not null unique,
  mrr_demanda      numeric(12,2),
  mrr_sistemas     numeric(12,2),
  mrr_firme_total  numeric(12,2),
  tcv_demanda      numeric(12,2),
  tcv_sistemas     numeric(12,2),
  receita_caixa    numeric(12,2),
  receita_liquida  numeric(12,2),
  custo_total      numeric(12,2),
  resultado        numeric(12,2),
  clientes_ativos  int,
  created_at       timestamptz not null default now(),
  constraint monthly_snapshots_mes_e_dia_primeiro
    check (ref_month = date_trunc('month', ref_month)::date)
);
alter table public.monthly_snapshots enable row level security;

create table public.monthly_snapshot_units (
  snapshot_id     uuid not null references public.monthly_snapshots(id) on delete cascade,
  bu              business_unit not null,
  receita_bruta   numeric(12,2) not null,
  receita_liquida numeric(12,2) not null,
  custo_direto    numeric(12,2) not null,
  custo_rateado   numeric(12,2) not null,
  resultado       numeric(12,2) not null,
  margem_pct      numeric(6,1),
  primary key (snapshot_id, bu)
);
alter table public.monthly_snapshot_units enable row level security;

create policy "monthly_snapshots: so owner"
  on public.monthly_snapshots for all
  using (public.is_owner()) with check (public.is_owner());

create policy "monthly_snapshot_units: so owner"
  on public.monthly_snapshot_units for all
  using (public.is_owner()) with check (public.is_owner());

revoke all on public.monthly_snapshots      from anon;
revoke all on public.monthly_snapshot_units from anon;

create function private.fn_gravar_snapshot(p_ref_month date)
returns table (gravou boolean, ref_month date, resultado numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_mes        date := date_trunc('month', p_ref_month)::date;
  v_id         uuid;
  v_resultado  numeric;
begin
  insert into public.monthly_snapshots (
    ref_month, mrr_demanda, mrr_sistemas, mrr_firme_total,
    tcv_demanda, tcv_sistemas, receita_caixa, receita_liquida,
    custo_total, resultado, clientes_ativos
  )
  select
    v_mes,
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.business_unit = 'demanda' and fatura), 0),
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.business_unit = 'sistemas' and fatura), 0),
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.is_firm and fatura), 0),
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
    count(distinct c.client_id) filter (where fatura)
  from public.contracts c
  cross join lateral (
    select private.fn_contrato_fatura_em(
      c.contract_type, c.start_date, c.end_date, c.billing_ends_at, v_mes) as fatura
  ) v
  where c.status <> 'cancelled' and c.billing_active
  on conflict (ref_month) do nothing
  returning id, monthly_snapshots.resultado into v_id, v_resultado;

  if v_id is null then
    return query select false, v_mes, (select s.resultado from public.monthly_snapshots s where s.ref_month = v_mes);
    return;
  end if;

  insert into public.monthly_snapshot_units (
    snapshot_id, bu, receita_bruta, receita_liquida, custo_direto, custo_rateado, resultado, margem_pct)
  select v_id, r.bu, r.receita_bruta, r.receita_liquida, r.custo_direto,
         r.custo_rateado, r.resultado, r.margem_pct
  from private.fn_result_by_unit(v_mes) r;

  return query select true, v_mes, v_resultado;
end $$;

create function public.gravar_snapshot(p_ref_month date)
returns table (gravou boolean, ref_month date, resultado numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.fn_gravar_snapshot(p_ref_month);
end $$;

revoke all on function public.gravar_snapshot(date) from public, anon;
grant execute on function public.gravar_snapshot(date) to authenticated;

select cron.schedule(
  'f15-snapshot-do-mes-anterior',
  '10 9 1 * *',
  $job$
    select private.fn_gravar_snapshot(
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month')::date
    );
  $job$
);
