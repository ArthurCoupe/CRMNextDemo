alter type public.opportunity_event_type add value if not exists 'whatsapp';

create or replace view private.v_weekly_activity with (security_invoker = true) as
select public.sp_week_start(e.created_at) as semana,
       e.actor_id,
       count(*) filter (
         where e.event_type <> 'stage_change'
       ) as toques,
       count(distinct e.opportunity_id) filter (
         where e.event_type = 'stage_change' and e.to_stage = 'r1' and e.from_stage is distinct from 'r1'
       ) as r1_marcadas
  from public.opportunity_events e
 where e.event_type <> 'stage_change'
    or (e.event_type = 'stage_change' and e.to_stage = 'r1' and e.from_stage is distinct from 'r1')
 group by 1, 2;

