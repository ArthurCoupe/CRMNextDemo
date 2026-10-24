create function private.fn_pessoa_na_folha_em(
  p_start_date date,
  p_end_date   date,
  p_ref_month  date
) returns boolean language sql immutable set search_path = public as $$
  select private.fn_meses_desde(p_start_date, p_ref_month) >= 0
     and (p_end_date is null or private.fn_meses_desde(p_end_date, p_ref_month) <= 0)
$$;

create function private.fn_payroll_cost(p_ref_month date)
returns table (bu business_unit, custo_fixo numeric, pessoas bigint)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(p.monthly_cost + p.benefits), 0) as custo_fixo,
    count(p.id)                                   as pessoas
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join public.payroll p
         on p.business_unit = u.bu
        and p.active
        and private.fn_pessoa_na_folha_em(p.start_date, p.end_date, p_ref_month)
  group by u.bu
$$;

create view private.v_payroll_cost with (security_invoker = true) as
select f.bu, f.custo_fixo, f.pessoas, private.fn_mes_corrente() as mes_referencia
from private.fn_payroll_cost(private.fn_mes_corrente()) f;

create view private.v_team_cost with (security_invoker = true) as
with variavel as (
  select
    s.profile_id,
    s.beneficiario,
    sum(s.custo_mes) as custo_variavel,
    count(*)         as contratos
  from private.v_share_cost s
  group by s.profile_id, s.beneficiario
)
select
  p.id                              as payroll_id,
  p.profile_id,
  p.person_name                     as pessoa,
  p.job_title                       as cargo,
  p.work_kind                       as vinculo,
  p.business_unit                   as bu,
  p.monthly_cost                    as custo_mensal,
  p.benefits                        as beneficios,
  p.monthly_cost + p.benefits       as custo_fixo,
  coalesce(v.custo_variavel, 0)     as custo_variavel,
  coalesce(v.contratos, 0)          as contratos_com_participacao,
  p.start_date                      as inicio,
  p.end_date                        as fim,
  p.active                          as ativa
from public.payroll p
left join variavel v
       on (p.profile_id is not null and v.profile_id = p.profile_id)
       or (p.profile_id is null and v.profile_id is null and v.beneficiario = p.person_name);

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
  f.pessoas                                  as pessoas_na_folha
from gastos g
join folha f on f.mes = g.mes;

drop function if exists public.get_cost_projection();

create function public.get_cost_projection()
returns table (
  mes date, custo_total numeric, custo_demanda numeric,
  custo_sistemas numeric, custo_compartilhado numeric, despesas bigint,
  custo_gastos numeric, custo_folha numeric, pessoas_na_folha bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.mes, p.custo_total, p.custo_demanda, p.custo_sistemas,
           p.custo_compartilhado, p.despesas, p.custo_gastos, p.custo_folha,
           p.pessoas_na_folha
    from private.v_cost_projection p order by p.mes;
end $$;

create function public.get_payroll_cost()
returns table (bu business_unit, custo_fixo numeric, pessoas bigint, mes_referencia date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select c.bu, c.custo_fixo, c.pessoas, c.mes_referencia
               from private.v_payroll_cost c order by c.bu;
end $$;

create function public.get_team_cost()
returns table (
  payroll_id uuid, profile_id uuid, pessoa text, cargo text,
  vinculo work_kind, bu business_unit, custo_mensal numeric, beneficios numeric,
  custo_fixo numeric, custo_variavel numeric, contratos_com_participacao bigint,
  inicio date, fim date, ativa boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select t.payroll_id, t.profile_id, t.pessoa, t.cargo, t.vinculo, t.bu,
           t.custo_mensal, t.beneficios, t.custo_fixo, t.custo_variavel,
           t.contratos_com_participacao, t.inicio, t.fim, t.ativa
    from private.v_team_cost t
    order by t.ativa desc, t.custo_fixo desc, t.pessoa;
end $$;

revoke all on function public.get_cost_projection() from public, anon;
revoke all on function public.get_payroll_cost()    from public, anon;
revoke all on function public.get_team_cost()       from public, anon;
grant execute on function public.get_cost_projection() to authenticated;
grant execute on function public.get_payroll_cost()    to authenticated;
grant execute on function public.get_team_cost()       to authenticated;

revoke select on private.v_payroll_cost from anon;
revoke select on private.v_team_cost    from anon;
revoke select on private.v_cost_projection from anon;
