create table public.motivos_de_saida (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete restrict,
  tipo        text not null check (tipo in ('perda','descarte')),
  rotulo      text not null,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint motivos_de_saida_rotulo_nao_vazio check (length(btrim(rotulo)) between 1 and 60)
);
create unique index motivos_de_saida_rotulo_unico
  on public.motivos_de_saida (pipeline_id, tipo, lower(btrim(rotulo)));
alter table public.motivos_de_saida enable row level security;
revoke all on table public.motivos_de_saida from anon;

create trigger trg_motivos_de_saida_updated before update on public.motivos_de_saida
  for each row execute function private.set_updated_at();

create function private.motivos_de_saida_imutaveis()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo is distinct from old.tipo or new.pipeline_id is distinct from old.pipeline_id then
    raise exception 'Motivo não muda de tipo nem de pipeline. Desative e crie outro.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.motivos_de_saida_imutaveis() from public, anon;
create trigger trg_motivos_de_saida_imutaveis
  before update of tipo, pipeline_id on public.motivos_de_saida
  for each row execute function private.motivos_de_saida_imutaveis();

create policy "motivos: staff le" on public.motivos_de_saida
  for select to authenticated using (public.is_staff());
create policy "motivos: owner e manager escrevem" on public.motivos_de_saida
  for all to authenticated
  using (public.is_staff() and public.current_app_role() in ('owner','manager'))
  with check (public.is_staff() and public.current_app_role() in ('owner','manager'));

insert into public.motivos_de_saida (pipeline_id, tipo, rotulo, ordem) values
  ('10000000-0000-4000-8000-000000000001','perda','Preço',1),
  ('10000000-0000-4000-8000-000000000001','perda','Escolheu concorrente',2),
  ('10000000-0000-4000-8000-000000000001','perda','Timing — adiou a decisão',3),
  ('10000000-0000-4000-8000-000000000001','perda','Desengajou',4),
  ('10000000-0000-4000-8000-000000000001','perda','Sumiu depois da proposta',5),
  ('10000000-0000-4000-8000-000000000001','perda','Sem fit de solução',6),
  ('10000000-0000-4000-8000-000000000001','descarte','Sem verba',1),
  ('10000000-0000-4000-8000-000000000001','descarte','Sem autoridade para decidir',2),
  ('10000000-0000-4000-8000-000000000001','descarte','Fora do perfil de cliente ideal',3),
  ('10000000-0000-4000-8000-000000000001','descarte','Nunca respondeu',4),
  ('10000000-0000-4000-8000-000000000001','descarte','Curioso ou concorrente',5),
  ('10000000-0000-4000-8000-000000000001','descarte','Dado de contato inválido',6);

create function private.copia_motivos_padrao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id = '10000000-0000-4000-8000-000000000001' then return null; end if;
  insert into public.motivos_de_saida (pipeline_id, tipo, rotulo, ordem)
  select new.id, m.tipo, m.rotulo, m.ordem
    from public.motivos_de_saida m
   where m.pipeline_id = '10000000-0000-4000-8000-000000000001' and m.ativo;
  return null;
end $$;
revoke all on function private.copia_motivos_padrao() from public, anon;
create trigger trg_pipelines_copia_motivos after insert on public.pipelines
  for each row execute function private.copia_motivos_padrao();

alter table public.opportunities
  add column motivo_id uuid references public.motivos_de_saida (id) on delete restrict;

update public.opportunities o
   set motivo_id = m.id
  from public.motivos_de_saida m
 where m.pipeline_id = o.pipeline_id
   and ((o.stage = 'perdido' and m.tipo = 'perda' and m.rotulo = case o.motivo_perda
          when 'preco' then 'Preço' when 'escolheu_concorrente' then 'Escolheu concorrente'
          when 'timing_adiou' then 'Timing — adiou a decisão' when 'desengajou' then 'Desengajou'
          when 'sumiu_pos_proposta' then 'Sumiu depois da proposta' when 'sem_fit_de_solucao' then 'Sem fit de solução' end)
     or (o.stage = 'descartado' and m.tipo = 'descarte' and m.rotulo = case o.motivo_descarte
          when 'sem_verba' then 'Sem verba' when 'sem_autoridade' then 'Sem autoridade para decidir'
          when 'fora_do_icp' then 'Fora do perfil de cliente ideal' when 'nunca_respondeu' then 'Nunca respondeu'
          when 'curioso_ou_concorrente' then 'Curioso ou concorrente' when 'dado_invalido' then 'Dado de contato inválido' end));

do $$
declare v_faltando int;
begin
  select count(*) into v_faltando from public.opportunities
   where stage in ('perdido','descartado') and motivo_id is null;
  if v_faltando > 0 then
    raise exception 'Backfill de motivo_id deixou % oportunidade(s) sem motivo', v_faltando;
  end if;
end $$;

revoke select (motivo_perda, motivo_descarte), update (motivo_perda, motivo_descarte)
  on public.opportunities from authenticated;
alter table public.opportunities drop constraint opportunities_motivo_por_estagio;
alter table public.opportunities drop column motivo_perda, drop column motivo_descarte;
drop type public.motivo_perda;
drop type public.motivo_descarte;
alter table public.opportunities
  add constraint opportunities_motivo_por_estagio check (
    stage not in ('perdido','descartado') or motivo_id is not null
  );
grant select (motivo_id), update (motivo_id) on public.opportunities to authenticated;
create index on public.opportunities (motivo_id);

create function private.opportunities_valida_motivo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_pipeline uuid;
begin
  if new.motivo_id is null then return new; end if;
  select tipo, pipeline_id into v_tipo, v_pipeline from public.motivos_de_saida where id = new.motivo_id;
  if v_pipeline <> new.pipeline_id then
    raise exception 'O motivo não pertence ao pipeline desta oportunidade.' using errcode = '23514';
  end if;
  if (new.stage = 'perdido' and v_tipo <> 'perda') or (new.stage = 'descartado' and v_tipo <> 'descarte') then
    raise exception 'Oportunidade perdida recebe motivo de perda; descartada, motivo de descarte.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.opportunities_valida_motivo() from public, anon;
create trigger trg_opportunities_01_valida_motivo
  before insert or update of stage, stage_id, motivo_id on public.opportunities
  for each row execute function private.opportunities_valida_motivo();

create or replace function private.opportunities_limpa_motivo_por_estagio()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.stage not in ('perdido','descartado') then
    new.motivo_id := null;
    new.motivo_obs := null;
  end if;
  return new;
end $$;

