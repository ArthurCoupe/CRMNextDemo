create or replace function public.limite_anonimo_disponivel(
  p_bucket text, p_ip text, p_limite integer, p_janela_s integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_janela timestamptz;
  v_hits integer;
begin
  if p_bucket is null or p_bucket !~ '^[a-z0-9_:-]{1,64}$' or p_ip is null or length(p_ip) > 64
     or p_limite < 1 or p_limite > 1000 or p_janela_s < 1 or p_janela_s > 3600 then
    raise exception 'parametros invalidos' using errcode = '22023';
  end if;
  v_janela := to_timestamp(floor(extract(epoch from now()) / p_janela_s) * p_janela_s);
  select r.hits into v_hits
  from private.rate_limits r
  where r.key = left('anon:' || p_bucket || ':' || p_ip, 200) and r.window_start = v_janela;
  return coalesce(v_hits, 0) < p_limite;
end;
$$;

revoke all on function public.limite_anonimo_disponivel(text, text, integer, integer) from public, authenticated;
grant execute on function public.limite_anonimo_disponivel(text, text, integer, integer) to anon, service_role;
