create or replace function private.scripts_carimba_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    return new;
  end if;

  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

drop trigger if exists trg_scripts_carimba_autor on public.scripts;
create trigger trg_scripts_carimba_autor
  before insert or update on public.scripts
  for each row execute function private.scripts_carimba_autor();

create or replace function private.playbook_sections_carimba_editor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end $$;

drop trigger if exists trg_playbook_carimba_editor on public.playbook_sections;
create trigger trg_playbook_carimba_editor
  before insert or update on public.playbook_sections
  for each row execute function private.playbook_sections_carimba_editor();

create or replace function private.script_usage_log_carimba_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.used_by := coalesce(auth.uid(), new.used_by);
  return new;
end $$;

drop trigger if exists trg_script_usage_log_carimba_autor on public.script_usage_log;
create trigger trg_script_usage_log_carimba_autor
  before insert on public.script_usage_log
  for each row execute function private.script_usage_log_carimba_autor();

