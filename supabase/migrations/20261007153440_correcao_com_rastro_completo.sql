create table public.correcoes_de_nota (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.opportunity_events(id) on delete cascade,
  antes         text not null,
  depois        text not null,
  corrigido_por uuid references public.profiles(id) on delete set null,
  corrigido_em  timestamptz not null default now()
);

create index correcoes_de_nota_event_idx
  on public.correcoes_de_nota (event_id, corrigido_em);
create index correcoes_de_nota_corrigido_por_fk_idx
  on public.correcoes_de_nota (corrigido_por);

alter table public.correcoes_de_nota enable row level security;
alter table public.correcoes_de_nota force row level security;

create policy "correcoes_de_nota: staff lê" on public.correcoes_de_nota
  for select to authenticated using (public.is_staff());

revoke all on table public.correcoes_de_nota from anon, authenticated;
grant select on table public.correcoes_de_nota to authenticated;

create function private.opportunity_events_rastro_da_nota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.content is distinct from old.content then
    insert into public.correcoes_de_nota (event_id, antes, depois, corrigido_por)
    values (new.id, old.content, new.content, auth.uid());
  end if;
  return null;
end;
$$;
revoke all on function private.opportunity_events_rastro_da_nota() from public, anon, authenticated;

create trigger trg_opp_events_rastro_da_nota
  after update of content on public.opportunity_events
  for each row execute function private.opportunity_events_rastro_da_nota();

create table public.cancelamentos_desfeitos (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  cancelada_em  timestamptz not null,
  cancelada_por uuid references public.profiles(id) on delete set null,
  motivo        text,
  desfeito_por  uuid references public.profiles(id) on delete set null,
  desfeito_em   timestamptz not null default now()
);

create index cancelamentos_desfeitos_meeting_idx
  on public.cancelamentos_desfeitos (meeting_id, desfeito_em);
create index cancelamentos_desfeitos_cancelada_por_fk_idx
  on public.cancelamentos_desfeitos (cancelada_por);
create index cancelamentos_desfeitos_desfeito_por_fk_idx
  on public.cancelamentos_desfeitos (desfeito_por);

alter table public.cancelamentos_desfeitos enable row level security;
alter table public.cancelamentos_desfeitos force row level security;

create policy "cancelamentos_desfeitos: quem vê a reunião lê" on public.cancelamentos_desfeitos
  for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = cancelamentos_desfeitos.meeting_id));

revoke all on table public.cancelamentos_desfeitos from anon, authenticated;
grant select on table public.cancelamentos_desfeitos to authenticated;

create function private.meetings_rastro_do_desfazer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.cancelada_em is not null and new.cancelada_em is null then
    insert into public.cancelamentos_desfeitos
      (meeting_id, cancelada_em, cancelada_por, motivo, desfeito_por)
    values
      (new.id, old.cancelada_em, old.cancelada_por, old.motivo_do_cancelamento, auth.uid());
  end if;
  return null;
end;
$$;
revoke all on function private.meetings_rastro_do_desfazer() from public, anon, authenticated;

create trigger trg_meetings_rastro_do_desfazer
  after update of cancelada_em on public.meetings
  for each row execute function private.meetings_rastro_do_desfazer();
