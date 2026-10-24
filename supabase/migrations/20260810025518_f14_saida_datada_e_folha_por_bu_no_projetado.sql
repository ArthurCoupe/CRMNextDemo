alter table public.payroll
  add column deactivated_at timestamptz;

alter table public.payroll
  add constraint payroll_saida_tem_data
  check (active = (deactivated_at is null));

create function private.payroll_carimba_saida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.active and not new.active then
    new.deactivated_at := coalesce(new.deactivated_at, now());
  elsif not old.active and new.active then
    new.deactivated_at := null;
  end if;
  return new;
end $$;

create trigger trg_payroll_carimba_saida
  before update on public.payroll
  for each row execute function private.payroll_carimba_saida();

revoke all on function private.payroll_carimba_saida() from public, anon, authenticated;

create or replace function private.fn_payroll_cost(p_ref_month date)
returns table (bu business_unit, custo_fixo numeric, pessoas bigint)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(p.monthly_cost + p.benefits), 0) as custo_fixo,
    count(p.id)                                   as pessoas
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join public.payroll p
         on p.business_unit = u.bu
        and private.fn_pessoa_na_folha_em(p.start_date, p.end_date, p_ref_month)
        and (
          p.deactivated_at is null
          or p_ref_month < date_trunc('month', p.deactivated_at at time zone 'America/Sao_Paulo')::date
        )
  group by u.bu
$$;

create or replace view private.v_cost_projection with (security_invoker = true) as
with meses as (
  select (private.fn_mes_corrente() + make_interval(months => g))::date as mes
  from generate_series(0, 11) g
),
gastos as (
  select
    m.mes,
    coalesce(sum(e.amount), 0)                                                  as total,
    coalesce(sum(e.amount) filter (where e.business_unit = 'demanda'), 0)       as demanda,
    coalesce(sum(e.amount) filter (where e.business_unit = 'sistemas'), 0)      as sistemas,
    coalesce(sum(e.amount) filter (where e.business_unit = 'compartilhado'), 0) as compartilhado,
    count(e.id)                                                                 as linhas
  from meses m
  left join public.expenses e
         on e.active
        and not e.is_group
        and private.fn_despesa_corre_em(
              e.recurrence, e.start_date, e.end_date, e.installments_total, m.mes)
  group by m.mes
),
folha as (
  select
    m.mes,
    coalesce(sum(f.custo_fixo), 0)                                        as total,
    coalesce(sum(f.custo_fixo) filter (where f.bu = 'demanda'), 0)        as demanda,
    coalesce(sum(f.custo_fixo) filter (where f.bu = 'sistemas'), 0)       as sistemas,
    coalesce(sum(f.custo_fixo) filter (where f.bu = 'compartilhado'), 0)  as compartilhado,
    coalesce(sum(f.pessoas), 0)                                           as pessoas
  from meses m
  cross join lateral private.fn_payroll_cost(m.mes) f
  group by m.mes
)
select
  g.mes,
  g.total + f.total                          as custo_total,
  g.demanda + f.demanda                      as custo_demanda,
  g.sistemas + f.sistemas                    as custo_sistemas,
  g.compartilhado + f.compartilhado          as custo_compartilhado,
  g.linhas                                   as despesas,
  g.total                                    as custo_gastos,
  f.total                                    as custo_folha,
  f.pessoas                                  as pessoas_na_folha,
  f.demanda                                  as folha_demanda,
  f.sistemas                                 as folha_sistemas,
  f.compartilhado                            as folha_compartilhado
from gastos g
join folha f on f.mes = g.mes;

drop function if exists public.get_cost_projection();

create function public.get_cost_projection()
returns table (
  mes date, custo_total numeric, custo_demanda numeric,
  custo_sistemas numeric, custo_compartilhado numeric, despesas bigint,
  custo_gastos numeric, custo_folha numeric, pessoas_na_folha bigint,
  folha_demanda numeric, folha_sistemas numeric, folha_compartilhado numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.mes, p.custo_total, p.custo_demanda, p.custo_sistemas,
           p.custo_compartilhado, p.despesas, p.custo_gastos, p.custo_folha,
           p.pessoas_na_folha, p.folha_demanda, p.folha_sistemas, p.folha_compartilhado
    from private.v_cost_projection p order by p.mes;
end $$;

revoke all on function public.get_cost_projection() from public, anon;
grant execute on function public.get_cost_projection() to authenticated;
revoke select on private.v_cost_projection from anon;
