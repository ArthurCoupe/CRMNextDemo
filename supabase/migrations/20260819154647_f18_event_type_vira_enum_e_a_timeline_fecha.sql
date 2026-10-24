create type public.opportunity_event_type as enum (
  'stage_change',
  'note',
  'call',
  'meeting',
  'proposal_sent'
);

alter table public.opportunity_events
  alter column event_type type public.opportunity_event_type
  using event_type::public.opportunity_event_type;

revoke all on table public.opportunity_events from anon;

revoke insert, update, delete, truncate
  on table public.opportunity_events from authenticated;

grant insert (opportunity_id, event_type, content)
  on public.opportunity_events to authenticated;

