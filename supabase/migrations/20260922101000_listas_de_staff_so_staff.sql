do $$
declare
  v_ofensoras integer;
begin
  select count(*) into v_ofensoras
    from public.role_assignments ra
    join public.profiles p on p.id = ra.profile_id
   where p.role = 'client' or not p.active;

  if v_ofensoras > 0 then
    raise exception
      'role_assignments tem % vinculo(s) com perfil client ou desativado. Troque a pessoa em Configuracoes > Papeis (ou limpe profile_id) antes de aplicar esta migration.',
      v_ofensoras using errcode = '23514';
  end if;
end $$;

create or replace function private.role_assignments_exige_staff_ativo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.profile_id
      and p.active
      and p.role in ('owner', 'manager', 'member')
  ) then
    raise exception 'Papel do onboarding só pode ir para gente do time, ativa.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.role_assignments_exige_staff_ativo() from public, anon;

drop trigger if exists trg_role_assignments_so_staff on public.role_assignments;
create trigger trg_role_assignments_so_staff
  before insert or update of profile_id on public.role_assignments
  for each row execute function private.role_assignments_exige_staff_ativo();

