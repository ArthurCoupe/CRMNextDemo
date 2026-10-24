create or replace function public.import_opportunities(p_pipeline_id uuid, p_linhas jsonb, p_previa boolean default true)
returns table (linha integer, acao text, motivo text, opportunity_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_tel text; v_email text;
  v_por_tel uuid; v_por_email uuid; v_alvo uuid;
  v_resp text; v_owner uuid;
  v_estagio uuid;
  v_canal text; v_bu text; v_frente_invalida text;
  v_frentes public.service_front[];
  v_novas_tel text[] := '{}'; v_novas_email text[] := '{}';
begin
  if coalesce(public.current_app_role() in ('owner','manager'), false) is false then
    raise exception 'Importar oportunidades é de owner e manager.' using errcode = '42501';
  end if;
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'p_linhas precisa ser um array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) > 1000 then
    raise exception 'No máximo 1.000 linhas por importação.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pipelines p where p.id = p_pipeline_id and p.ativo) then
    raise exception 'Pipeline inexistente ou arquivado.' using errcode = '22023';
  end if;
  v_estagio := private.estagio_canonico(p_pipeline_id, 'prospeccao');

  for v_item in select * from jsonb_array_elements(p_linhas) loop
    if jsonb_typeof(v_item) <> 'object' or coalesce(v_item ->> 'numero', '') !~ '^[0-9]+$' then
      raise exception 'Cada linha precisa de numero inteiro.' using errcode = '22023';
    end if;
    linha := (v_item ->> 'numero')::integer;
    acao := null; motivo := null; opportunity_id := null;

    if coalesce(btrim(v_item ->> 'nome'), '') = '' then
      acao := 'erro'; motivo := 'nome é obrigatório'; return next; continue;
    end if;

    v_owner := null; v_resp := nullif(btrim(v_item ->> 'responsavel'), '');
    if v_resp is not null then
      select p.id into v_owner from public.profiles p
       where p.active and p.role <> 'client'
         and (lower(p.email) = lower(v_resp) or lower(p.full_name) = lower(v_resp))
       order by (lower(p.email) = lower(v_resp)) desc, p.email
       limit 1;
      if v_owner is null then
        acao := 'erro'; motivo := 'responsável "' || v_resp || '" não é uma pessoa ativa do time'; return next; continue;
      end if;
    end if;

    v_canal := nullif(v_item ->> 'canal', '');
    if v_canal is not null and v_canal <> all (enum_range(null::public.acquisition_channel)::text[]) then
      acao := 'erro'; motivo := 'canal inválido: ' || v_canal; return next; continue;
    end if;
    v_bu := nullif(v_item ->> 'bu', '');
    if v_bu is not null and v_bu <> all (array_remove(enum_range(null::public.business_unit)::text[], 'compartilhado')) then
      acao := 'erro'; motivo := 'bu inválida: ' || v_bu; return next; continue;
    end if;
    v_frentes := null;
    if jsonb_typeof(v_item -> 'frentes') = 'array' then
      select coalesce(x, 'null') into v_frente_invalida from jsonb_array_elements_text(v_item -> 'frentes') x
       where x is null or x <> all (enum_range(null::public.service_front)::text[]) limit 1;
      if v_frente_invalida is not null then
        acao := 'erro'; motivo := 'frente inválida: ' || v_frente_invalida; return next; continue;
      end if;
      select array_agg(x::public.service_front) into v_frentes from jsonb_array_elements_text(v_item -> 'frentes') x;
    end if;
    if jsonb_typeof(v_item -> 'valor_estimado') not in ('number', 'null') then
      acao := 'erro'; motivo := 'valor_estimado inválido: ' || (v_item ->> 'valor_estimado'); return next; continue;
    end if;
    if jsonb_typeof(v_item -> 'valor_estimado') = 'number' and (v_item ->> 'valor_estimado')::numeric >= 10000000000 then
      acao := 'erro'; motivo := 'valor_estimado acima do limite'; return next; continue;
    end if;

    v_tel := nullif(regexp_replace(coalesce(v_item ->> 'telefone', ''), '\D', '', 'g'), '');
    if length(v_tel) < 8 then v_tel := null; end if;
    v_email := nullif(lower(btrim(v_item ->> 'email')), '');
    if v_email is not null and (position('@' in v_email) <= 1 or position('@' in v_email) = length(v_email)) then
      acao := 'erro'; motivo := 'e-mail inválido: ' || v_email; return next; continue;
    end if;
    v_por_tel := null; v_por_email := null;
    if v_tel is not null then
      select o.id into v_por_tel from public.opportunities o
       where regexp_replace(o.contact_phone, '\D', '', 'g') = v_tel order by o.created_at limit 1;
    end if;
    if v_email is not null then
      select o.id into v_por_email from public.opportunities o
       where lower(o.contact_email) = v_email order by o.created_at limit 1;
    end if;
    if v_por_tel is not null and v_por_email is not null and v_por_tel <> v_por_email then
      acao := 'erro'; motivo := 'telefone e e-mail apontam para oportunidades diferentes'; return next; continue;
    end if;
    v_alvo := coalesce(v_por_tel, v_por_email);

    if v_alvo is null and p_previa and (v_tel = any (v_novas_tel) or v_email = any (v_novas_email)) then
      acao := 'atualiza'; motivo := 'mesmo telefone ou e-mail de uma linha anterior do arquivo'; return next; continue;
    end if;

    if v_alvo is not null then
      acao := 'atualiza'; opportunity_id := v_alvo;
      if not p_previa then
        update public.opportunities o set
          name            = btrim(v_item ->> 'nome'),
          contact_name    = coalesce(nullif(btrim(v_item ->> 'contato'), ''), o.contact_name),
          contact_phone   = coalesce(nullif(btrim(v_item ->> 'telefone'), ''), o.contact_phone),
          contact_email   = coalesce(v_email, o.contact_email),
          segment         = coalesce(nullif(btrim(v_item ->> 'segmento'), ''), o.segment),
          nicho           = coalesce(nullif(btrim(v_item ->> 'nicho'), ''), o.nicho),
          channel         = coalesce(v_canal::public.acquisition_channel, o.channel),
          business_unit   = coalesce(v_bu::public.business_unit, o.business_unit),
          estimated_value = coalesce((v_item ->> 'valor_estimado')::numeric, o.estimated_value),
          lead_source     = coalesce(nullif(btrim(v_item ->> 'origem'), ''), o.lead_source),
          referred_by     = coalesce(nullif(btrim(v_item ->> 'indicado_por'), ''), o.referred_by),
          notes           = coalesce(nullif(btrim(v_item ->> 'observacoes'), ''), o.notes),
          expected_fronts = coalesce(v_frentes, o.expected_fronts),
          owner_id        = coalesce(v_owner, o.owner_id)
        where o.id = v_alvo;
      end if;
    else
      acao := 'nova';
      if v_tel is not null then v_novas_tel := v_novas_tel || v_tel; end if;
      if v_email is not null then v_novas_email := v_novas_email || v_email; end if;
      if not p_previa then
        insert into public.opportunities
          (name, contact_name, contact_phone, contact_email, segment, nicho, channel, business_unit,
           estimated_value, lead_source, referred_by, notes, expected_fronts, owner_id, pipeline_id, stage_id)
        values
          (btrim(v_item ->> 'nome'), nullif(btrim(v_item ->> 'contato'), ''), nullif(btrim(v_item ->> 'telefone'), ''), v_email,
           nullif(btrim(v_item ->> 'segmento'), ''), nullif(btrim(v_item ->> 'nicho'), ''),
           v_canal::public.acquisition_channel, v_bu::public.business_unit,
           (v_item ->> 'valor_estimado')::numeric,
           coalesce(nullif(btrim(v_item ->> 'origem'), ''),
                    'csv:' || left(coalesce(nullif(btrim(v_item ->> 'arquivo'), ''), 'importacao'), 120)),
           nullif(btrim(v_item ->> 'indicado_por'), ''), nullif(btrim(v_item ->> 'observacoes'), ''), coalesce(v_frentes, '{}'),
           coalesce(v_owner, auth.uid()), p_pipeline_id, v_estagio)
        returning id into opportunity_id;
      end if;
    end if;
    return next;
  end loop;
end $$;

revoke all on function public.import_opportunities(uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_opportunities(uuid, jsonb, boolean) to authenticated, service_role;

