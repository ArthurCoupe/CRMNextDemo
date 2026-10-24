create or replace view private.v_team_cost with (security_invoker = true) as
with variavel as (
  select
    s.profile_id,
    s.beneficiario,
    s.business_unit     as bu,
    sum(s.custo_mes)    as custo_variavel,
    count(*)::bigint    as contratos
  from private.v_share_cost s
  group by s.profile_id, s.beneficiario, s.business_unit
),
atribuida as (
  select v.profile_id, v.beneficiario, v.bu, v.custo_variavel, v.contratos,
         alvo.id as payroll_id
  from variavel v
  join lateral (
    select p.id
    from public.payroll p
    where p.business_unit = v.bu
      and ((v.profile_id is not null and p.profile_id = v.profile_id)
        or (v.profile_id is null and p.profile_id is null and p.person_name = v.beneficiario))
    order by p.active desc, (p.monthly_cost + p.benefits) desc, p.id
    limit 1
  ) alvo on true
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
  coalesce(a.custo_variavel, 0)     as custo_variavel,
  coalesce(a.contratos, 0)          as contratos_com_participacao,
  p.start_date                      as inicio,
  p.end_date                        as fim,
  p.active                          as ativa,
  p.monthly_cost + p.benefits + coalesce(a.custo_variavel, 0) as custo_total,
  false                             as participacao_sem_linha,
  p.id::text                        as chave
from public.payroll p
left join atribuida a on a.payroll_id = p.id

union all

select
  null::uuid                        as payroll_id,
  v.profile_id,
  v.beneficiario                    as pessoa,
  null::text                        as cargo,
  null::work_kind                   as vinculo,
  v.bu,
  0::numeric(12,2)                  as custo_mensal,
  0::numeric(12,2)                  as beneficios,
  0::numeric                        as custo_fixo,
  v.custo_variavel,
  v.contratos                       as contratos_com_participacao,
  null::date                        as inicio,
  null::date                        as fim,
  true                              as ativa,
  v.custo_variavel                  as custo_total,
  true                              as participacao_sem_linha,
  'participacao:' || v.bu::text || ':' || coalesce(v.profile_id::text, v.beneficiario) as chave
from variavel v
where not exists (
  select 1 from atribuida a
  where a.bu = v.bu
    and a.beneficiario = v.beneficiario
    and a.profile_id is not distinct from v.profile_id
);

drop function if exists public.get_team_cost();

create function public.get_team_cost()
returns table (
  payroll_id uuid, profile_id uuid, pessoa text, cargo text,
  vinculo work_kind, bu business_unit, custo_mensal numeric, beneficios numeric,
  custo_fixo numeric, custo_variavel numeric, contratos_com_participacao bigint,
  inicio date, fim date, ativa boolean, custo_total numeric,
  participacao_sem_linha boolean, chave text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select t.payroll_id, t.profile_id, t.pessoa, t.cargo, t.vinculo, t.bu,
           t.custo_mensal::numeric, t.beneficios::numeric, t.custo_fixo, t.custo_variavel,
           t.contratos_com_participacao, t.inicio, t.fim, t.ativa, t.custo_total,
           t.participacao_sem_linha, t.chave
    from private.v_team_cost t
    order by t.participacao_sem_linha, t.ativa desc, t.custo_total desc, t.pessoa;
end $$;

revoke all on function public.get_team_cost() from public, anon;
grant execute on function public.get_team_cost() to authenticated;
revoke select on private.v_team_cost from anon;
