create view private.v_funnel_reach with (security_invoker = true) as
with entrada as (
  select o.id as opportunity_id,
         coalesce(
           (select e.from_stage
              from public.opportunity_events e
             where e.opportunity_id = o.id
               and e.event_type = 'stage_change'
               and e.from_stage is not null
             order by e.created_at, e.id
             limit 1),
           o.stage) as estagio,
         o.created_at as alcancado_em
    from public.opportunities o
),
movimentos as (
  select e.opportunity_id, e.to_stage as estagio, e.created_at as alcancado_em
    from public.opportunity_events e
   where e.event_type = 'stage_change' and e.to_stage is not null
),
tudo as (
  select * from entrada
  union all
  select * from movimentos
)
select t.opportunity_id,
       coalesce(o.channel::text, 'sem_atribuicao') as canal,
       t.estagio,
       min(t.alcancado_em) as alcancado_em
  from tudo t
  join public.opportunities o on o.id = t.opportunity_id
 where t.estagio is not null
   and o.stage <> 'descartado'
 group by t.opportunity_id, o.channel, t.estagio;

create view private.v_opportunity_mix with (security_invoker = true) as
select coalesce(nullif(btrim(o.nicho), ''), 'sem nicho') as nicho,
       coalesce(public.opportunity_tier(o.id), 'sem tier') as tier,
       coalesce(o.channel::text, 'sem_atribuicao') as canal,
       count(*) as oportunidades
  from public.opportunities o
 where o.stage <> 'descartado'
 group by 1, 2, 3;

create or replace function public.get_funnel_by_channel(p_desde date default null)
returns table (canal text, estagio public.opportunity_stage, oportunidades bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select r.canal, r.estagio, count(distinct r.opportunity_id) as oportunidades
      from private.v_funnel_reach r
     where p_desde is null
        or (r.alcancado_em at time zone 'America/Sao_Paulo')::date >= p_desde
     group by r.canal, r.estagio;
end $$;

create or replace function public.get_opportunity_mix()
returns table (nicho text, tier text, canal text, oportunidades bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select m.nicho, m.tier, m.canal, m.oportunidades from private.v_opportunity_mix m;
end $$;

revoke all on function public.get_funnel_by_channel(date) from public;
revoke all on function public.get_opportunity_mix() from public;
grant execute on function public.get_funnel_by_channel(date) to authenticated;
grant execute on function public.get_opportunity_mix() to authenticated;
