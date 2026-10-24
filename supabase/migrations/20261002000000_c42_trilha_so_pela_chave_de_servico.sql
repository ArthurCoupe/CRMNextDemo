create or replace function public.registrar_evento_de_seguranca(p_evento text, p_alvo text default null, p_detalhes jsonb default '{}'::jsonb, p_ip text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := coalesce(nullif(p_ip, ''), host(private.ip_da_requisicao()), 'desconhecido');
  v_inet inet;
begin
  if p_evento not in ('sessao_recusada', 'csp_violacao', 'toque_recusado', 'origem_recusada') then
    raise exception 'evento nao permitido por este caminho' using errcode = '22023';
  end if;
  if pg_column_size(p_detalhes) > 2048 then
    p_detalhes := jsonb_build_object('truncado', true);
  end if;
  begin
    v_inet := nullif(v_ip, 'desconhecido')::inet;
  exception when invalid_text_representation then
    v_inet := null;
  end;
  if not private.check_rate_limit('anon:eventos:' || left(v_ip, 64), 30, 60) then
    return false;
  end if;
  perform private.registrar_evento(p_evento, left(p_alvo, 256), coalesce(p_detalhes, '{}'::jsonb), null, v_inet);
  return true;
end;
$$;
revoke all on function public.registrar_evento_de_seguranca(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.registrar_evento_de_seguranca(text, text, jsonb, text) to service_role;
