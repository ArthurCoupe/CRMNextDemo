alter table public.opportunity_events
  add column editado_por uuid references public.profiles(id) on delete set null;

create index opportunity_events_editado_por_fk_idx
  on public.opportunity_events (editado_por);

create or replace function private.opportunity_events_correcao_da_nota()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and row(new.id, new.opportunity_id, new.actor_id, new.event_type, new.from_stage,
             new.to_stage, new.created_at, new.editado_em, new.conteudo_original,
             new.editado_por)
         is distinct from
         row(old.id, old.opportunity_id, old.actor_id, old.event_type, old.from_stage,
             old.to_stage, old.created_at, old.editado_em, old.conteudo_original,
             old.editado_por) then
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
  new.editado_por := auth.uid();
  return new;
end;
$$;
revoke all on function private.opportunity_events_correcao_da_nota() from public, anon, authenticated;

create or replace function private.content_posts_evento_de_correcao()
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
      format('Link: %s para %s. Data: %s para %s.',
        left(coalesce(old.published_url, 'sem link'), 900),
        left(coalesce(new.published_url, 'sem link'), 900),
        to_char(old.published_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
        to_char(new.published_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')),
      coalesce(auth.uid(), new.created_by)
    );
  end if;
  return null;
end;
$$;
revoke all on function private.content_posts_evento_de_correcao() from public, anon, authenticated;
