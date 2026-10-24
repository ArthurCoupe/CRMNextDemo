create table if not exists private.rate_limits (
  key          text not null check (length(key) <= 200),
  window_start timestamptz not null,
  hits         integer not null default 1,
  primary key (key, window_start)
);
alter table private.rate_limits enable row level security;
revoke all on table private.rate_limits from public, anon, authenticated;

create or replace function private.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into private.rate_limits (key, window_start, hits)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into v_hits;
  delete from private.rate_limits where window_start < now() - interval '1 day';
  if v_hits > p_limit then
    perform private.registrar_evento('rate_limit_excedido', left(p_key, 256), jsonb_build_object('hits', v_hits, 'limite', p_limit));
    return false;
  end if;
  return true;
end;
$$;
revoke all on function private.check_rate_limit(text, integer, integer) from public, anon, authenticated;

create or replace function public.limite_do_usuario(p_bucket text, p_limite integer default 60, p_janela_s integer default 60)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if p_bucket is null or p_bucket !~ '^[a-z0-9_:-]{1,64}$' or p_limite < 1 or p_janela_s < 1 or p_janela_s > 86400 then
    raise exception 'parametros invalidos' using errcode = '22023';
  end if;
  return private.check_rate_limit('fn:' || p_bucket || ':' || auth.uid()::text, p_limite, p_janela_s);
end;
$$;
revoke all on function public.limite_do_usuario(text, integer, integer) from public, anon;
grant execute on function public.limite_do_usuario(text, integer, integer) to authenticated, service_role;

create or replace function public.limite_anonimo(p_bucket text, p_ip text, p_limite integer default 20, p_janela_s integer default 60)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_bucket is null or p_bucket !~ '^[a-z0-9_:-]{1,64}$' or p_ip is null or length(p_ip) > 64
     or p_limite < 1 or p_limite > 1000 or p_janela_s < 1 or p_janela_s > 3600 then
    raise exception 'parametros invalidos' using errcode = '22023';
  end if;
  return private.check_rate_limit('anon:' || p_bucket || ':' || p_ip, p_limite, p_janela_s);
end;
$$;
revoke all on function public.limite_anonimo(text, text, integer, integer) from public;
grant execute on function public.limite_anonimo(text, text, integer, integer) to anon, authenticated, service_role;

create or replace function public.registrar_evento_de_seguranca(p_evento text, p_alvo text default null, p_detalhes jsonb default '{}'::jsonb, p_ip text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := coalesce(p_ip, host(private.ip_da_requisicao()), 'desconhecido');
begin
  if p_evento not in ('sessao_recusada', 'csp_violacao', 'toque_recusado', 'origem_recusada') then
    raise exception 'evento nao permitido por este caminho' using errcode = '22023';
  end if;
  if not private.check_rate_limit('anon:eventos:' || left(v_ip, 64), 30, 60) then
    return false;
  end if;
  perform private.registrar_evento(p_evento, left(p_alvo, 256), coalesce(p_detalhes, '{}'::jsonb), null, nullif(v_ip, 'desconhecido')::inet);
  return true;
exception when invalid_text_representation then
  perform private.registrar_evento(p_evento, left(p_alvo, 256), coalesce(p_detalhes, '{}'::jsonb), null, null);
  return true;
end;
$$;
revoke all on function public.registrar_evento_de_seguranca(text, text, jsonb, text) from public;
grant execute on function public.registrar_evento_de_seguranca(text, text, jsonb, text) to anon, authenticated, service_role;
