create or replace function public.link_attribution(
  p_opportunity_id uuid,
  p_attribution_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_toque record;
  v_linhas int;
begin
  if coalesce(public.current_app_role() in ('owner', 'manager'), false) is false then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id, opportunity_id, utm_source, utm_medium, utm_campaign,
         utm_content, utm_term, landing_url, created_at
    into v_toque
  from public.lead_touches
  where attribution_id = p_attribution_id
  for update;

  if not found then
    return jsonb_build_object('status', 'nao_encontrado');
  end if;

  if v_toque.opportunity_id is not null and v_toque.opportunity_id <> p_opportunity_id then
    return jsonb_build_object('status', 'ja_vinculado');
  end if;

  update public.lead_touches
     set opportunity_id = p_opportunity_id
   where id = v_toque.id;

  update public.opportunities
     set attribution_id = p_attribution_id,
         utm_source     = v_toque.utm_source,
         utm_medium     = v_toque.utm_medium,
         utm_campaign   = v_toque.utm_campaign,
         utm_content    = v_toque.utm_content,
         utm_term       = v_toque.utm_term,
         landing_url    = v_toque.landing_url
   where id = p_opportunity_id;

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Oportunidade % não encontrada.', p_opportunity_id using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'status', 'vinculado',
    'toque', jsonb_build_object(
      'attribution_id', p_attribution_id,
      'utm_source',   v_toque.utm_source,
      'utm_medium',   v_toque.utm_medium,
      'utm_campaign', v_toque.utm_campaign,
      'utm_content',  v_toque.utm_content,
      'utm_term',     v_toque.utm_term,
      'landing_url',  v_toque.landing_url,
      'created_at',   v_toque.created_at
    )
  );
end $$;

revoke all on function public.link_attribution from public, anon;
grant execute on function public.link_attribution to authenticated;

create or replace function private.opportunities_sincroniza_estagio()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tipo public.opportunity_stage;
  v_pipeline_do_estagio uuid;
begin
  if tg_op = 'UPDATE' and new.pipeline_id is distinct from old.pipeline_id then
    raise exception 'Mover oportunidade entre pipelines não é suportado.' using errcode = '0A000';
  end if;

  if tg_op = 'INSERT' then
    if new.stage_id is null then
      new.stage_id := private.estagio_canonico(new.pipeline_id, new.stage);
    end if;
  elsif new.stage_id is distinct from old.stage_id then
    null;
  elsif new.stage is distinct from old.stage then
    new.stage_id := private.estagio_canonico(new.pipeline_id, new.stage);
    if (select s.tipo from public.pipeline_stages s where s.id = new.stage_id) is distinct from new.stage then
      raise exception 'Este pipeline não tem estágio do tipo %.', new.stage using errcode = '23514';
    end if;
  end if;

  if new.stage_id is null then
    raise exception 'Oportunidade precisa de estágio.' using errcode = '23502';
  end if;

  select s.tipo, s.pipeline_id into v_tipo, v_pipeline_do_estagio
    from public.pipeline_stages s where s.id = new.stage_id for share;
  if v_tipo is null then
    raise exception 'Estágio inexistente.' using errcode = '23503';
  end if;
  if v_pipeline_do_estagio <> new.pipeline_id then
    raise exception 'O estágio não pertence ao pipeline desta oportunidade.' using errcode = '23514';
  end if;
  new.stage := v_tipo;
  return new;
end $$;
revoke all on function private.opportunities_sincroniza_estagio() from public, anon;

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
    if jsonb_typeof(v_item -> 'valor_estimado') = 'number' and abs((v_item ->> 'valor_estimado')::numeric) >= 10000000000 then
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

create or replace function private.opportunities_valida_motivo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_pipeline uuid; v_ativo boolean;
begin
  if new.motivo_id is null then return new; end if;
  select tipo, pipeline_id, ativo into v_tipo, v_pipeline, v_ativo from public.motivos_de_saida where id = new.motivo_id;
  if v_pipeline <> new.pipeline_id then
    raise exception 'O motivo não pertence ao pipeline desta oportunidade.' using errcode = '23514';
  end if;
  if (new.stage = 'perdido' and v_tipo <> 'perda') or (new.stage = 'descartado' and v_tipo <> 'descarte') then
    raise exception 'Oportunidade perdida recebe motivo de perda; descartada, motivo de descarte.' using errcode = '23514';
  end if;
  if not v_ativo and (tg_op = 'INSERT' or new.motivo_id is distinct from old.motivo_id) then
    raise exception 'Esse motivo está desativado. Escolha outro ou reative-o em Configurações.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.opportunities_valida_motivo() from public, anon;

create or replace view private.v_weekly_activity with (security_invoker = true) as
select public.sp_week_start(e.created_at) as semana,
       e.actor_id,
       count(*) filter (
         where e.event_type in ('call', 'meeting', 'proposal_sent', 'note')
       ) as toques,
       count(distinct e.opportunity_id) filter (
         where e.event_type = 'stage_change' and e.to_stage = 'r1' and e.from_stage is distinct from 'r1'
       ) as r1_marcadas
  from public.opportunity_events e
 where e.event_type in ('call', 'meeting', 'proposal_sent', 'note')
    or (e.event_type = 'stage_change' and e.to_stage = 'r1' and e.from_stage is distinct from 'r1')
 group by 1, 2;

