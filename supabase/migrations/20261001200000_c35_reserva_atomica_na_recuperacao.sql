create or replace function public.reservar_limite_recuperacao(
  p_chave text, p_limite integer, p_janela_s integer
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_janela timestamptz;
begin
  if p_chave is null or p_chave !~ '^[0-9a-f]{64}$'
     or p_limite is null or p_limite < 1 or p_limite > 1000
     or p_janela_s is null or p_janela_s < 1 or p_janela_s > 3600 then
    raise exception 'parametros invalidos' using errcode = '22023';
  end if;
  insert into private.rate_limits as r (key, window_start, hits)
  values (
    'anon:recuperar-email:' || p_chave,
    to_timestamp(floor(extract(epoch from now()) / p_janela_s) * p_janela_s),
    1
  )
  on conflict (key, window_start) do update set hits = r.hits + 1 where r.hits < p_limite
  returning r.window_start into v_janela;
  return v_janela;
end;
$$;

revoke all on function public.reservar_limite_recuperacao(text, integer, integer) from public, authenticated;
grant execute on function public.reservar_limite_recuperacao(text, integer, integer) to anon, service_role;

create or replace function public.devolver_limite_recuperacao(p_chave text, p_janela timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_chave is null or p_chave !~ '^[0-9a-f]{64}$' or p_janela is null then
    raise exception 'parametros invalidos' using errcode = '22023';
  end if;
  update private.rate_limits r
     set hits = r.hits - 1
   where r.key = 'anon:recuperar-email:' || p_chave
     and r.window_start = p_janela
     and r.hits > 0;
end;
$$;

revoke all on function public.devolver_limite_recuperacao(text, timestamptz) from public, authenticated;
grant execute on function public.devolver_limite_recuperacao(text, timestamptz) to anon, service_role;
