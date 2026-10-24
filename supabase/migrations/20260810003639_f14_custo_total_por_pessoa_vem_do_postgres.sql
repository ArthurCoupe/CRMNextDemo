create or replace view private.v_team_cost with (security_invoker = true) as
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
  p.active                          as ativa,
  p.monthly_cost + p.benefits + coalesce(v.custo_variavel, 0) as custo_total
from public.payroll p
left join variavel v
       on (p.profile_id is not null and v.profile_id = p.profile_id)
       or (p.profile_id is null and v.profile_id is null and v.beneficiario = p.person_name);

drop function if exists public.get_team_cost();

create function public.get_team_cost()
returns table (
  payroll_id uuid, profile_id uuid, pessoa text, cargo text,
  vinculo work_kind, bu business_unit, custo_mensal numeric, beneficios numeric,
  custo_fixo numeric, custo_variavel numeric, contratos_com_participacao bigint,
  inicio date, fim date, ativa boolean, custo_total numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select t.payroll_id, t.profile_id, t.pessoa, t.cargo, t.vinculo, t.bu,
           t.custo_mensal, t.beneficios, t.custo_fixo, t.custo_variavel,
           t.contratos_com_participacao, t.inicio, t.fim, t.ativa, t.custo_total
    from private.v_team_cost t
    order by t.ativa desc, t.custo_total desc, t.pessoa;
end $$;

revoke all on function public.get_team_cost() from public, anon;
grant execute on function public.get_team_cost() to authenticated;
revoke select on private.v_team_cost from anon;
