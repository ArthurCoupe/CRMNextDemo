create or replace function private.recusa_participante_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
begin
  select role into v_role from public.profiles where id = new.profile_id;

  if v_role = 'client' then
    raise exception
      'Cliente nao pode ser participante de reuniao interna. Marque apenas pessoas do time (owner, manager ou member).'
      using errcode = '23514';
  end if;

  return new;
end $$;

create trigger trg_meeting_attendees_recusa_client
  before insert or update on public.meeting_attendees
  for each row execute function private.recusa_participante_client();
