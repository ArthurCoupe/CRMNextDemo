revoke select on table public.opportunities from authenticated;

grant select (
  attribution_id,
  business_unit,
  channel,
  contact_email,
  contact_name,
  contact_phone,
  created_at,
  estimated_value,
  expected_fronts,
  id,
  landing_url,
  lead_source,
  name,
  next_followup_at,
  nicho,
  notes,
  owner_id,
  referred_by,
  segment,
  stage,
  stage_changed_at,
  updated_at,
  utm_campaign,
  utm_content,
  utm_medium,
  utm_source,
  utm_term
) on public.opportunities to authenticated;

create or replace function public.get_closed_by_opportunity()
returns table (opportunity_id uuid, closed_mrr numeric, closed_tcv numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select cl.opportunity_id,
         coalesce(sum(c.monthly_value) filter (where c.contract_type = 'mrr'), 0),
         coalesce(sum(c.total_value)   filter (where c.contract_type = 'tcv'), 0)
    from public.contracts c
    join public.clients cl on cl.id = c.client_id
   where cl.opportunity_id is not null
     and c.status <> 'cancelled'
     and c.billing_active
   group by cl.opportunity_id;
$$;

revoke all on function public.get_closed_by_opportunity() from public;
revoke all on function public.get_closed_by_opportunity() from anon;
grant execute on function public.get_closed_by_opportunity() to authenticated;

