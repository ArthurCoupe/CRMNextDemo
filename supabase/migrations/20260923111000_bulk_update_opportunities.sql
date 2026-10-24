create function public.bulk_update_opportunities(
  p_alvos      jsonb,
  p_owner_id   uuid  default null,
  p_estagio_id uuid  default null,
  p_motivo_id  uuid  default null,
  p_motivo_obs text  default null,
  p_campos     jsonb default null
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ids          uuid[];
  v_vistos       uuid[];
  v_n            integer;
  v_movidos      integer;
  v_fechadas     integer;
  v_pipelines    uuid[];
  v_pipeline     uuid;
  v_tipo_destino public.opportunity_stage;
  v_alvo         record;
  v_problema     text;
begin
  if coalesce(public.current_app_role() in ('owner','manager'), false) is false then
    raise exception 'Só owner e manager alteram em lote.' using errcode = '42501';
  end if;

  if p_alvos is null or jsonb_typeof(p_alvos) <> 'array'
     or jsonb_array_length(p_alvos) < 1 or jsonb_array_length(p_alvos) > 400 then
    raise exception 'Selecione de 1 a 400 oportunidades.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_alvos) e
              where jsonb_typeof(e) <> 'object' or e ->> 'id' is null or e ->> 'stage_id' is null) then
    raise exception 'Cada alvo precisa de id e stage_id.' using errcode = '22023';
  end if;
  begin
    select array_agg((e ->> 'id')::uuid), array_agg((e ->> 'stage_id')::uuid)
      into v_ids, v_vistos
      from jsonb_array_elements(p_alvos) e;
  exception when invalid_text_representation then
    raise exception 'Cada alvo precisa de id e stage_id.' using errcode = '22023';
  end;
  if (select count(distinct x) from unnest(v_ids) x) <> cardinality(v_ids) then
    raise exception 'Oportunidade repetida na lista.' using errcode = '22023';
  end if;

  if p_campos is not null and jsonb_typeof(p_campos) <> 'object' then
    raise exception 'Campos precisam ser um objeto.' using errcode = '22023';
  end if;
  if p_owner_id is null and p_estagio_id is null and coalesce(p_campos, '{}') = '{}' then
    raise exception 'Escolha pelo menos uma ação.' using errcode = '22023';
  end if;

  perform 1 from public.opportunities where id = any (v_ids) for update;
  select count(*),
         count(*) filter (where o.stage_id <> a.visto),
         count(*) filter (where o.stage = 'fechado'),
         array_agg(distinct o.pipeline_id)
    into v_n, v_movidos, v_fechadas, v_pipelines
    from unnest(v_ids, v_vistos) as a(id, visto)
    join public.opportunities o on o.id = a.id;
  if v_n <> cardinality(v_ids) or v_movidos > 0 then
    raise exception 'Alguém moveu uma das oportunidades — recarregue o board.' using errcode = '23514';
  end if;
  if cardinality(v_pipelines) <> 1 then
    raise exception 'Selecione oportunidades de um pipeline só.' using errcode = '0A000';
  end if;
  v_pipeline := v_pipelines[1];
  if p_estagio_id is not null and v_fechadas > 0 then
    raise exception 'Oportunidade fechada não se move em lote — use Desfazer fechamento.' using errcode = '23514';
  end if;

  if p_estagio_id is not null then
    select s.tipo into v_tipo_destino
      from public.pipeline_stages s
     where s.id = p_estagio_id and s.pipeline_id = v_pipeline
       for share;
    if v_tipo_destino is null then
      raise exception 'O estágio não pertence ao pipeline desta oportunidade.' using errcode = '23514';
    end if;
    if v_tipo_destino = 'fechado' then
      raise exception 'Fechar negócio é pelo botão Fechar, um por vez.' using errcode = '23514';
    end if;
    if v_tipo_destino in ('perdido','descartado') and (p_motivo_id is null or not exists (
         select 1 from public.motivos_de_saida m
          where m.id = p_motivo_id and m.pipeline_id = v_pipeline and m.ativo
            and m.tipo = case v_tipo_destino when 'perdido' then 'perda' else 'descarte' end)) then
      raise exception 'Escolha o motivo.' using errcode = '23514';
    end if;
    if length(p_motivo_obs) > 500 then
      raise exception 'Observação do motivo aceita até 500 caracteres.' using errcode = '23514';
    end if;
  end if;

  if p_owner_id is not null and not exists (
       select 1 from public.profiles p
        where p.id = p_owner_id and p.active and p.role in ('owner','manager','member')) then
    raise exception 'Responsável precisa ser alguém ativo da equipe.' using errcode = '23514';
  end if;

  if p_campos is not null then
    for v_alvo in select o.campos from public.opportunities o where o.id = any (v_ids) loop
      v_problema := private.problemas_dos_campos(v_pipeline, v_alvo.campos || p_campos, v_alvo.campos);
      if v_problema is not null then
        raise exception '%', v_problema using errcode = '23514';
      end if;
    end loop;
  end if;

  update public.opportunities o
     set owner_id   = coalesce(p_owner_id, o.owner_id),
         stage_id   = coalesce(p_estagio_id, o.stage_id),
         stage      = coalesce(v_tipo_destino, o.stage),
         motivo_id  = case when v_tipo_destino in ('perdido','descartado') then p_motivo_id  else o.motivo_id  end,
         motivo_obs = case when v_tipo_destino in ('perdido','descartado') then p_motivo_obs else o.motivo_obs end,
         campos     = case when p_campos is null then o.campos else o.campos || p_campos end
   where o.id = any (v_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.bulk_update_opportunities(jsonb, uuid, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.bulk_update_opportunities(jsonb, uuid, uuid, uuid, text, jsonb) to authenticated, service_role;

