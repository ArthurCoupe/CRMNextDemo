alter table public.opportunities
  add column pipeline_id uuid not null default '10000000-0000-4000-8000-000000000001'
    references public.pipelines (id) on delete restrict,
  add column stage_id uuid references public.pipeline_stages (id) on delete restrict;

update public.opportunities o
   set stage_id = private.estagio_canonico(o.pipeline_id, o.stage)
 where o.stage_id is null;
alter table public.opportunities alter column stage_id set not null;

create index on public.opportunities (pipeline_id, stage_id);

grant select (pipeline_id, stage_id), insert (pipeline_id, stage_id), update (stage_id)
  on public.opportunities to authenticated;

create function private.opportunities_sincroniza_estagio()
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
    from public.pipeline_stages s where s.id = new.stage_id;
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

create trigger trg_opportunities_00_sincroniza_estagio
  before insert or update of stage, stage_id, pipeline_id on public.opportunities
  for each row execute function private.opportunities_sincroniza_estagio();

create function private.pipeline_stages_tipo_em_uso()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo is distinct from old.tipo
     and exists (select 1 from public.opportunities where stage_id = new.id) then
    raise exception 'Estágio com oportunidades não muda de tipo. Crie outro estágio e mova as oportunidades.'
      using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.pipeline_stages_tipo_em_uso() from public, anon;

create trigger trg_pipeline_stages_tipo_em_uso
  before update of tipo on public.pipeline_stages
  for each row execute function private.pipeline_stages_tipo_em_uso();

create or replace function private.log_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_de text; v_para text;
begin
  if new.stage_id is distinct from old.stage_id or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    select nome into v_de   from public.pipeline_stages where id = old.stage_id;
    select nome into v_para from public.pipeline_stages where id = new.stage_id;
    insert into public.opportunity_events
      (opportunity_id, actor_id, event_type, from_stage, to_stage, content)
    values (new.id, auth.uid(), 'stage_change', old.stage, new.stage, v_de || ' → ' || v_para);
  end if;
  return new;
end $$;
revoke all on function private.log_stage_change() from public, anon;

drop trigger if exists trg_opportunities_stage on public.opportunities;
create trigger trg_opportunities_stage
  before update of stage, stage_id on public.opportunities
  for each row execute function private.log_stage_change();

