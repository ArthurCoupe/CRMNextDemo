create or replace function public.carimba_autor_do_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.actor_id := auth.uid();
  end if;
  return new;
end;
$$;


drop trigger if exists trg_opp_events_carimba_autor on public.opportunity_events;

create trigger trg_opp_events_carimba_autor
  before insert on public.opportunity_events
  for each row execute function public.carimba_autor_do_evento();

revoke execute on function public.carimba_autor_do_evento() from public, anon, authenticated;
