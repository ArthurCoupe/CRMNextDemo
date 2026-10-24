create or replace function private.meetings_nao_recancela()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.cancelada_em is not null and (
    new.cancelada_em is distinct from old.cancelada_em
    or new.cancelada_por is distinct from old.cancelada_por
    or new.motivo_do_cancelamento is distinct from old.motivo_do_cancelamento
  ) then
    raise exception 'Esta reuniao ja estava cancelada.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function private.meetings_nao_recancela() from public, anon, authenticated;

create trigger trg_meetings_nao_recancela
  before update of cancelada_em, cancelada_por, motivo_do_cancelamento on public.meetings
  for each row execute function private.meetings_nao_recancela();
