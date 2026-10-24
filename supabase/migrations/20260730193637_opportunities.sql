create table public.opportunities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  segment          text,
  nicho            text,
  stage            opportunity_stage not null default 'prospeccao',
  stage_changed_at timestamptz not null default now(),

  owner_id         uuid references public.profiles(id),
  contact_name     text,
  contact_email    text,
  contact_phone    text,

  lead_source      text,
  channel          acquisition_channel,
  referred_by      text,

  business_unit    business_unit check (business_unit is null or business_unit <> 'compartilhado'),
  expected_fronts  service_front[] not null default '{}',
  estimated_value  numeric(12,2),
  closed_value     numeric(12,2),

  next_followup_at date,
  notes            text,

  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  landing_url      text,
  attribution_id   text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.opportunities enable row level security;

create index on public.opportunities (stage);
create index on public.opportunities (owner_id, stage);
create index on public.opportunities (attribution_id) where attribution_id is not null;
create index on public.opportunities (next_followup_at) where next_followup_at is not null;

create trigger trg_opportunities_updated
  before update on public.opportunities
  for each row execute function public.set_updated_at();

create table public.opportunity_events (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  actor_id       uuid references public.profiles(id),
  event_type     text not null,
  from_stage     opportunity_stage,
  to_stage       opportunity_stage,
  content        text,
  created_at     timestamptz not null default now()
);

alter table public.opportunity_events enable row level security;
create index on public.opportunity_events (opportunity_id, created_at desc);

create or replace function public.log_stage_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    insert into public.opportunity_events
      (opportunity_id, actor_id, event_type, from_stage, to_stage)
    values (new.id, auth.uid(), 'stage_change', old.stage, new.stage);
  end if;
  return new;
end $$;

create trigger trg_opportunities_stage
  before update of stage on public.opportunities
  for each row execute function public.log_stage_change();

create table public.qualification_answers (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  question_key   text not null,
  option_index   int  not null check (option_index >= 0),
  points         int  not null check (points between 0 and 2),
  is_ko          boolean not null default false,
  catalog_version int  not null default 1,
  answered_by    uuid references public.profiles(id),
  answered_at    timestamptz not null default now(),
  unique (opportunity_id, question_key)
);

alter table public.qualification_answers enable row level security;
create index on public.qualification_answers (opportunity_id);

create or replace function public.opportunity_tier(p_opportunity_id uuid)
returns text
language sql stable security definer
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

create table public.lead_touches (
  id             uuid primary key default gen_random_uuid(),
  attribution_id text not null unique,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  landing_url    text,
  user_agent     text,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  created_at     timestamptz not null default now()
);

alter table public.lead_touches enable row level security;
create index on public.lead_touches (created_at desc);
create index on public.lead_touches (opportunity_id) where opportunity_id is not null;

create policy "opps: staff lê"
  on public.opportunities for select using (public.is_staff());
create policy "opps: owner e manager escrevem"
  on public.opportunities for all
  using (public.current_app_role() in ('owner','manager'))
  with check (public.current_app_role() in ('owner','manager'));

create policy "opp_events: staff lê"
  on public.opportunity_events for select using (public.is_staff());
create policy "opp_events: staff registra"
  on public.opportunity_events for insert with check (public.is_staff());

create policy "qualif: staff lê"
  on public.qualification_answers for select using (public.is_staff());
create policy "qualif: owner e manager respondem"
  on public.qualification_answers for all
  using (public.current_app_role() in ('owner','manager'))
  with check (public.current_app_role() in ('owner','manager'));

create policy "touches: staff lê"
  on public.lead_touches for select using (public.is_staff());
create policy "touches: owner e manager vinculam"
  on public.lead_touches for update
  using (public.current_app_role() in ('owner','manager'))
  with check (public.current_app_role() in ('owner','manager'));

