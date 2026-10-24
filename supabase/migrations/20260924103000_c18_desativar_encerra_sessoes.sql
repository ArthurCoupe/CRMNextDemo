create or replace function private.encerrar_sessoes_ao_desativar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessoes integer;
begin
  if old.active and not new.active then
    delete from auth.refresh_tokens where user_id = new.id::text;
    delete from auth.sessions where user_id = new.id;
    get diagnostics v_sessoes = row_count;
    perform private.registrar_evento(
      'sessoes_encerradas',
      new.id::text,
      jsonb_build_object('sessoes', v_sessoes, 'motivo', 'profiles.active=false')
    );
  end if;
  return new;
end;
$$;
revoke all on function private.encerrar_sessoes_ao_desativar() from public, anon, authenticated;

drop trigger if exists trg_encerrar_sessoes_ao_desativar on public.profiles;
create trigger trg_encerrar_sessoes_ao_desativar
  after update of active on public.profiles
  for each row execute function private.encerrar_sessoes_ao_desativar();
