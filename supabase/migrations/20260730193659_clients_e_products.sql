create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  segment         text,
  nicho           text,
  status          client_status not null default 'onboarding',
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  owner_id        uuid references public.profiles(id),
  opportunity_id  uuid unique references public.opportunities(id) on delete set null,
  drive_folder_id text,
  signed_at       date,
  churned_at      date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.clients enable row level security;
create index on public.clients (status);
create index on public.clients (owner_id);

create trigger trg_clients_updated
  before update on public.clients
  for each row execute function public.set_updated_at();

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  front         service_front not null,
  business_unit business_unit not null check (business_unit <> 'compartilhado'),
  contract_type contract_type not null,
  price         numeric(12,2) not null check (price >= 0),
  combo_fronts  service_front[],
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.products enable row level security;

create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

create policy "products: staff lê"
  on public.products for select using (public.is_staff());
create policy "products: só owner escreve"
  on public.products for all
  using (public.is_owner()) with check (public.is_owner());

create policy "clients: staff lê"
  on public.clients for select using (public.is_staff());
create policy "clients: owner e manager escrevem"
  on public.clients for all
  using (public.current_app_role() in ('owner','manager'))
  with check (public.current_app_role() in ('owner','manager'));

insert into public.products (name, description, front, business_unit, contract_type, price, combo_fronts, sort_order) values
  ('Frente 01 · Posicionamento', 'Oferta, mensagem e peças de comunicação.',
   'posicionamento', 'demanda', 'mrr', 1800.00, null, 1),
  ('Frente 02 · Tráfego', 'Gestão de campanhas de mídia paga.',
   'trafego', 'demanda', 'mrr', 1600.00, null, 2),
  ('Frente 03 · Comercial', 'Processo comercial e acompanhamento de vendas.',
   'comercial', 'demanda', 'mrr', 1500.00, null, 3),
  ('Combo 3 Frentes · semestral', 'As três frentes de demanda no mesmo contrato.',
   'posicionamento', 'demanda', 'mrr', 4400.00,
   array['posicionamento','trafego','comercial']::service_front[], 4),
  ('Frente 04 · Sistemas (plataforma mensal)', 'Plataforma com mensalidade.',
   'sistemas', 'sistemas', 'mrr', 1900.00, null, 5),
  ('Sistema sob medida', 'Projeto de software com escopo fechado.',
   'sistemas', 'sistemas', 'tcv', 60000.00, null, 6),
  ('Automação com IA', 'Automações sob encomenda.',
   'sistemas', 'sistemas', 'tcv', 18000.00, null, 7);

