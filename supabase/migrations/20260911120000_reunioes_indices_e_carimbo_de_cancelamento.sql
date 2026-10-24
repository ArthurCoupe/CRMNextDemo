create index if not exists meetings_organizer_id_idx on public.meetings (organizer_id);
create index if not exists meetings_client_id_idx on public.meetings (client_id);
create index if not exists meetings_opportunity_id_idx on public.meetings (opportunity_id);
create index if not exists meetings_starts_at_idx on public.meetings (starts_at);

create or replace function private.meetings_carimba_organizador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.organizer_id := old.organizer_id;
    if old.cancelada_em is null and new.cancelada_em is not null then
      new.cancelada_por := coalesce(auth.uid(), new.cancelada_por);
    end if;
    return new;
  end if;

  new.organizer_id := coalesce(auth.uid(), new.organizer_id);
  return new;
end $$;
