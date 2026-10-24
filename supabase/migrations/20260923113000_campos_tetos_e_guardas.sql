create or replace function private.pipeline_campos_opcoes_sem_duplicata()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.opcoes is not null
     and cardinality(new.opcoes) <> (select count(*) from (select distinct o from unnest(new.opcoes) o) d) then
    raise exception 'Opção repetida na lista.' using errcode = '23514';
  end if;
  if new.opcoes is not null
     and exists (select 1 from unnest(new.opcoes) o where length(o) > 60) then
    raise exception 'Cada opção aceita até 60 caracteres.' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function private.problemas_dos_campos(
  p_pipeline_id uuid,
  p_campos jsonb,
  p_campos_antes jsonb default null
)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_chave text;
  v_valor jsonb;
  v_uuid  uuid;
  v_campo public.pipeline_campos%rowtype;
begin
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then
    return 'Campos precisam ser um objeto.';
  end if;
  if (select count(*) from jsonb_object_keys(p_campos)) > 30 then
    return 'No máximo 30 campos.';
  end if;

  for v_chave, v_valor in select key, value from jsonb_each(p_campos) loop
    begin
      v_uuid := v_chave::uuid;
    exception when invalid_text_representation then
      return 'Campo desconhecido para este pipeline.';
    end;
    if v_uuid::text <> v_chave then
      return 'Campo desconhecido para este pipeline.';
    end if;
    select * into v_campo from public.pipeline_campos
      where id = v_uuid and pipeline_id = p_pipeline_id;
    if not found then
      return 'Campo desconhecido para este pipeline.';
    end if;
    if v_valor is not distinct from (p_campos_antes -> v_chave) then
      continue;
    end if;
    if not v_campo.ativo then
      return format('O campo %s está desativado.', v_campo.nome);
    end if;
    case v_campo.tipo
      when 'texto' then
        if jsonb_typeof(v_valor) <> 'string' then
          return format('O campo %s espera texto.', v_campo.nome);
        end if;
        if length(v_valor #>> '{}') > 500 then
          return format('O campo %s aceita até 500 caracteres.', v_campo.nome);
        end if;
      when 'sim_nao' then
        if jsonb_typeof(v_valor) <> 'boolean' then
          return format('O campo %s espera sim ou não.', v_campo.nome);
        end if;
      when 'numero' then
        if jsonb_typeof(v_valor) <> 'number' then
          return format('O campo %s espera um número.', v_campo.nome);
        end if;
        if abs((v_valor #>> '{}')::numeric) >= 1e10 then
          return format('O campo %s espera um número.', v_campo.nome);
        end if;
      when 'lista' then
        if jsonb_typeof(v_valor) <> 'string' then
          return format('O campo %s espera uma das opções.', v_campo.nome);
        end if;
        if (v_valor #>> '{}') <> all (v_campo.opcoes) then
          return format('O campo %s só aceita: %s.', v_campo.nome, array_to_string(v_campo.opcoes, ', '));
        end if;
    end case;
  end loop;

  if p_campos_antes is null then
    select c.* into v_campo from public.pipeline_campos c
      where c.pipeline_id = p_pipeline_id and c.ativo and c.obrigatorio
        and (not p_campos ? c.id::text
             or (c.tipo in ('texto','lista') and p_campos ->> c.id::text = ''))
      order by c.ordem, c.id
      limit 1;
    if found then
      return format('O campo %s é obrigatório.', v_campo.nome);
    end if;
  end if;

  return null;
end $$;

create or replace function private.opportunities_sincroniza_estagio()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tipo public.opportunity_stage;
  v_pipeline_do_estagio uuid;
  v_legado boolean := false;
begin
  if auth.uid() is not null
     and coalesce(public.current_app_role() in ('owner','manager'), false) is false then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

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
    v_legado := true;
    new.stage_id := private.estagio_canonico(new.pipeline_id, new.stage);
  end if;

  if new.stage_id is null and not v_legado then
    raise exception 'Oportunidade precisa de estágio.' using errcode = '23502';
  end if;

  select s.tipo, s.pipeline_id into v_tipo, v_pipeline_do_estagio
    from public.pipeline_stages s where s.id = new.stage_id for share;
  if v_legado and v_tipo is distinct from new.stage then
    raise exception 'Este pipeline não tem estágio do tipo %.', new.stage using errcode = '23514';
  end if;
  if v_tipo is null then
    raise exception 'Estágio inexistente.' using errcode = '23503';
  end if;
  if v_pipeline_do_estagio <> new.pipeline_id then
    raise exception 'O estágio não pertence ao pipeline desta oportunidade.' using errcode = '23514';
  end if;
  new.stage := v_tipo;
  return new;
end $$;

