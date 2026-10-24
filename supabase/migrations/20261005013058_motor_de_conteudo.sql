create type public.post_format as enum ('reel', 'carrossel', 'estatico', 'story');
create type public.post_status as enum
  ('rascunho', 'em_aprovacao', 'ajuste_pedido', 'aprovado', 'agendado', 'publicado');
create type public.post_channel as enum ('instagram', 'facebook');

create table public.content_posts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  title          text not null check (btrim(title) <> '' and char_length(title) <= 200),
  caption        text check (char_length(caption) <= 2200),
  format         public.post_format not null,
  channel        public.post_channel not null default 'instagram',
  media_url      text check (media_url ~ '^https://[^[:space:]]+$' and char_length(media_url) <= 2000),
  scheduled_at   timestamptz not null,
  responsible_id uuid not null references public.profiles(id),
  status         public.post_status not null default 'rascunho',
  status_desde   timestamptz not null default now(),
  published_at   timestamptz,
  published_url  text check (published_url ~ '^https://[^[:space:]]+$' and char_length(published_url) <= 2000),
  created_by     uuid not null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint content_posts_publicado_tem_data
    check ((status = 'publicado') = (published_at is not null))
);

create index content_posts_client_agenda_idx on public.content_posts (client_id, scheduled_at);
create index content_posts_agenda_idx on public.content_posts (scheduled_at);
create index content_posts_status_agenda_idx on public.content_posts (status, scheduled_at);
create index content_posts_responsible_id_fk_idx on public.content_posts (responsible_id);

create table public.content_post_events (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references public.content_posts(id) on delete cascade,
  de               public.post_status,
  para             public.post_status not null,
  nota             text check (char_length(nota) <= 2000),
  internal_task_id uuid references public.internal_tasks(id) on delete set null,
  autor_id         uuid not null,
  criado_em        timestamptz not null default now()
);

create index content_post_events_post_idx on public.content_post_events (post_id, criado_em);
create index content_post_events_internal_task_id_fk_idx on public.content_post_events (internal_task_id);

insert into public.task_catalog (category, task_type, ordem)
values ('Posicionamento · conteúdo', 'Ajuste pedido pelo cliente', 12);

alter table public.content_posts enable row level security;
alter table public.content_posts force row level security;
alter table public.content_post_events enable row level security;
alter table public.content_post_events force row level security;

create policy "content_posts: staff lê" on public.content_posts
  for select to authenticated using (public.is_staff());
create policy "content_posts: staff cria" on public.content_posts
  for insert to authenticated with check (public.is_staff());
create policy "content_posts: staff edita" on public.content_posts
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "content_posts: owner e manager apagam" on public.content_posts
  for delete to authenticated
  using (public.is_staff() and public.current_app_role() in ('owner', 'manager'));
create policy "content_post_events: staff lê" on public.content_post_events
  for select to authenticated using (public.is_staff());

revoke all on table public.content_posts from anon, authenticated;
grant select, delete on table public.content_posts to authenticated;
grant insert (client_id, title, caption, format, channel, media_url, scheduled_at, responsible_id)
  on table public.content_posts to authenticated;
grant update (client_id, title, caption, format, channel, media_url, scheduled_at, responsible_id)
  on table public.content_posts to authenticated;

revoke all on table public.content_post_events from anon, authenticated;
grant select on table public.content_post_events to authenticated;

create function private.post_transicao_valida(p_de public.post_status, p_para public.post_status)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(p_de::text || '>' || p_para::text = any (array[
    'rascunho>em_aprovacao',
    'em_aprovacao>aprovado', 'em_aprovacao>ajuste_pedido', 'em_aprovacao>rascunho',
    'ajuste_pedido>em_aprovacao', 'ajuste_pedido>rascunho',
    'aprovado>agendado', 'aprovado>publicado', 'aprovado>ajuste_pedido',
    'agendado>publicado', 'agendado>aprovado'
  ]), false)
$$;
revoke all on function private.post_transicao_valida(public.post_status, public.post_status)
  from public, anon, authenticated;

create function private.content_posts_transicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and not private.post_transicao_valida(old.status, new.status) then
    raise exception 'Mudança de etapa não permitida para este post.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.content_posts_transicao() from public, anon, authenticated;

create trigger trg_content_posts_transicao
  before update of status on public.content_posts
  for each row execute function private.content_posts_transicao();

create function private.content_posts_trava_conteudo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'publicado'
     and row(new.title, new.caption, new.media_url, new.format, new.channel, new.client_id,
             new.scheduled_at, new.responsible_id)
         is distinct from
         row(old.title, old.caption, old.media_url, old.format, old.channel, old.client_id,
             old.scheduled_at, old.responsible_id) then
    raise exception 'Este post já foi publicado e não pode ser alterado.' using errcode = '42501';
  end if;
  if old.status not in ('rascunho', 'ajuste_pedido')
     and row(new.title, new.caption, new.media_url, new.format, new.channel, new.client_id)
         is distinct from
         row(old.title, old.caption, old.media_url, old.format, old.channel, old.client_id) then
    raise exception 'Este post já foi enviado ao cliente. Para alterar o conteúdo, mova-o para ajuste pedido ou rascunho.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.content_posts_trava_conteudo() from public, anon, authenticated;

create trigger trg_content_posts_trava_conteudo
  before update on public.content_posts
  for each row execute function private.content_posts_trava_conteudo();

create function private.content_posts_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.responsible_id is not distinct from old.responsible_id then
      return new;
    end if;
  end if;
  if not exists (
    select 1 from public.profiles
     where id = new.responsible_id and active and role in ('owner', 'manager', 'member')
  ) then
    raise exception 'O responsável precisa ser uma pessoa ativa da equipe.' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.content_posts_responsavel() from public, anon, authenticated;

create trigger trg_content_posts_responsavel
  before insert or update of responsible_id on public.content_posts
  for each row execute function private.content_posts_responsavel();

create trigger trg_content_posts_updated_at
  before update on public.content_posts
  for each row execute function private.set_updated_at();

create function private.content_posts_evento_de_criacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.content_post_events (post_id, de, para, autor_id)
  values (new.id, null, new.status, new.created_by);
  return null;
end;
$$;
revoke all on function private.content_posts_evento_de_criacao() from public, anon, authenticated;

create trigger trg_content_posts_evento_de_criacao
  after insert on public.content_posts
  for each row execute function private.content_posts_evento_de_criacao();

create function public.mover_post(
  p_post_id uuid,
  p_de      public.post_status,
  p_para    public.post_status,
  p_nota    text default null,
  p_link    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post   public.content_posts%rowtype;
  v_nota   text := nullif(btrim(p_nota), '');
  v_link   text := nullif(btrim(p_link), '');
  v_tarefa uuid;
begin
  if not public.is_staff() then
    perform private.negar('mover_post');
  end if;
  if v_nota is not null and char_length(v_nota) > 2000 then
    raise exception 'A nota pode ter até 2.000 caracteres.' using errcode = '22023';
  end if;
  if v_link is not null and p_para is distinct from 'publicado' then
    raise exception 'O link do post só entra ao marcar como publicado.' using errcode = '22023';
  end if;
  if v_link is not null and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 2000) then
    raise exception 'O link do post precisa começar com https:// e ter até 2.000 caracteres.'
      using errcode = '22023';
  end if;
  if p_para = 'ajuste_pedido' and v_nota is null then
    raise exception 'Escreva o que o cliente pediu para ajustar.' using errcode = '22023';
  end if;

  select * into v_post from public.content_posts where id = p_post_id for update;
  if not found then
    raise exception 'Post não encontrado.' using errcode = 'P0002';
  end if;
  if v_post.status is distinct from p_de then
    raise exception 'Este post mudou em outra tela. Recarregue para ver o estado atual.'
      using errcode = '22023';
  end if;
  if not private.post_transicao_valida(p_de, p_para) then
    raise exception 'Mudança de etapa não permitida para este post.' using errcode = '42501';
  end if;

  update public.content_posts
     set status        = p_para,
         status_desde  = now(),
         published_at  = case when p_para = 'publicado' then now() end,
         published_url = case when p_para = 'publicado' then v_link end
   where id = p_post_id;

  if p_para = 'ajuste_pedido' then
    insert into public.internal_tasks
      (title, description, category, task_type, assignee_id, client_id, due_date, created_by)
    values (
      left('Ajuste: ' || v_post.title, 200),
      v_nota,
      'Posicionamento · conteúdo',
      'Ajuste pedido pelo cliente',
      v_post.responsible_id,
      v_post.client_id,
      greatest(public.sp_today(), (v_post.scheduled_at at time zone 'America/Sao_Paulo')::date - 1),
      auth.uid()
    )
    returning id into v_tarefa;
  end if;

  if p_de = 'ajuste_pedido' and p_para = 'em_aprovacao' then
    update public.internal_tasks
       set col = 'done'
     where col <> 'done'
       and id in (
         select internal_task_id from public.content_post_events
          where post_id = p_post_id and internal_task_id is not null
       );
  end if;

  insert into public.content_post_events (post_id, de, para, nota, internal_task_id, autor_id)
  values (p_post_id, p_de, p_para, v_nota, v_tarefa, auth.uid());
end;
$$;
revoke all on function public.mover_post(uuid, public.post_status, public.post_status, text, text)
  from public, anon;
grant execute on function public.mover_post(uuid, public.post_status, public.post_status, text, text)
  to authenticated;
