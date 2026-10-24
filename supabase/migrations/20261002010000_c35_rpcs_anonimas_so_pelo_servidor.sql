revoke all on function public.limite_anonimo(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.limite_anonimo(text, text, integer, integer) to service_role;

revoke all on function public.registrar_toque(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_toque(jsonb) to service_role;

revoke all on function public.reservar_limite_recuperacao(text, integer, integer) from public, anon, authenticated;
grant execute on function public.reservar_limite_recuperacao(text, integer, integer) to service_role;

revoke all on function public.devolver_limite_recuperacao(text, timestamptz) from public, anon, authenticated;
grant execute on function public.devolver_limite_recuperacao(text, timestamptz) to service_role;

create index if not exists rate_limits_window_start_idx on private.rate_limits (window_start);

alter table private.rate_limits add column if not exists excedido_registrado boolean not null default false;

create or replace function private.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
  v_registrado boolean;
begin
  insert into private.rate_limits (key, window_start, hits)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits, excedido_registrado into v_hits, v_registrado;
  delete from private.rate_limits where window_start < now() - interval '1 day';
  if v_hits > p_limit then
    if not v_registrado then
      update private.rate_limits set excedido_registrado = true
      where key = left(p_key, 200) and window_start = v_window;
      perform private.registrar_evento('rate_limit_excedido', left(p_key, 256), jsonb_build_object('hits', v_hits, 'limite', p_limit));
    end if;
    return false;
  end if;
  return true;
end;
$$;
revoke all on function private.check_rate_limit(text, integer, integer) from public, anon, authenticated;
