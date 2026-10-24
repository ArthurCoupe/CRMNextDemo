create type public.pipeline_campo_tipo as enum ('texto', 'sim_nao', 'lista', 'numero');

create table public.pipeline_campos (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete restrict,
  nome        text not null,
  tipo        public.pipeline_campo_tipo not null,
  opcoes      text[],
  obrigatorio boolean not null default false,
  ordem       integer not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint pipeline_campos_nome_nao_vazio check (length(btrim(nome)) between 1 and 60),
  constraint pipeline_campos_opcoes_por_tipo check (
    case when tipo = 'lista'
         then opcoes is not null and cardinality(opcoes) between 1 and 30
              and array_position(opcoes, null) is null and '' <> all (opcoes)
         else opcoes is null end
  )
);
create unique index pipeline_campos_nome_unico
  on public.pipeline_campos (pipeline_id, lower(btrim(nome)));
create index if not exists pipeline_campos_pipeline_ordem
  on public.pipeline_campos (pipeline_id, ordem);
alter table public.pipeline_campos enable row level security;
revoke all on table public.pipeline_campos from anon;
revoke truncate on table public.pipeline_campos from authenticated;

create trigger trg_pipeline_campos_updated before update on public.pipeline_campos
  for each row execute function private.set_updated_at();

create function private.pipeline_campos_imutavel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pipeline_id is distinct from old.pipeline_id then
    raise exception 'O campo não muda de pipeline.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.pipeline_campos_imutavel() from public, anon;
create trigger trg_pipeline_campos_imutavel
  before update of pipeline_id on public.pipeline_campos
  for each row execute function private.pipeline_campos_imutavel();

create function private.pipeline_campos_opcoes_sem_duplicata()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.opcoes is not null
     and cardinality(new.opcoes) <> (select count(*) from (select distinct o from unnest(new.opcoes) o) d) then
    raise exception 'Opção repetida na lista.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.pipeline_campos_opcoes_sem_duplicata() from public, anon;
create trigger trg_pipeline_campos_opcoes_sem_duplicata
  before insert or update of opcoes on public.pipeline_campos
  for each row execute function private.pipeline_campos_opcoes_sem_duplicata();

create policy "campos: staff le" on public.pipeline_campos
  for select to authenticated using (public.is_staff());
create policy "campos: owner e manager escrevem" on public.pipeline_campos
  for all to authenticated
  using (public.is_staff() and public.current_app_role() in ('owner','manager'))
  with check (public.is_staff() and public.current_app_role() in ('owner','manager'));

create function private.pipeline_campos_teto()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  perform 1 from public.pipelines where id = new.pipeline_id for update;
  select count(*) into v_total from public.pipeline_campos where pipeline_id = new.pipeline_id;
  if v_total > 30 then
    raise exception 'Este pipeline já tem 30 campos.' using errcode = '23514';
  end if;
  return null;
end $$;
revoke all on function private.pipeline_campos_teto() from public, anon;
create constraint trigger trg_pipeline_campos_teto
  after insert on public.pipeline_campos
  deferrable initially deferred
  for each row execute function private.pipeline_campos_teto();

alter table public.opportunities
  add column campos jsonb not null default '{}'::jsonb;
grant select (campos), insert (campos), update (campos)
  on public.opportunities to authenticated;

create function private.pipeline_campos_nao_apaga_em_uso()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  select count(*) into v_n from public.opportunities where campos ? old.id::text;
  if v_n > 0 then
    raise exception 'Este campo tem valor gravado em % oportunidades — desative em vez de apagar.', v_n
      using errcode = '23514';
  end if;
  return old;
end $$;
revoke all on function private.pipeline_campos_nao_apaga_em_uso() from public, anon;
create trigger trg_pipeline_campos_nao_apaga_em_uso
  before delete on public.pipeline_campos
  for each row execute function private.pipeline_campos_nao_apaga_em_uso();

create function private.problemas_dos_campos(
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
revoke all on function private.problemas_dos_campos(uuid, jsonb, jsonb) from public, anon, authenticated;

create function private.opportunities_valida_campos()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_problema text;
begin
  if auth.uid() is not null
     and coalesce(public.current_app_role() in ('owner','manager'), false) is false then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  v_problema := private.problemas_dos_campos(
    new.pipeline_id, new.campos, case when tg_op = 'INSERT' then null else old.campos end);
  if v_problema is not null then
    raise exception '%', v_problema using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.opportunities_valida_campos() from public, anon;
create trigger trg_opportunities_02_valida_campos
  before insert or update of campos on public.opportunities
  for each row execute function private.opportunities_valida_campos();

