create or replace function private.fn_expenses_cost(p_ref_month date)
returns table (bu business_unit, custo numeric, linhas bigint)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(e.amount), 0) as custo,
    count(e.id)                as linhas
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join public.expenses e
         on e.business_unit = u.bu
        and not e.is_group
        and private.fn_despesa_corre_em(
              e.recurrence, e.start_date, e.end_date, e.installments_total, p_ref_month)
        and (
          e.deactivated_at is null
          or p_ref_month < date_trunc('month', e.deactivated_at at time zone 'America/Sao_Paulo')::date
        )
  group by u.bu
$$;

