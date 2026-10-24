create view private.v_weekly_activity with (security_invoker = true) as
select public.sp_week_start(e.created_at) as semana,
       e.actor_id,
       count(*) filter (
         where e.event_type in ('call', 'meeting', 'proposal_sent', 'note')
       ) as toques,
       count(distinct e.opportunity_id) filter (
         where e.event_type = 'stage_change' and e.to_stage = 'r1'
       ) as r1_marcadas
  from public.opportunity_events e
 where e.event_type in ('call', 'meeting', 'proposal_sent', 'note')
    or (e.event_type = 'stage_change' and e.to_stage = 'r1')
 group by 1, 2;

create or replace function public.get_weekly_activity(p_desde date default null)
returns table (
  semana date,
  responsavel_id uuid,
  responsavel text,
  toques bigint,
  r1_marcadas bigint
)
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
    select a.semana,
           a.actor_id,
           coalesce(p.full_name, 'sem responsavel'),
           a.toques,
           a.r1_marcadas
      from private.v_weekly_activity a
      left join public.profiles p on p.id = a.actor_id
     where p_desde is null or a.semana >= p_desde
     order by a.semana desc, coalesce(p.full_name, 'sem responsavel');
end $$;

revoke all on function public.get_weekly_activity(date) from public;
revoke all on function public.get_weekly_activity(date) from anon;
grant execute on function public.get_weekly_activity(date) to authenticated;
