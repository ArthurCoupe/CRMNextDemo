alter table public.correcoes_de_nota alter column antes drop not null;

create or replace function private.meetings_carimba_organizador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organizer_id is distinct from old.organizer_id then
      if auth.uid() is not null
         and not coalesce(public.current_app_role() in ('owner', 'manager'), false) then
        raise exception 'Trocar o organizador é do owner ou do manager.' using errcode = '42501';
      end if;
      if not exists (
        select 1 from public.profiles
         where id = new.organizer_id and active and role in ('owner', 'manager', 'member')
      ) then
        raise exception 'O organizador precisa ser uma pessoa ativa da equipe.' using errcode = '22023';
      end if;
    end if;
    if old.cancelada_em is null and new.cancelada_em is not null then
      new.cancelada_por := coalesce(auth.uid(), new.cancelada_por);
      if auth.uid() is not null then
        new.cancelada_em := now();
      end if;
    end if;
    return new;
  end if;

  if auth.uid() is not null and (
    new.cancelada_em is not null
    or new.cancelada_por is not null
    or new.motivo_do_cancelamento is not null
  ) then
    raise exception 'Uma reunião nova não pode nascer cancelada.' using errcode = '42501';
  end if;
  new.organizer_id := coalesce(auth.uid(), new.organizer_id);
  return new;
end $$;
revoke all on function private.meetings_carimba_organizador() from public, anon, authenticated;
