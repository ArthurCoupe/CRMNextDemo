alter table public.opportunities add column importado_em timestamptz;

do $$
begin
  execute format(
    'create function private.fn_inicio_do_primeiro_contato() returns timestamptz language sql immutable set search_path = public as %L',
    format('select timestamptz %L',
           to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
  );
end
$$;

revoke all on function private.fn_inicio_do_primeiro_contato() from public, anon, authenticated;

create function private.fn_soma_minutos_uteis(p_inicio timestamptz, p_minutos integer)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_local timestamp;
  v_restante interval;
  v_dia date;
  v_fecha timestamp;
begin
  if p_inicio is null or p_minutos is null or not isfinite(p_inicio) then
    return null;
  end if;
  v_local := p_inicio at time zone 'America/Sao_Paulo';
  v_restante := make_interval(mins => p_minutos);
  loop
    v_dia := v_local::date;
    v_fecha := v_dia + time '18:00';
    if extract(isodow from v_dia) >= 6 or v_local >= v_fecha then
      v_local := (v_dia + 1) + time '09:00';
      continue;
    end if;
    v_local := greatest(v_local, v_dia + time '09:00');
    if v_local + v_restante <= v_fecha then
      return (v_local + v_restante) at time zone 'America/Sao_Paulo';
    end if;
    v_restante := v_restante - (v_fecha - v_local);
    v_local := (v_dia + 1) + time '09:00';
  end loop;
end;
$$;

revoke all on function private.fn_soma_minutos_uteis(timestamptz, integer) from public, anon, authenticated;

create function private.fn_minutos_uteis_entre(p_de timestamptz, p_ate timestamptz)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_de timestamp;
  v_ate timestamp;
  v_dia date;
  v_total interval := interval '0';
  v_ini timestamp;
  v_fim timestamp;
begin
  if p_de is null or p_ate is null or not isfinite(p_de) or not isfinite(p_ate) then
    return null;
  end if;
  if p_ate <= p_de then
    return 0;
  end if;
  v_de := p_de at time zone 'America/Sao_Paulo';
  v_ate := p_ate at time zone 'America/Sao_Paulo';
  v_dia := v_de::date;
  while v_dia <= v_ate::date loop
    if extract(isodow from v_dia) < 6 then
      v_ini := greatest(v_de, v_dia + time '09:00');
      v_fim := least(v_ate, v_dia + time '18:00');
      if v_fim > v_ini then
        v_total := v_total + (v_fim - v_ini);
      end if;
    end if;
    v_dia := v_dia + 1;
  end loop;
  return floor(extract(epoch from v_total) / 60)::integer;
end;
$$;

revoke all on function private.fn_minutos_uteis_entre(timestamptz, timestamptz) from public, anon, authenticated;

create view private.v_primeiro_contato
with (security_invoker = true) as
select o.id as opportunity_id,
       o.owner_id,
       o.channel as canal,
       o.stage as estagio,
       o.em_nutricao,
       o.created_at as criado_em,
       p.prazo_min,
       case when o.created_at <= now()
            then private.fn_soma_minutos_uteis(o.created_at, p.prazo_min) end as vence_em,
       t.primeiro_toque_em,
       case when o.created_at <= now()
            then private.fn_minutos_uteis_entre(o.created_at, t.primeiro_toque_em) end
         as minutos_uteis_ate_toque
  from public.opportunities o
  cross join lateral (
    select (case
              when o.created_at > now() then null
              when o.importado_em is not null then null
              when o.channel = 'pago' then 5
              when o.channel in ('indicacao', 'inbound') then 60
            end)::integer as prazo_min
  ) p
  left join lateral (
    select min(e.created_at) as primeiro_toque_em
      from public.opportunity_events e
     where e.opportunity_id = o.id
       and e.event_type <> 'stage_change'
  ) t on true
 where o.created_at >= private.fn_inicio_do_primeiro_contato();

create function public.get_primeiro_contato(p_ids uuid[])
returns table (opportunity_id uuid, vence_em timestamptz, primeiro_toque_em timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    perform private.negar('get_primeiro_contato');
  end if;
  if coalesce(cardinality(p_ids), 0) > 400 then
    raise exception 'No máximo 400 oportunidades por consulta.' using errcode = '22023';
  end if;
  return query
    select v.opportunity_id, v.vence_em, v.primeiro_toque_em
      from private.v_primeiro_contato v
     where v.opportunity_id = any (p_ids)
       and not v.em_nutricao
       and v.estagio not in ('fechado', 'perdido', 'descartado');
end;
$$;

revoke all on function public.get_primeiro_contato(uuid[]) from public, anon;
grant execute on function public.get_primeiro_contato(uuid[]) to authenticated, service_role;

create function public.get_tempo_ate_primeiro_contato(p_desde date default null)
returns table (
  canal text,
  novos bigint,
  contatados bigint,
  mediana_min integer,
  com_prazo_medido bigint,
  no_prazo bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    perform private.negar('get_tempo_ate_primeiro_contato');
  end if;
  return query
    select coalesce(v.canal::text, 'sem_atribuicao'),
           count(*),
           count(v.primeiro_toque_em),
           round(percentile_cont(0.5) within group (order by v.minutos_uteis_ate_toque))::integer,
           count(*) filter (
             where v.prazo_min is not null
               and (v.primeiro_toque_em is not null or v.vence_em < now())),
           count(*) filter (
             where v.prazo_min is not null and v.primeiro_toque_em <= v.vence_em)
      from private.v_primeiro_contato v
     where p_desde is null
        or (v.criado_em at time zone 'America/Sao_Paulo')::date >= p_desde
     group by 1;
end;
$$;

revoke all on function public.get_tempo_ate_primeiro_contato(date) from public, anon;
grant execute on function public.get_tempo_ate_primeiro_contato(date) to authenticated, service_role;

create function public.primeiros_contatos_vencidos()
returns table (
  opportunity_id uuid,
  nome text,
  owner_id uuid,
  canal public.acquisition_channel,
  vence_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.opportunity_id, o.name, v.owner_id, v.canal, v.vence_em
    from private.v_primeiro_contato v
    join public.opportunities o on o.id = v.opportunity_id
   where v.prazo_min is not null
     and v.primeiro_toque_em is null
     and v.vence_em < now()
     and not v.em_nutricao
     and v.estagio not in ('fechado', 'perdido', 'descartado')
   order by v.vence_em, v.opportunity_id
   limit 5000;
$$;

revoke all on function public.primeiros_contatos_vencidos() from public, anon, authenticated;
grant execute on function public.primeiros_contatos_vencidos() to service_role;

create or replace function public.import_opportunities(p_pipeline_id uuid, p_linhas jsonb, p_previa boolean default true)
returns table (linha integer, acao text, motivo text, opportunity_id uuid, aviso text)
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
  v_campos jsonb; v_problema text;
  v_pipeline_alvo uuid; v_campos_alvo jsonb;
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
    acao := null; motivo := null; opportunity_id := null; aviso := null;

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
    v_campos := coalesce(v_item -> 'campos', '{}'::jsonb);
    if jsonb_typeof(v_campos) <> 'object' then
      acao := 'erro'; motivo := 'Campos precisam ser um objeto.'; return next; continue;
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
      v_problema := private.problemas_dos_campos(p_pipeline_id, v_campos, '{}'::jsonb);
      if v_problema is not null then
        acao := 'erro'; motivo := v_problema; return next; continue;
      end if;
      acao := 'atualiza'; motivo := 'mesmo telefone ou e-mail de uma linha anterior do arquivo'; return next; continue;
    end if;

    if v_alvo is not null then
      select o.pipeline_id, o.campos into v_pipeline_alvo, v_campos_alvo
        from public.opportunities o where o.id = v_alvo;
      if v_pipeline_alvo <> p_pipeline_id then
        if v_campos <> '{}'::jsonb then
          aviso := 'campos ignorados: a oportunidade está em outro pipeline';
        end if;
        v_campos := '{}'::jsonb;
      else
        v_problema := private.problemas_dos_campos(p_pipeline_id, v_campos_alvo || v_campos, v_campos_alvo);
        if v_problema is not null then
          acao := 'erro'; motivo := v_problema; return next; continue;
        end if;
      end if;
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
          owner_id        = coalesce(v_owner, o.owner_id),
          campos          = o.campos || v_campos
        where o.id = v_alvo;
      end if;
    else
      v_problema := private.problemas_dos_campos(p_pipeline_id, v_campos, null);
      if v_problema is not null then
        acao := 'erro'; motivo := v_problema; return next; continue;
      end if;
      acao := 'nova';
      if v_tel is not null then v_novas_tel := v_novas_tel || v_tel; end if;
      if v_email is not null then v_novas_email := v_novas_email || v_email; end if;
      if not p_previa then
        insert into public.opportunities
          (name, contact_name, contact_phone, contact_email, segment, nicho, channel, business_unit,
           estimated_value, lead_source, referred_by, notes, expected_fronts, owner_id, pipeline_id, stage_id, campos, importado_em)
        values
          (btrim(v_item ->> 'nome'), nullif(btrim(v_item ->> 'contato'), ''), nullif(btrim(v_item ->> 'telefone'), ''), v_email,
           nullif(btrim(v_item ->> 'segmento'), ''), nullif(btrim(v_item ->> 'nicho'), ''),
           v_canal::public.acquisition_channel, v_bu::public.business_unit,
           (v_item ->> 'valor_estimado')::numeric,
           coalesce(nullif(btrim(v_item ->> 'origem'), ''),
                    'csv:' || left(coalesce(nullif(btrim(v_item ->> 'arquivo'), ''), 'importacao'), 120)),
           nullif(btrim(v_item ->> 'indicado_por'), ''), nullif(btrim(v_item ->> 'observacoes'), ''), coalesce(v_frentes, '{}'),
           coalesce(v_owner, auth.uid()), p_pipeline_id, v_estagio, v_campos, now())
        returning id into opportunity_id;
      end if;
    end if;
    return next;
  end loop;
end $$;

alter type public.notification_kind add value if not exists 'primeiro_contato_vencido';
