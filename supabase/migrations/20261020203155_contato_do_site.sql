create function private.telefone_nacional(p_telefone text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when d ~ '^55[0-9]{10,11}$' then substr(d, 3) else d end
    from (select ltrim(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), '0') as d) t
$$;

revoke all on function private.telefone_nacional(text) from public, anon, authenticated;

create function private.tem_caractere_invisivel(p_texto text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_texto, '') ~ U&'[[:cntrl:]\00AD\0600-\0605\061C\06DD\070F\180E\200B-\200F\2028-\202E\2060-\206F\FEFF\FFF9-\FFFB\+0E0000-\+0E007F]'
$$;

revoke all on function private.tem_caractere_invisivel(text) from public, anon, authenticated;

create function public.registrar_contato_da_landing(p_contato jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_pipeline    constant uuid := '10000000-0000-4000-8000-000000000001';
  c_responsavel constant uuid := 'd0000000-0000-4000-8000-000000000002';
  v_empresa      text;
  v_nome         text;
  v_telefone     text;
  v_nicho        text;
  v_utm          jsonb := '{}'::jsonb;
  v_campo        text;
  v_valor        text;
  v_etapa        uuid;
  v_responsavel  uuid;
  v_oportunidade uuid;
  v_agora       text := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
  v_linha        text;
begin
  if p_contato is null or jsonb_typeof(p_contato) <> 'object' then
    return jsonb_build_object('ok', false, 'erro', 'corpo');
  end if;

  v_empresa := btrim(p_contato ->> 'empresa');
  v_nome := btrim(p_contato ->> 'contato_nome');
  v_telefone := private.telefone_nacional(p_contato ->> 'telefone');
  v_nicho := left(nullif(btrim(p_contato ->> 'nicho'), ''), 80);
  if private.tem_caractere_invisivel(v_nicho) then
    v_nicho := null;
  end if;

  if coalesce(char_length(v_empresa), 0) not between 2 and 120
     or coalesce(char_length(v_nome), 0) not between 2 and 120
     or private.tem_caractere_invisivel(v_empresa)
     or private.tem_caractere_invisivel(v_nome)
     or v_empresa ~* '(://|www\.|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+)'
     or v_nome ~* '(://|www\.|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+)'
     or coalesce(v_telefone, '') !~ '^[1-9][0-9]{9,10}$' then
    return jsonb_build_object('ok', false, 'erro', 'corpo');
  end if;

  foreach v_campo in array array['utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
                                 'utm_term', 'landing_url'] loop
    v_valor := null;
    if jsonb_typeof(p_contato -> v_campo) = 'string'
       and not private.tem_caractere_invisivel(p_contato ->> v_campo) then
      v_valor := left(nullif(btrim(p_contato ->> v_campo), ''), 500);
    end if;
    v_utm := v_utm || jsonb_build_object(v_campo, v_valor);
  end loop;
  if (v_utm ->> 'landing_url') !~ '^https://(www\.)?exemplo\.com\.br([/?#]|$)' then
    v_utm := v_utm || jsonb_build_object('landing_url', null);
  end if;

  select s.id into v_etapa
    from public.pipeline_stages s
    join public.pipelines p on p.id = s.pipeline_id
   where p.id = c_pipeline and p.ativo
     and s.tipo not in ('fechado', 'perdido', 'descartado')
   order by s.ordem
   limit 1;
  if v_etapa is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_funil');
  end if;

  select p.id into v_responsavel
    from public.profiles p
   where p.id = c_responsavel and p.active and p.role in ('owner', 'manager', 'member');

  perform pg_advisory_xact_lock(hashtext('landing:registrar_contato'));

  select o.id into v_oportunidade
    from public.opportunities o
   where o.contact_phone is not null
     and private.telefone_nacional(o.contact_phone) = v_telefone
     and o.stage not in ('fechado', 'perdido', 'descartado')
   order by o.created_at
   limit 1;

  if v_oportunidade is not null then
    v_linha := 'Novo envio pelo site (não conferido): ' || left(v_nome, 40) || ', '
      || left(v_empresa, 40) || coalesce(', nicho ' || left(v_nicho, 40), '') || '.';
    update public.opportunities o
       set notes = concat_ws(E'\n', nullif(o.notes, ''), v_agora || ': ' || v_linha)
     where o.id = v_oportunidade
       and position(v_linha in coalesce(o.notes, '')) = 0
       and char_length(coalesce(o.notes, '')) < 4000
       and (char_length(coalesce(o.notes, ''))
            - char_length(replace(coalesce(o.notes, ''), 'Novo envio pelo site', '')))
           / char_length('Novo envio pelo site') < 3;
    return jsonb_build_object('ok', true);
  end if;

  if (select count(*) from public.opportunities o
       where o.lead_source = 'site' and o.channel = 'inbound'
         and o.notes like 'Contato pelo formulário do site em %'
         and o.created_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', true, 'teto', true);
  end if;

  begin
  insert into public.opportunities (
    name, contact_name, contact_phone, pipeline_id, stage_id, owner_id, channel,
    lead_source, business_unit, expected_fronts, nicho, notes,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_url)
  values (
    v_empresa, v_nome, v_telefone, c_pipeline, v_etapa, v_responsavel, 'inbound',
    'site', 'sistemas', array['sistemas']::public.service_front[], v_nicho,
    'Contato pelo formulário do site em ' || v_agora
      || '. Dados informados pelo visitante, não conferidos.',
    v_utm ->> 'utm_source', v_utm ->> 'utm_medium', v_utm ->> 'utm_campaign',
    v_utm ->> 'utm_content', v_utm ->> 'utm_term', v_utm ->> 'landing_url');
  exception when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'campos');
  end;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.registrar_contato_da_landing(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_contato_da_landing(jsonb) to service_role;
