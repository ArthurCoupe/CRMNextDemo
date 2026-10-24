drop function public.get_weekly_activity(date);

create function public.get_weekly_activity(p_desde date default null)
returns table (
  semana date,
  responsavel_id uuid,
  responsavel text,
  toques bigint,
  r1_marcadas bigint,
  r1_distintas_na_semana bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with r1_da_semana as (
      select public.sp_week_start(e.created_at) as semana,
             count(distinct e.opportunity_id) as distintas
        from public.opportunity_events e
       where e.event_type = 'stage_change'
         and e.to_stage = 'r1'
         and e.from_stage is distinct from 'r1'
       group by 1
    )
    select a.semana,
           a.actor_id,
           coalesce(p.full_name, 'sem responsavel'),
           a.toques,
           a.r1_marcadas,
           coalesce(r.distintas, 0)
      from private.v_weekly_activity a
      left join public.profiles p on p.id = a.actor_id
      left join r1_da_semana r on r.semana = a.semana
     where p_desde is null or a.semana >= p_desde
     order by a.semana desc, coalesce(p.full_name, 'sem responsavel');
end $$;

revoke all on function public.get_weekly_activity(date) from public;
revoke all on function public.get_weekly_activity(date) from anon;
grant execute on function public.get_weekly_activity(date) to authenticated;

create or replace view private.v_share_cost with (security_invoker = true) as
select
  c.id           as contract_id,
  c.client_id,
  c.business_unit,
  cs.kind,
  coalesce(p.full_name, cs.external_name) as beneficiario,
  cs.share_pct,
  round(
    case c.contract_type
      when 'mrr'::contract_type then c.monthly_value
      when 'tcv'::contract_type then c.total_value / nullif(c.billing_months, 0)::numeric
      else null::numeric
    end * cs.share_pct / 100::numeric,
    2
  )                                        as custo_mes,
  cs.profile_id,
  cs.id          as share_id,
  private.fn_contrato_vigente_em(c, private.fn_mes_corrente()) as fatura_no_mes
from public.contract_shares cs
join public.contracts c on c.id = cs.contract_id
left join public.profiles p on p.id = cs.profile_id
where c.status <> 'cancelled'::contract_status
  and c.is_commissionable;

