drop function if exists public.limite_do_usuario(text, integer, integer);

create function public.limite_do_usuario(p_uid uuid, p_bucket text, p_limite integer, p_janela_s integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_uid is null or p_bucket is null or p_bucket !~ '^[a-z0-9_-]{1,64}$'
     or p_limite is null or p_limite < 1
     or p_janela_s is null or p_janela_s < 1 or p_janela_s > 86400 then
    raise exception 'parametros invalidos' using errcode = '22023';
  end if;
  return private.check_rate_limit('fn:' || p_bucket || ':' || p_uid::text, p_limite, p_janela_s);
end;
$$;
revoke all on function public.limite_do_usuario(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.limite_do_usuario(uuid, text, integer, integer) to service_role;
