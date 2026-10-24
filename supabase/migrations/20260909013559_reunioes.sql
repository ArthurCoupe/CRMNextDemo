create type public.meeting_type as enum (
  'kickoff_cliente',
  'semanal_cliente',
  'alinhamento_cliente',
  'apresentacao_de_resultados',
  'renovacao_ou_upsell',
  'interna_de_time',
  'semanal_de_time',
  'quinzenal_de_time',
  'planejamento',
  'retrospectiva',
  'um_a_um',
  'onboarding_de_colaborador',
  'entregas_do_cliente',
  'alinhamento_interno_sobre_cliente',
  'proposta_para_prospect'
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo public.meeting_type not null,
  starts_at timestamptz not null,
  duration_minutes int not null default 60,
  client_id uuid references public.clients(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  organizer_id uuid not null references public.profiles(id),
  local text,
  notas text,
  cancelada_em timestamptz,
  cancelada_por uuid references public.profiles(id),
  motivo_do_cancelamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meetings_duracao_valida
    check (duration_minutes > 0 and duration_minutes <= 1440),

  constraint meetings_cancelamento_coerente
    check (
      (cancelada_em is null and cancelada_por is null)
      or (cancelada_em is not null and cancelada_por is not null)
    ),

  constraint meetings_vinculo_por_tipo check (
    case
      when tipo in ('kickoff_cliente','semanal_cliente','alinhamento_cliente',
                    'apresentacao_de_resultados','renovacao_ou_upsell',
                    'entregas_do_cliente','alinhamento_interno_sobre_cliente')
        then client_id is not null
      when tipo = 'proposta_para_prospect'
        then opportunity_id is not null
      else true
    end
  )
);

create table public.meeting_attendees (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (meeting_id, profile_id)
);

create index idx_attendees_profile on public.meeting_attendees (profile_id, meeting_id);
create index idx_meetings_starts_at on public.meetings (starts_at desc);

create or replace function private.meetings_carimba_organizador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.organizer_id := old.organizer_id;
    return new;
  end if;

  new.organizer_id := coalesce(auth.uid(), new.organizer_id);
  return new;
end $$;

create trigger trg_meetings_carimba_organizador
  before insert or update on public.meetings
  for each row execute function private.meetings_carimba_organizador();

create trigger trg_meetings_updated
  before update on public.meetings
  for each row execute function private.set_updated_at();

create or replace function public.pode_ver_reuniao(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_app_role() in ('owner','manager')
    or exists (
      select 1 from public.meetings m
      where m.id = p_meeting_id and m.organizer_id = auth.uid()
    )
    or exists (
      select 1 from public.meeting_attendees a
      where a.meeting_id = p_meeting_id and a.profile_id = auth.uid()
    );
$$;

alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;

create policy "reunioes: ve quem participa, e a gestao ve tudo"
  on public.meetings for select
  using (
    organizer_id = auth.uid()
    or public.current_app_role() in ('owner','manager')
    or public.pode_ver_reuniao(id)
  );

create policy "reunioes: staff cria"
  on public.meetings for insert
  with check (public.is_staff());

create policy "reunioes: edita quem organizou, mais owner e manager"
  on public.meetings for update
  using (organizer_id = auth.uid() or public.current_app_role() in ('owner','manager'))
  with check (organizer_id = auth.uid() or public.current_app_role() in ('owner','manager'));

create policy "reunioes: apaga quem organizou, mais owner e manager"
  on public.meetings for delete
  using (organizer_id = auth.uid() or public.current_app_role() in ('owner','manager'));

create policy "participantes: ve quem ve a reuniao"
  on public.meeting_attendees for select
  using (public.pode_ver_reuniao(meeting_id));

create policy "participantes: escreve quem edita a reuniao"
  on public.meeting_attendees for all
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.organizer_id = auth.uid()
             or public.current_app_role() in ('owner','manager'))
    )
  )
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.organizer_id = auth.uid()
             or public.current_app_role() in ('owner','manager'))
    )
  );

revoke all on table public.meetings from anon, authenticated;
revoke all on table public.meeting_attendees from anon, authenticated;
grant select, insert, update, delete on table public.meetings to authenticated;
grant select, insert, update, delete on table public.meeting_attendees to authenticated;

revoke execute on function public.pode_ver_reuniao(uuid) from public, anon;
grant execute on function public.pode_ver_reuniao(uuid) to authenticated;
