create function private.fn_expenses_cost(p_ref_month date)
returns table (bu business_unit, custo numeric, linhas bigint)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(e.amount), 0) as custo,
    count(e.id)                as linhas
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join public.expenses e
         on e.business_unit = u.bu
        and e.active
        and not e.is_group
        and private.fn_despesa_corre_em(
              e.recurrence, e.start_date, e.end_date, e.installments_total, p_ref_month)
  group by u.bu
$$;

create function private.fn_cost_by_unit(p_ref_month date)
returns table (
  bu           business_unit,
  custo_gastos numeric,
  custo_folha  numeric,
  custo_total  numeric,
  despesas     bigint,
  pessoas      bigint
)
language sql stable set search_path = public as $$
  select
    g.bu,
    g.custo                    as custo_gastos,
    f.custo_fixo               as custo_folha,
    g.custo + f.custo_fixo     as custo_total,
    g.linhas                   as despesas,
    f.pessoas                  as pessoas
  from private.fn_expenses_cost(p_ref_month) g
  join private.fn_payroll_cost(p_ref_month) f on f.bu = g.bu
$$;

create or replace view private.v_cost_projection with (security_invoker = true) as
with meses as (
  select (private.fn_mes_corrente() + make_interval(months => g))::date as mes
  from generate_series(0, 11) g
),
custo as (
  select m.mes, c.bu, c.custo_gastos, c.custo_folha, c.custo_total, c.despesas
  from meses m
  cross join lateral private.fn_cost_by_unit(m.mes) c
),
pessoas as (
  select m.mes, count(distinct f.chave_da_pessoa)::numeric as pessoas
  from meses m
  left join lateral private.fn_folha_do_mes(m.mes) f on true
  group by m.mes
)
select
  c.mes,
  sum(c.custo_total)                                                   as custo_total,
  coalesce(sum(c.custo_total) filter (where c.bu = 'demanda'), 0)       as custo_demanda,
  coalesce(sum(c.custo_total) filter (where c.bu = 'sistemas'), 0)      as custo_sistemas,
  coalesce(sum(c.custo_total) filter (where c.bu = 'compartilhado'), 0) as custo_compartilhado,
  sum(c.despesas)::bigint                                              as despesas,
  sum(c.custo_gastos)                                                  as custo_gastos,
  sum(c.custo_folha)                                                   as custo_folha,
  p.pessoas                                                            as pessoas_na_folha,
  coalesce(sum(c.custo_folha) filter (where c.bu = 'demanda'), 0)       as folha_demanda,
  coalesce(sum(c.custo_folha) filter (where c.bu = 'sistemas'), 0)      as folha_sistemas,
  coalesce(sum(c.custo_folha) filter (where c.bu = 'compartilhado'), 0) as folha_compartilhado
from custo c
join pessoas p on p.mes = c.mes
group by c.mes, p.pessoas;

create function public.get_cost_by_unit(p_ref_month date)
returns table (
  bu business_unit, custo_gastos numeric, custo_folha numeric,
  custo_total numeric, despesas bigint, pessoas bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select c.bu, c.custo_gastos, c.custo_folha, c.custo_total, c.despesas, c.pessoas
    from private.fn_cost_by_unit(date_trunc('month', p_ref_month)::date) c
    order by c.bu;
end $$;

revoke all on function public.get_cost_by_unit(date) from public, anon;
grant execute on function public.get_cost_by_unit(date) to authenticated;
