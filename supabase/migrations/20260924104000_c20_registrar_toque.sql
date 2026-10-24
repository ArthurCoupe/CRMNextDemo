create or replace function public.registrar_toque(p_toque jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_chave   text;
  v_segredo text;
  v_ip      text := coalesce(host(private.ip_da_requisicao()), 'desconhecido');
  v_ip_inet inet := private.ip_da_requisicao();
  v_id      text := gen_random_uuid()::text;
  v_campos  constant text[] := array['utm_source','utm_medium','utm_campaign','utm_content','utm_term','landing_url','user_agent'];
  v_limpo   jsonb := '{}'::jsonb;
  v_k       text;
  v_v       text;
begin
  if not private.check_rate_limit('anon:track:' || left(v_ip, 64), 20, 60) then
    return jsonb_build_object('ok', false, 'erro', 'rate');
  end if;

  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_chave := v_headers ->> 'x-track-key';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'TRACK_RPC_KEY' limit 1;
  if v_segredo is null or v_chave is null or v_chave = ''
     or extensions.digest(v_chave, 'sha256') <> extensions.digest(v_segredo, 'sha256') then
    perform private.registrar_evento(
      'toque_recusado', 'registrar_toque',
      jsonb_build_object('motivo', case when v_segredo is null then 'sem_segredo_no_vault' else 'chave_invalida' end),
      null, v_ip_inet
    );
    return jsonb_build_object('ok', false, 'erro', 'chave');
  end if;

  if p_toque is null or jsonb_typeof(p_toque) <> 'object' then
    return jsonb_build_object('ok', false, 'erro', 'corpo');
  end if;
  foreach v_k in array v_campos loop
    v_v := null;
    if p_toque ? v_k and jsonb_typeof(p_toque -> v_k) = 'string' then
      v_v := nullif(btrim(p_toque ->> v_k), '');
    end if;
    v_limpo := v_limpo || jsonb_build_object(v_k, left(v_v, 500));
  end loop;

  insert into public.lead_touches (attribution_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_url, user_agent)
  values (
    v_id,
    v_limpo ->> 'utm_source', v_limpo ->> 'utm_medium', v_limpo ->> 'utm_campaign',
    v_limpo ->> 'utm_content', v_limpo ->> 'utm_term', v_limpo ->> 'landing_url', v_limpo ->> 'user_agent'
  );
  return jsonb_build_object('ok', true, 'attribution_id', v_id);
end;
$$;

revoke all on function public.registrar_toque(jsonb) from public, authenticated;
grant execute on function public.registrar_toque(jsonb) to anon, service_role;
