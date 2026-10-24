create or replace function private.aplicar_retencao()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_toques integer;
  v_avisos integer;
  v_mensagens integer;
  v_conversas integer;
  v_eventos integer;
  v_resumo jsonb;
begin
  delete from public.lead_touches
   where created_at < now() - interval '180 days' and opportunity_id is null;
  get diagnostics v_toques = row_count;

  delete from public.notification_log where criado_em < now() - interval '365 days';
  get diagnostics v_avisos = row_count;

  delete from public.ai_messages where created_at < now() - interval '180 days';
  get diagnostics v_mensagens = row_count;
  delete from public.ai_conversations c
   where not exists (select 1 from public.ai_messages m where m.conversation_id = c.id)
     and c.updated_at < now() - interval '180 days';
  get diagnostics v_conversas = row_count;

  delete from private.security_events where occurred_at < now() - interval '365 days';
  get diagnostics v_eventos = row_count;

  v_resumo := jsonb_build_object(
    'lead_touches', v_toques, 'notification_log', v_avisos,
    'ai_messages', v_mensagens, 'ai_conversations', v_conversas, 'security_events', v_eventos
  );
  perform private.registrar_evento('retencao_aplicada', 'aplicar_retencao', v_resumo);
  return v_resumo;
end;
$$;
revoke all on function private.aplicar_retencao() from public, anon, authenticated;

select cron.schedule('c45-retencao-semanal', '30 3 * * 1', $$ select private.aplicar_retencao(); $$);

create or replace function public.anonimizar_cliente(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opps integer;
  v_toques integer;
begin
  if not public.is_owner() then
    perform private.negar('anonimizar_cliente');
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'cliente inexistente' using errcode = 'P0002';
  end if;

  update public.clients
     set contact_name = null, contact_email = null, contact_phone = null
   where id = p_client_id;

  update public.opportunities
     set contact_name = null, contact_email = null, contact_phone = null
   where id = (select opportunity_id from public.clients where id = p_client_id);
  get diagnostics v_opps = row_count;

  update public.lead_touches
     set user_agent = null, landing_url = null
   where opportunity_id = (select opportunity_id from public.clients where id = p_client_id);
  get diagnostics v_toques = row_count;

  perform private.registrar_evento(
    'cliente_anonimizado', p_client_id::text,
    jsonb_build_object('oportunidades', v_opps, 'toques', v_toques)
  );
  return jsonb_build_object('ok', true, 'oportunidades', v_opps, 'toques', v_toques);
end;
$$;
revoke all on function public.anonimizar_cliente(uuid) from public, anon;
grant execute on function public.anonimizar_cliente(uuid) to authenticated, service_role;
