create table public.pipelines (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipelines_nome_nao_vazio check (length(btrim(nome)) between 1 and 60)
);
create unique index pipelines_nome_unico on public.pipelines (lower(btrim(nome)));
alter table public.pipelines enable row level security;
revoke all on table public.pipelines from anon;

create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete restrict,
  nome        text not null,
  ordem       integer not null,
  tipo        public.opportunity_stage not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint pipeline_stages_nome_unico unique (pipeline_id, nome) deferrable initially deferred,
  constraint pipeline_stages_ordem_unica unique (pipeline_id, ordem) deferrable initially deferred,
  constraint pipeline_stages_nome_nao_vazio check (length(btrim(nome)) between 1 and 40)
);
alter table public.pipeline_stages enable row level security;
revoke all on table public.pipeline_stages from anon;

create trigger trg_pipelines_updated before update on public.pipelines
  for each row execute function private.set_updated_at();
create trigger trg_pipeline_stages_updated before update on public.pipeline_stages
  for each row execute function private.set_updated_at();

create policy "pipelines: staff le" on public.pipelines
  for select to authenticated using (public.is_staff());
create policy "pipelines: owner e manager escrevem" on public.pipelines
  for all to authenticated
  using (public.is_staff() and public.current_app_role() in ('owner','manager'))
  with check (public.is_staff() and public.current_app_role() in ('owner','manager'));
create policy "estagios: staff le" on public.pipeline_stages
  for select to authenticated using (public.is_staff());
create policy "estagios: owner e manager escrevem" on public.pipeline_stages
  for all to authenticated
  using (public.is_staff() and public.current_app_role() in ('owner','manager'))
  with check (public.is_staff() and public.current_app_role() in ('owner','manager'));

create function private.estagio_canonico(p_pipeline_id uuid, p_tipo public.opportunity_stage)
returns uuid language sql stable set search_path = public as $$
  select coalesce(
    (select s.id from public.pipeline_stages s
      where s.pipeline_id = p_pipeline_id and s.tipo = p_tipo
      order by s.ordem limit 1),
    (select s.id from public.pipeline_stages s
      where s.pipeline_id = p_pipeline_id
        and s.tipo not in ('fechado','perdido','descartado')
      order by s.ordem limit 1)
  );
$$;
revoke all on function private.estagio_canonico(uuid, public.opportunity_stage) from public, anon;

create function private.confere_invariantes_do_pipeline(p_pipeline_id uuid)
returns void language plpgsql set search_path = public as $$
declare
  v_fechado int; v_perdido int; v_descartado int; v_abertos int;
begin
  select count(*) filter (where tipo = 'fechado'),
         count(*) filter (where tipo = 'perdido'),
         count(*) filter (where tipo = 'descartado'),
         count(*) filter (where tipo not in ('fechado','perdido','descartado'))
    into v_fechado, v_perdido, v_descartado, v_abertos
    from public.pipeline_stages where pipeline_id = p_pipeline_id;
  if v_fechado <> 1 or v_perdido <> 1 or v_descartado <> 1 then
    raise exception 'Todo pipeline precisa de exatamente um estágio de cada tipo: fechado, perdido e descartado.'
      using errcode = '23514';
  end if;
  if v_abertos < 1 then
    raise exception 'Todo pipeline precisa de pelo menos um estágio aberto (antes do fechamento).'
      using errcode = '23514';
  end if;
end $$;
revoke all on function private.confere_invariantes_do_pipeline(uuid) from public, anon;

create function private.pipeline_stages_invariantes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pipeline uuid := coalesce(new.pipeline_id, old.pipeline_id);
begin
  if tg_op = 'UPDATE' and old.pipeline_id is distinct from new.pipeline_id then
    raise exception 'Estágio não muda de pipeline.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.pipelines where id = v_pipeline) then
    return null;
  end if;
  perform private.confere_invariantes_do_pipeline(v_pipeline);
  return null;
end $$;
revoke all on function private.pipeline_stages_invariantes() from public, anon;

create constraint trigger trg_pipeline_stages_invariantes
  after insert or update or delete on public.pipeline_stages
  deferrable initially deferred
  for each row execute function private.pipeline_stages_invariantes();

create function private.pipelines_invariantes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.confere_invariantes_do_pipeline(new.id);
  return null;
end $$;
revoke all on function private.pipelines_invariantes() from public, anon;

create constraint trigger trg_pipelines_invariantes
  after insert on public.pipelines
  deferrable initially deferred
  for each row execute function private.pipelines_invariantes();

create function public.save_pipeline_stages(p_pipeline_id uuid, p_estagios jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_pertence boolean;
  v_item record;
begin
  if coalesce(public.current_app_role() in ('owner','manager'), false) is false then
    raise exception 'Editar pipelines é do owner e do manager.' using errcode = '42501';
  end if;

  if p_estagios is null or jsonb_typeof(p_estagios) <> 'array' then
    raise exception 'Estágios devem ser uma lista.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_estagios) < 1 or jsonb_array_length(p_estagios) > 30 then
    raise exception 'Pipeline precisa de 1 a 30 estágios.' using errcode = '22023';
  end if;

  select array_agg((elem->>'id')::uuid) filter (where elem->>'id' is not null)
    into v_ids
    from jsonb_array_elements(p_estagios) elem;

  if v_ids is not null and array_length(v_ids, 1) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'Estágio repetido na lista.' using errcode = '22023';
  end if;

  delete from public.pipeline_stages
    where pipeline_id = p_pipeline_id
      and id <> all (coalesce(v_ids, array[]::uuid[]));

  for v_item in
    select elem, ord::int as ordem
      from jsonb_array_elements(p_estagios) with ordinality as t(elem, ord)
  loop
    v_id := nullif(v_item.elem->>'id', '')::uuid;
    if v_id is null then
      insert into public.pipeline_stages (pipeline_id, nome, ordem, tipo)
        values (p_pipeline_id, v_item.elem->>'nome', v_item.ordem, (v_item.elem->>'tipo')::public.opportunity_stage);
    else
      select exists(
        select 1 from public.pipeline_stages where id = v_id and pipeline_id = p_pipeline_id
      ) into v_pertence;
      if not v_pertence then
        raise exception 'Estágio não pertence ao pipeline.' using errcode = '23514';
      end if;
      update public.pipeline_stages
        set nome = v_item.elem->>'nome',
            tipo = (v_item.elem->>'tipo')::public.opportunity_stage,
            ordem = v_item.ordem
        where id = v_id;
    end if;
  end loop;
end $$;
revoke all on function public.save_pipeline_stages(uuid, jsonb) from public, anon;
grant execute on function public.save_pipeline_stages(uuid, jsonb) to authenticated, service_role;

create function public.create_pipeline(p_nome text, p_estagios jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if coalesce(public.current_app_role() in ('owner','manager'), false) is false then
    raise exception 'Editar pipelines é do owner e do manager.' using errcode = '42501';
  end if;

  insert into public.pipelines (nome, ordem)
    values (p_nome, coalesce((select max(ordem) from public.pipelines), 0) + 1)
    returning id into v_id;

  perform public.save_pipeline_stages(v_id, p_estagios);

  return v_id;
end $$;
revoke all on function public.create_pipeline(text, jsonb) from public, anon;
grant execute on function public.create_pipeline(text, jsonb) to authenticated, service_role;

insert into public.pipelines (id, nome, ordem) values
  ('10000000-0000-4000-8000-000000000001', 'Comercial', 0);
insert into public.pipeline_stages (pipeline_id, nome, ordem, tipo) values
  ('10000000-0000-4000-8000-000000000001', 'Prospecção',       1, 'prospeccao'),
  ('10000000-0000-4000-8000-000000000001', 'Abordagem',        2, 'abordagem'),
  ('10000000-0000-4000-8000-000000000001', 'Qualificação',     3, 'qualificacao'),
  ('10000000-0000-4000-8000-000000000001', 'R1 · Diagnóstico', 4, 'r1'),
  ('10000000-0000-4000-8000-000000000001', 'R2 · Proposta',    5, 'r2'),
  ('10000000-0000-4000-8000-000000000001', 'Fechado',          6, 'fechado'),
  ('10000000-0000-4000-8000-000000000001', 'Perdido',          7, 'perdido'),
  ('10000000-0000-4000-8000-000000000001', 'Descartado',       8, 'descartado');

