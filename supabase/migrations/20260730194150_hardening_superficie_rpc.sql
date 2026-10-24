alter function public.handle_new_user()          set schema private;
alter function public.log_stage_change()         set schema private;
alter function public.sync_opportunity_value()   set schema private;
alter function public.validate_contract_shares() set schema private;
alter function public.apply_default_shares()     set schema private;

create or replace function public.opportunity_tier(p_opportunity_id uuid)
returns text
language sql stable security invoker
set search_path = public
as $$
  select case
           when count(*) = 0     then null
           when bool_or(is_ko)   then 'C'
           when sum(points) >= 6 then 'A'
           when sum(points) >= 4 then 'B'
           else 'C'
         end
  from public.qualification_answers
  where opportunity_id = p_opportunity_id
$$;

