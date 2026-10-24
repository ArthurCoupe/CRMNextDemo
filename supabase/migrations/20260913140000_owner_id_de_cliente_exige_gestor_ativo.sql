create or replace function private.clients_owner_exige_gestor_ativo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.owner_id is not distinct from old.owner_id then
    return new;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.owner_id
      and p.active
      and p.role in ('owner', 'manager')
  ) then
    raise exception 'O responsável pelo cliente precisa ser owner ou manager ativo.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.clients_owner_exige_gestor_ativo() from public, anon;

drop trigger if exists trg_clients_owner_exige_gestor_ativo on public.clients;
create trigger trg_clients_owner_exige_gestor_ativo
  before insert or update of owner_id on public.clients
  for each row execute function private.clients_owner_exige_gestor_ativo();

