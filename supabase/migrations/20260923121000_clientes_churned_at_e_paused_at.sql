alter table public.clients add column paused_at date;

create or replace function private.clients_carimba_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'churned' then
    new.churned_at := coalesce(new.churned_at, public.sp_today());
  elsif old.status = 'churned' then
    new.churned_at := null;
  end if;

  if new.status = 'paused' then
    new.paused_at := public.sp_today();
  elsif old.status = 'paused' then
    new.paused_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.clients_carimba_status() from public, anon, authenticated;

drop trigger if exists trg_clients_carimba_status on public.clients;
create trigger trg_clients_carimba_status
  before update of status on public.clients
  for each row execute function private.clients_carimba_status();

