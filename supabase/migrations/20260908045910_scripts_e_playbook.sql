create type public.script_kind    as enum ('sdr', 'closer');
create type public.script_channel as enum ('whatsapp', 'email', 'linkedin', 'cold_call', 'reuniao');
create type public.script_moment  as enum (
  'primeiro_contato', 'follow_up', 'quebra_objecao',
  'abertura', 'proposta', 'objecao', 'fechamento'
);
create type public.playbook_area  as enum ('comercial', 'marketing', 'gestao');

create table public.scripts (
  id             uuid primary key default gen_random_uuid(),
  tipo           public.script_kind not null,
  title          text not null,
  body           text not null,
  nicho          text not null default 'todos',
  canal          public.script_channel not null,
  momento        public.script_moment not null,
  pipeline_stage public.opportunity_stage,
  sort_order     int not null default 0,
  active         boolean not null default true,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint scripts_momento_por_tipo check (
    (tipo = 'sdr'    and momento in ('primeiro_contato','follow_up','quebra_objecao'))
    or
    (tipo = 'closer' and momento in ('abertura','proposta','objecao','fechamento'))
  ),
  constraint scripts_canal_por_tipo check (
    (tipo = 'sdr'    and canal in ('whatsapp','email','linkedin','cold_call'))
    or
    (tipo = 'closer' and canal in ('reuniao','whatsapp','email'))
  )
);

create index idx_scripts_filtros on public.scripts (tipo, active, momento, canal, sort_order);

create trigger trg_scripts_updated
  before update on public.scripts
  for each row execute function private.set_updated_at();

create table public.script_usage_log (
  id        uuid primary key default gen_random_uuid(),
  script_id uuid references public.scripts(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  used_by   uuid references public.profiles(id),
  used_at   timestamptz not null default now()
);

create index idx_script_usage_script on public.script_usage_log (script_id, used_at desc);

create table public.playbook_sections (
  id         uuid primary key default gen_random_uuid(),
  area       public.playbook_area not null,
  title      text not null,
  content    text not null,
  sort_order int not null default 0,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_playbook_area on public.playbook_sections (area, sort_order);

create trigger trg_playbook_updated
  before update on public.playbook_sections
  for each row execute function private.set_updated_at();

alter table public.scripts            enable row level security;
alter table public.script_usage_log   enable row level security;
alter table public.playbook_sections  enable row level security;

create policy "scripts: staff le"
  on public.scripts for select
  using (public.is_staff());

create policy "scripts: owner e manager escrevem"
  on public.scripts for all
  using (public.current_app_role() in ('owner','manager'))
  with check (public.current_app_role() in ('owner','manager'));

create policy "playbook: staff le"
  on public.playbook_sections for select
  using (public.is_staff());

create policy "playbook: owner e manager escrevem"
  on public.playbook_sections for all
  using (public.current_app_role() in ('owner','manager'))
  with check (public.current_app_role() in ('owner','manager'));

create policy "uso de script: staff le"
  on public.script_usage_log for select
  using (public.is_staff());

create policy "uso de script: staff registra"
  on public.script_usage_log for insert
  with check (public.is_staff());

revoke all on table public.scripts           from anon, authenticated;
revoke all on table public.script_usage_log  from anon, authenticated;
revoke all on table public.playbook_sections from anon, authenticated;

grant select                 on table public.scripts           to authenticated;
grant insert, update, delete on table public.scripts           to authenticated;
grant select, insert         on table public.script_usage_log  to authenticated;
grant select                 on table public.playbook_sections to authenticated;
grant insert, update, delete on table public.playbook_sections to authenticated;

