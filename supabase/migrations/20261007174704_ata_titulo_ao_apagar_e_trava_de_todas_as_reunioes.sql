alter table public.cancelamentos_desfeitos alter column titulo_da_reuniao drop not null;

update public.cancelamentos_desfeitos
   set titulo_da_reuniao = null
 where meeting_id is not null;

create or replace function private.meetings_rastro_do_desfazer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.cancelada_em is not null and new.cancelada_em is null then
    insert into public.cancelamentos_desfeitos
      (meeting_id, cancelada_em, cancelada_por, motivo, desfeito_por)
    values
      (new.id, old.cancelada_em, old.cancelada_por, old.motivo_do_cancelamento, auth.uid());
  end if;
  return null;
end;
$$;
revoke all on function private.meetings_rastro_do_desfazer() from public, anon, authenticated;

create function private.meetings_titulo_na_ata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cancelamentos_desfeitos
     set titulo_da_reuniao = old.titulo
   where meeting_id = old.id;
  return old;
end;
$$;
revoke all on function private.meetings_titulo_na_ata() from public, anon, authenticated;

create trigger trg_meetings_titulo_na_ata
  before delete on public.meetings
  for each row execute function private.meetings_titulo_na_ata();

create or replace function public.apagar_cliente(p_client_id uuid)
returns table(contratos_apagados integer, jornadas_apagadas integer, posts_apagados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contratos int;
  v_jornadas  int := 0;
  v_posts     int;
  r           record;
  v_tipos_do_cliente public.meeting_type[] := array[
    'kickoff_cliente', 'semanal_cliente', 'alinhamento_cliente',
    'apresentacao_de_resultados', 'renovacao_ou_upsell',
    'entregas_do_cliente', 'alinhamento_interno_sobre_cliente'
  ]::public.meeting_type[];
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('apagar_cliente');
  end if;

  perform 1 from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente não encontrado. Ele pode já ter sido apagado em outra tela.'
      using errcode = 'P0002';
  end if;

  select count(*) into v_posts from public.content_posts where client_id = p_client_id;

  for r in select id from public.onboarding_journeys where client_id = p_client_id loop
    perform private.fn_apagar_jornada(r.id);
    v_jornadas := v_jornadas + 1;
  end loop;

  delete from public.contracts where client_id = p_client_id;
  get diagnostics v_contratos = row_count;

  perform 1 from public.meetings
   where client_id = p_client_id
     for update;

  delete from public.cancelamentos_desfeitos a
   using public.meetings m
   where a.meeting_id = m.id
     and m.client_id = p_client_id
     and m.tipo = any(v_tipos_do_cliente);

  delete from public.meetings
   where client_id = p_client_id
     and tipo = any(v_tipos_do_cliente);

  delete from public.clients where id = p_client_id;

  return query select v_contratos, v_jornadas, v_posts;
end;
$$;

revoke all on function public.apagar_cliente(uuid) from public, anon;
grant execute on function public.apagar_cliente(uuid) to authenticated;
