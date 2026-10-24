create or replace function private.opportunities_sincroniza_estagio()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tipo public.opportunity_stage;
  v_pipeline_do_estagio uuid;
  v_legado boolean := false;
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
revoke all on function private.opportunities_sincroniza_estagio() from public, anon;
