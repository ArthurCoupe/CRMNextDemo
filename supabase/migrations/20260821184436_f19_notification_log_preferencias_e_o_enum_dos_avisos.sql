create type public.notification_kind as enum (
  'digest',
  'tarefa_d1',
  'tarefa_vencida',
  'onboarding_parado',
  'lead_frio',
  'contrato_vencendo',
  'tcv_encerrado'
);

create table public.notification_log (
  id                  uuid primary key default gen_random_uuid(),
  chave               text not null unique,
  tipo                public.notification_kind not null,
  destinatario_id     uuid not null references public.profiles(id) on delete cascade,
  destinatario_email  text not null,
  assunto             text not null,
  enviado_em          timestamptz,
  erro                text,
  criado_em           timestamptz not null default now()
);

alter table public.notification_log enable row level security;

create index idx_notification_log_destinatario
  on public.notification_log (destinatario_id, criado_em desc);

create index idx_notification_log_tipo
  on public.notification_log (tipo, criado_em desc);

create table public.notification_preferences (
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  tipo           public.notification_kind not null,
  ativo          boolean not null default true,
  atualizado_em  timestamptz not null default now(),
  primary key (profile_id, tipo)
);

alter table public.notification_preferences enable row level security;

create policy "notif log: cada um le o seu"
  on public.notification_log for select
  using (destinatario_id = auth.uid() or public.is_owner());

create policy "notif pref: cada um manda na sua"
  on public.notification_preferences for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "notif pref: owner le todas"
  on public.notification_preferences for select
  using (public.is_owner());

revoke all on table public.notification_log         from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;

grant select on table public.notification_log to authenticated;

grant select, delete on table public.notification_preferences to authenticated;
grant insert (profile_id, tipo, ativo) on table public.notification_preferences to authenticated;
grant update (ativo, atualizado_em)    on table public.notification_preferences to authenticated;

