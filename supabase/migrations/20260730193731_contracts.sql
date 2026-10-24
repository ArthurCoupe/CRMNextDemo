create table public.contracts (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  name              text not null,
  contract_type     contract_type not null,
  business_unit     business_unit not null check (business_unit <> 'compartilhado'),

  monthly_value     numeric(12,2),
  total_value       numeric(12,2),
  duration_months   int,
  billing_months    int,
  commitment_months int,

  is_firm           boolean not null default true,

  billing_active    boolean not null default true,
  billing_paused_at date,
  pause_reason      text,

  start_date        date not null,
  end_date          date,

  delivery_deadline date,
  billing_ends_at   date generated always as (
                      (start_date + make_interval(
                        months => coalesce(billing_months, duration_months)))::date
                    ) stored,
  finished_at       date,
  finished_by       uuid references public.profiles(id),
  delivered_at      date,

  payment_method    payment_method not null default 'transferencia',
  installments      int check (installments is null or installments between 1 and 12),
  is_commissionable boolean not null default true,

  status            contract_status not null default 'active',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint mrr_requires_monthly check (contract_type <> 'mrr' or monthly_value is not null),
  constraint mrr_forbids_total    check (contract_type <> 'mrr' or total_value  is null),
  constraint tcv_requires_total   check (contract_type <> 'tcv' or
                                        (total_value is not null and billing_months is not null)),
  constraint tcv_forbids_monthly  check (contract_type <> 'tcv' or monthly_value is null)
);

alter table public.contracts enable row level security;
create index on public.contracts (client_id);
create index on public.contracts (status, billing_active);
create index on public.contracts (contract_type, business_unit);

create trigger trg_contracts_updated
  before update on public.contracts
  for each row execute function public.set_updated_at();

create table public.contract_items (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  front       service_front not null,
  product_id  uuid references public.products(id),
  value       numeric(12,2) not null check (value >= 0),
  unique (contract_id, front)
);

alter table public.contract_items enable row level security;
create index on public.contract_items (contract_id);

create or replace function private.check_contract_items_sum(p_contract_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  c record;
  total numeric;
  n int;
  esperado numeric;
begin
  select contract_type, monthly_value, total_value, status
    into c
  from public.contracts where id = p_contract_id;

  if not found then return; end if;
  if c.status = 'cancelled' then return; end if;

  select coalesce(sum(value), 0), count(*) into total, n
  from public.contract_items where contract_id = p_contract_id;

  esperado := coalesce(c.monthly_value, c.total_value);

  if n = 0 then
    raise exception
      'Contrato % não tem itens. A decomposição por frente é obrigatória.', p_contract_id
      using errcode = '23514';
  end if;

  if round(total, 2) <> round(esperado, 2) then
    raise exception
      'Itens do contrato % somam R$ % mas o contrato vale R$ %.', p_contract_id, total, esperado
      using errcode = '23514';
  end if;
end $$;

create or replace function private.trg_items_sum()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform private.check_contract_items_sum(
    case when tg_op = 'DELETE' then old.contract_id else new.contract_id end);
  return null;
end $$;

create or replace function private.trg_contract_sum()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform private.check_contract_items_sum(new.id);
  return null;
end $$;

create constraint trigger trg_contract_items_soma
  after insert or update or delete on public.contract_items
  deferrable initially deferred
  for each row execute function private.trg_items_sum();

create constraint trigger trg_contracts_soma
  after insert or update of monthly_value, total_value, contract_type on public.contracts
  deferrable initially deferred
  for each row execute function private.trg_contract_sum();

create or replace function public.sync_opportunity_value()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_opp_id    uuid;
  v_total     numeric;
begin
  v_client_id := case when tg_op = 'DELETE' then old.client_id else new.client_id end;

  select opportunity_id into v_opp_id from public.clients where id = v_client_id;
  if v_opp_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select sum(case when contract_type = 'mrr' then monthly_value else total_value end)
    into v_total
  from public.contracts
  where client_id = v_client_id
    and status <> 'cancelled'
    and billing_active;

  update public.opportunities
     set closed_value = coalesce(v_total, 0)
   where id = v_opp_id;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trg_sync_opp_value
  after insert or update or delete on public.contracts
  for each row execute function public.sync_opportunity_value();

create policy "contracts: owner total"
  on public.contracts for all
  using (public.is_owner()) with check (public.is_owner());

create policy "contracts: manager lê os clientes dele"
  on public.contracts for select
  using (
    public.current_app_role() = 'manager'
    and exists (
      select 1 from public.clients cl
      where cl.id = contracts.client_id
        and cl.owner_id = auth.uid()
    )
  );

create policy "contract_items: owner total"
  on public.contract_items for all
  using (public.is_owner()) with check (public.is_owner());

create policy "contract_items: manager lê o que enxerga do contrato"
  on public.contract_items for select
  using (
    public.current_app_role() = 'manager'
    and exists (
      select 1 from public.contracts c
      join public.clients cl on cl.id = c.client_id
      where c.id = contract_items.contract_id
        and cl.owner_id = auth.uid()
    )
  );
