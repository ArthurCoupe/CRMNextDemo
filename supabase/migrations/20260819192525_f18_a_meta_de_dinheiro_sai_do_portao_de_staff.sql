drop function if exists public.get_metas();

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
    select (s.value ->> 'toques_semana')::integer,
           (s.value ->> 'r1_semana')::integer,
           coalesce((s.value ->> '_confirmado')::boolean, false)
      from public.app_settings s
     where s.key = 'metas';
end $$;

revoke all on function public.get_metas() from public;
revoke all on function public.get_metas() from anon;
grant execute on function public.get_metas() to authenticated;

create or replace function public.get_metas_financeiras()
returns table (
  mrr_mensal numeric,
  tcv_alvo numeric,
  confirmado boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select (s.value ->> 'mrr_mensal')::numeric,
           (s.value ->> 'tcv_alvo')::numeric,
           coalesce((s.value ->> '_confirmado')::boolean, false)
      from public.app_settings s
     where s.key = 'metas';
end $$;

revoke all on function public.get_metas_financeiras() from public;
revoke all on function public.get_metas_financeiras() from anon;
grant execute on function public.get_metas_financeiras() to authenticated;
