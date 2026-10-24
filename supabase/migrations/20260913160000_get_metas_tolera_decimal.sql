create or replace function public.get_metas()
returns table (
  toques_semana integer,
  r1_semana integer,
  confirmado boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select round((s.value ->> 'toques_semana')::numeric)::integer,
           round((s.value ->> 'r1_semana')::numeric)::integer,
           coalesce((s.value ->> '_confirmado')::boolean, false)
      from public.app_settings s
     where s.key = 'metas';
end $$;

revoke all on function public.get_metas() from public;
revoke all on function public.get_metas() from anon;
grant execute on function public.get_metas() to authenticated;
