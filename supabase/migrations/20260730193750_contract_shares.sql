create table public.contract_shares (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.contracts(id) on delete cascade,
  profile_id    uuid references public.profiles(id),
  external_name text,
  kind          share_kind not null,
  share_pct     numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  created_at    timestamptz not null default now(),
  unique (contract_id, profile_id, kind),
  check (profile_id is not null or external_name is not null)
);

alter table public.contract_shares enable row level security;
create index on public.contract_shares (contract_id);

create or replace function public.validate_contract_shares()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  total numeric;
begin
  perform 1 from public.contracts where id = new.contract_id for update;

  select coalesce(sum(share_pct), 0) into total
  from public.contract_shares
  where contract_id = new.contract_id
    and id is distinct from new.id;

  if total + new.share_pct > 100 then
    raise exception
      'Participações deste contrato somariam %%%. O teto é 100%% somando venda, produção e indicação.',
      total + new.share_pct
      using errcode = '23514';
  end if;

  return new;
end $$;

create trigger trg_validate_shares
  before insert or update on public.contract_shares
  for each row execute function public.validate_contract_shares();

create table public.bu_default_shares (
  id            uuid primary key default gen_random_uuid(),
  business_unit business_unit not null check (business_unit <> 'compartilhado'),
  profile_id    uuid not null references public.profiles(id),
  kind          share_kind not null default 'producao',
  share_pct     numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  active        boolean not null default true,
  unique (business_unit, profile_id, kind)
);

alter table public.bu_default_shares enable row level security;

create or replace function public.apply_default_shares()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.contract_shares (contract_id, profile_id, kind, share_pct)
  select new.id, d.profile_id, d.kind, d.share_pct
  from public.bu_default_shares d
  where d.business_unit = new.business_unit
    and d.kind = 'producao'
    and d.active
  on conflict (contract_id, profile_id, kind) do nothing;
  return new;
end $$;

create trigger trg_apply_default_shares
  after insert on public.contracts
  for each row execute function public.apply_default_shares();

create policy "shares: só owner"
  on public.contract_shares for all
  using (public.is_owner()) with check (public.is_owner());

create policy "bu_shares: só owner"
  on public.bu_default_shares for all
  using (public.is_owner()) with check (public.is_owner());

