create table public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  titulo      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

create table public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  papel            text not null check (papel in ('user','model')),
  conteudo         text not null,
  created_at       timestamptz not null default now()
);

alter table public.ai_messages enable row level security;

create index idx_ai_messages_conversation
  on public.ai_messages (conversation_id, created_at);

create index idx_ai_conversations_profile
  on public.ai_conversations (profile_id, updated_at desc);

create or replace function private.toca_conversa_da_mensagem()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  update public.ai_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end $$;

create trigger trg_ai_messages_toca_conversa
  after insert on public.ai_messages
  for each row execute function private.toca_conversa_da_mensagem();

create policy "ai_conversations: cada um so a sua"
  on public.ai_conversations for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "ai_messages: le quem e dono da conversa"
  on public.ai_messages for select
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.profile_id = auth.uid()
    )
  );

create policy "ai_messages: grava quem e dono da conversa"
  on public.ai_messages for insert
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.profile_id = auth.uid()
    )
  );

revoke all on table public.ai_conversations from anon, authenticated;
revoke all on table public.ai_messages      from anon, authenticated;

grant select, insert, update, delete on table public.ai_conversations to authenticated;
grant select, insert                 on table public.ai_messages      to authenticated;
