create table if not exists private.security_events (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,
  actor_ip     inet,
  event        text not null check (length(event) <= 64),
  target       text check (length(target) <= 256),
  details      jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 4096)
);

alter table private.security_events enable row level security;
revoke all on table private.security_events from public, anon, authenticated;

create index if not exists security_events_occurred_at_idx on private.security_events (occurred_at desc);
create index if not exists security_events_event_idx on private.security_events (event, occurred_at desc);

create or replace function private.ip_da_requisicao()
returns inet
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers text := current_setting('request.headers', true);
  v_xff text;
begin
  if v_headers is null or v_headers = '' then return null; end if;
  v_xff := btrim(split_part(coalesce((v_headers::jsonb ->> 'x-forwarded-for'), ''), ',', 1));
  if v_xff = '' then return null; end if;
  return v_xff::inet;
exception when others then
  return null;
end;
$$;
revoke all on function private.ip_da_requisicao() from public, anon, authenticated;

create or replace function private.registrar_evento(
  p_evento   text,
  p_alvo     text default null,
  p_detalhes jsonb default '{}'::jsonb,
  p_actor    uuid default null,
  p_ip       inet default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into private.security_events (actor_id, actor_ip, event, target, details)
  values (
    coalesce(p_actor, auth.uid()),
    coalesce(p_ip, private.ip_da_requisicao()),
    left(p_evento, 64),
    left(p_alvo, 256),
    coalesce(p_detalhes, '{}'::jsonb)
  );
end;
$$;
revoke all on function private.registrar_evento(text, text, jsonb, uuid, inet) from public, anon, authenticated;

create or replace function private.negar(p_rpc text, p_motivo text default 'forbidden')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise log 'SECURITY_EVENT rpc_negada rpc=% actor=% ip=% motivo=%',
    p_rpc, coalesce(auth.uid()::text, '-'), coalesce(host(private.ip_da_requisicao()), '-'), p_motivo;
  raise exception 'forbidden' using errcode = '42501';
end;
$$;
revoke all on function private.negar(text, text) from public, anon, authenticated;

create or replace function private.security_events_papel_mudou()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.active is distinct from old.active then
    perform private.registrar_evento(
      'papel_ou_situacao_alterado',
      new.id::text,
      jsonb_build_object(
        'role_de', old.role, 'role_para', new.role,
        'active_de', old.active, 'active_para', new.active
      )
    );
  end if;
  return new;
end;
$$;
revoke all on function private.security_events_papel_mudou() from public, anon, authenticated;

drop trigger if exists trg_security_events_papel_mudou on public.profiles;
create trigger trg_security_events_papel_mudou
  after update of role, active on public.profiles
  for each row execute function private.security_events_papel_mudou();

create or replace function public.ler_eventos_de_seguranca(p_limite integer default 200, p_antes_de timestamptz default null)
returns table (
  id bigint, occurred_at timestamptz, actor_id uuid, actor_ip inet, event text, target text, details jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    perform private.negar('ler_eventos_de_seguranca');
  end if;
  return query
    select e.id, e.occurred_at, e.actor_id, e.actor_ip, e.event, e.target, e.details
    from private.security_events e
    where p_antes_de is null or e.occurred_at < p_antes_de
    order by e.occurred_at desc
    limit least(greatest(coalesce(p_limite, 200), 1), 500);
end;
$$;
revoke all on function public.ler_eventos_de_seguranca(integer, timestamptz) from public, anon;
grant execute on function public.ler_eventos_de_seguranca(integer, timestamptz) to authenticated, service_role;

create or replace function public.resumo_de_seguranca(p_dias integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_por_evento jsonb;
begin
  if not (public.is_owner() or auth.role() = 'service_role') then
    perform private.negar('resumo_de_seguranca');
  end if;
  select count(*), coalesce(jsonb_object_agg(event, n), '{}'::jsonb)
    into v_total, v_por_evento
  from (
    select event, count(*) as n from private.security_events
    where occurred_at >= now() - make_interval(days => least(greatest(coalesce(p_dias, 7), 1), 90))
    group by event
  ) s;
  return jsonb_build_object('total', v_total, 'por_evento', v_por_evento, 'dias', least(greatest(coalesce(p_dias, 7), 1), 90));
end;
$$;
revoke all on function public.resumo_de_seguranca(integer) from public, anon;
grant execute on function public.resumo_de_seguranca(integer) to authenticated, service_role;
