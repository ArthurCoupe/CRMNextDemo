alter table public.opportunity_events
  add column editado_em timestamptz,
  add column conteudo_original text;

grant update (content) on table public.opportunity_events to authenticated;

create policy "opp_events: corrige a nota quem escreveu, owner e manager"
  on public.opportunity_events for update to authenticated
  using (
    public.is_staff()
    and event_type <> 'stage_change'
    and (actor_id = (select auth.uid()) or public.current_app_role() in ('owner', 'manager'))
  )
  with check (
    public.is_staff()
    and event_type <> 'stage_change'
    and (actor_id = (select auth.uid()) or public.current_app_role() in ('owner', 'manager'))
  );

create function private.opportunity_events_correcao_da_nota()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and row(new.id, new.opportunity_id, new.actor_id, new.event_type, new.from_stage,
             new.to_stage, new.created_at, new.editado_em, new.conteudo_original)
         is distinct from
         row(old.id, old.opportunity_id, old.actor_id, old.event_type, old.from_stage,
             old.to_stage, old.created_at, old.editado_em, old.conteudo_original) then
    raise exception 'Só o texto da nota se corrige.' using errcode = '42501';
  end if;

  if new.content is not distinct from old.content then
    return new;
  end if;

  if nullif(btrim(new.content), '') is null then
    raise exception 'A nota não pode ficar vazia.' using errcode = '22023';
  end if;

  if old.editado_em is null then
    new.conteudo_original := old.content;
  end if;
  new.editado_em := now();
  return new;
end;
$$;
revoke all on function private.opportunity_events_correcao_da_nota() from public, anon, authenticated;

create trigger trg_opp_events_correcao_da_nota
  before update on public.opportunity_events
  for each row execute function private.opportunity_events_correcao_da_nota();

grant update (published_url, published_at) on table public.content_posts to authenticated;

create or replace function private.content_posts_trava_conteudo()
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
  if (new.published_url, new.published_at) is distinct from (old.published_url, old.published_at)
     and new.status is not distinct from old.status then
    if old.status <> 'publicado' then
      if current_user = 'authenticated' then
        raise exception 'O link e a data da publicação só se corrigem com o post publicado.'
          using errcode = '42501';
      end if;
    elsif new.published_at is null then
      raise exception 'A data da publicação não pode ficar vazia.' using errcode = '22023';
    elsif new.published_at > now() then
      raise exception 'A data da publicação não pode ficar no futuro.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.content_posts_trava_conteudo() from public, anon, authenticated;

create function private.content_posts_evento_de_correcao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'publicado' and new.status = 'publicado'
     and (new.published_url, new.published_at) is distinct from (old.published_url, old.published_at) then
    insert into public.content_post_events (post_id, de, para, nota, autor_id)
    values (
      new.id,
      'publicado',
      'publicado',
      left(format('Link: %s para %s. Data: %s para %s.',
        coalesce(old.published_url, 'sem link'),
        coalesce(new.published_url, 'sem link'),
        to_char(old.published_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
        to_char(new.published_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')), 2000),
      coalesce(auth.uid(), new.created_by)
    );
  end if;
  return null;
end;
$$;
revoke all on function private.content_posts_evento_de_correcao() from public, anon, authenticated;

create trigger trg_content_posts_evento_de_correcao
  after update of published_url, published_at on public.content_posts
  for each row execute function private.content_posts_evento_de_correcao();

create or replace function private.meetings_nao_recancela()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.cancelada_em is not null and (
    new.cancelada_em is distinct from old.cancelada_em
    or new.cancelada_por is distinct from old.cancelada_por
    or new.motivo_do_cancelamento is distinct from old.motivo_do_cancelamento
  ) then
    if new.cancelada_em is null and new.cancelada_por is null
       and new.motivo_do_cancelamento is null then
      return new;
    end if;
    raise exception 'Esta reunião já estava cancelada. Para corrigir, desfaça o cancelamento.'
      using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.meetings_nao_recancela() from public, anon, authenticated;

create or replace function private.meetings_carimba_organizador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organizer_id is distinct from old.organizer_id then
      if auth.uid() is not null
         and not coalesce(public.current_app_role() in ('owner', 'manager'), false) then
        raise exception 'Trocar o organizador é do owner ou do manager.' using errcode = '42501';
      end if;
      if not exists (
        select 1 from public.profiles
         where id = new.organizer_id and active and role in ('owner', 'manager', 'member')
      ) then
        raise exception 'O organizador precisa ser uma pessoa ativa da equipe.' using errcode = '22023';
      end if;
    end if;
    if old.cancelada_em is null and new.cancelada_em is not null then
      new.cancelada_por := coalesce(auth.uid(), new.cancelada_por);
    end if;
    return new;
  end if;

  new.organizer_id := coalesce(auth.uid(), new.organizer_id);
  return new;
end $$;
revoke all on function private.meetings_carimba_organizador() from public, anon, authenticated;

grant update (churned_at, paused_at) on table public.clients to authenticated;

create table public.correcoes_de_data_do_cliente (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  campo         text not null check (campo in ('paused_at', 'churned_at')),
  antes         date,
  depois        date not null,
  corrigido_por uuid references public.profiles(id) on delete set null,
  corrigido_em  timestamptz not null default now()
);

create index correcoes_de_data_do_cliente_client_idx
  on public.correcoes_de_data_do_cliente (client_id, corrigido_em);
create index correcoes_de_data_do_cliente_corrigido_por_fk_idx
  on public.correcoes_de_data_do_cliente (corrigido_por);

alter table public.correcoes_de_data_do_cliente enable row level security;
alter table public.correcoes_de_data_do_cliente force row level security;

create policy "correcoes_de_data_do_cliente: staff lê" on public.correcoes_de_data_do_cliente
  for select to authenticated using (public.is_staff());

revoke all on table public.correcoes_de_data_do_cliente from anon, authenticated;
grant select on table public.correcoes_de_data_do_cliente to authenticated;

create function private.clients_data_do_status_coerente()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pausa_mudou boolean := new.paused_at is distinct from old.paused_at;
  v_saida_mudou boolean := new.churned_at is distinct from old.churned_at;
begin
  if not v_pausa_mudou and not v_saida_mudou then
    return new;
  end if;

  if current_user = 'authenticated' and not public.is_owner() then
    raise exception 'Só o owner corrige a data de pausa ou de encerramento.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Mude o status e corrija a data em dois passos.' using errcode = '23514';
  end if;

  if v_saida_mudou then
    if new.status <> 'churned' then
      raise exception 'A data de encerramento só se corrige com o cliente encerrado.' using errcode = '23514';
    elsif new.churned_at is null then
      raise exception 'A data de encerramento não pode ficar vazia.' using errcode = '22023';
    elsif new.churned_at > public.sp_today() then
      raise exception 'A data de encerramento não pode ficar no futuro.' using errcode = '22023';
    end if;
  end if;

  if v_pausa_mudou then
    if new.status <> 'paused' then
      raise exception 'A data de pausa só se corrige com o cliente pausado.' using errcode = '23514';
    elsif new.paused_at is null then
      raise exception 'A data de pausa não pode ficar vazia.' using errcode = '22023';
    elsif new.paused_at > public.sp_today() then
      raise exception 'A data de pausa não pode ficar no futuro.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.clients_data_do_status_coerente() from public, anon, authenticated;

create trigger trg_clients_a_data_do_status
  before update of churned_at, paused_at on public.clients
  for each row execute function private.clients_data_do_status_coerente();

create function private.clients_rastro_da_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    return null;
  end if;
  if new.paused_at is distinct from old.paused_at then
    insert into public.correcoes_de_data_do_cliente (client_id, campo, antes, depois, corrigido_por)
    values (new.id, 'paused_at', old.paused_at, new.paused_at, auth.uid());
  end if;
  if new.churned_at is distinct from old.churned_at then
    insert into public.correcoes_de_data_do_cliente (client_id, campo, antes, depois, corrigido_por)
    values (new.id, 'churned_at', old.churned_at, new.churned_at, auth.uid());
  end if;
  return null;
end;
$$;
revoke all on function private.clients_rastro_da_data() from public, anon, authenticated;

create trigger trg_clients_rastro_da_data
  after update of churned_at, paused_at on public.clients
  for each row execute function private.clients_rastro_da_data();

