create or replace function public.protege_papel_e_situacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and not public.is_owner() then
    raise exception
      'Somente owner altera papel ou situacao de um perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


drop trigger if exists trg_profiles_protege_papel on public.profiles;

create trigger trg_profiles_protege_papel
  before update on public.profiles
  for each row execute function public.protege_papel_e_situacao();

