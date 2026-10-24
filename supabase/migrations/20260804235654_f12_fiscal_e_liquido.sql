create table public.fiscal_settings (
  id             boolean primary key default true check (id),
  tax_pct        numeric(5,2) not null check (tax_pct >= 0 and tax_pct <= 100),
  source         text,
  is_provisional boolean not null default true,
  updated_at     timestamptz not null default now()
);
alter table public.fiscal_settings enable row level security;

create function private.fiscal_settings_nao_apaga()
returns trigger language plpgsql as $$
begin
  raise exception
    'fiscal_settings tem linha unica e ela nao pode ser apagada: v_net_revenue faz cross join com ela, e sem a linha a receita liquida some da tela sem sintoma. Para mudar a aliquota, use UPDATE.'
    using errcode = '23514';
end $$;

create trigger trg_fiscal_settings_nao_apaga
  before delete on public.fiscal_settings
  for each row execute function private.fiscal_settings_nao_apaga();

revoke all on function private.fiscal_settings_nao_apaga() from public, anon, authenticated;

create table public.gateway_fees (
  installments int primary key check (installments between 1 and 12),
  fee_pct      numeric(5,2) not null check (fee_pct >= 0 and fee_pct <= 100)
);
alter table public.gateway_fees enable row level security;

create table public.payment_method_fees (
  method       payment_method primary key,
  fixed_fee    numeric(12,2) not null default 0 check (fixed_fee >= 0),
  variable_pct numeric(5,2)  not null default 0 check (variable_pct >= 0 and variable_pct <= 100),
  installable  boolean not null default false,
  settlement   text
);
alter table public.payment_method_fees enable row level security;

create policy "fiscal_settings: staff le"
  on public.fiscal_settings for select using (public.is_staff());
create policy "fiscal_settings: so owner escreve"
  on public.fiscal_settings for all
  using (public.is_owner()) with check (public.is_owner());

create policy "gateway_fees: staff le"
  on public.gateway_fees for select using (public.is_staff());
create policy "gateway_fees: so owner escreve"
  on public.gateway_fees for all
  using (public.is_owner()) with check (public.is_owner());

create policy "payment_method_fees: staff le"
  on public.payment_method_fees for select using (public.is_staff());
create policy "payment_method_fees: so owner escreve"
  on public.payment_method_fees for all
  using (public.is_owner()) with check (public.is_owner());

insert into public.fiscal_settings (id, tax_pct, source, is_provisional)
values (true, 6.00, 'Simples Nacional (valor de exemplo)', false)
on conflict (id) do nothing;

insert into public.gateway_fees (installments, fee_pct) values
  (1, 3.30), (2, 4.10), (3, 4.90), (4, 5.70), (5, 6.50), (6, 7.30),
  (7, 8.10), (8, 8.90), (9, 9.70), (10, 10.50), (11, 11.30), (12, 12.10)
on conflict (installments) do nothing;

insert into public.payment_method_fees (method, fixed_fee, variable_pct, installable, settlement) values
  ('pix',           1.00, 0.99, false, 'D+0'),
  ('credito',       2.00, 0.00, true,  'D+1'),
  ('transferencia', 0.00, 0.00, false, 'D+0')
on conflict (method) do nothing;

create view private.v_net_revenue with (security_invoker = true) as
select
  c.id            as contract_id,
  c.client_id,
  cl.name         as cliente,
  c.name          as contrato,
  c.contract_type,
  c.business_unit,
  c.payment_method,
  coalesce(c.installments, 1) as parcelas,
  round(bruto.valor, 2)                                          as bruto,
  round(bruto.valor * fs.tax_pct / 100, 2)                       as imposto,
  round(bruto.valor * taxa.pct / 100, 2)                         as taxa_variavel,
  pmf.fixed_fee                                                  as taxa_fixa,
  round(bruto.valor, 2)
    - round(bruto.valor * fs.tax_pct / 100, 2)
    - round(bruto.valor * taxa.pct / 100, 2)
    - pmf.fixed_fee                                              as liquido,
  taxa.pct                                                       as taxa_variavel_pct,
  fs.tax_pct                                                     as imposto_pct,
  fs.is_provisional
from public.contracts c
join public.clients cl on cl.id = c.client_id
cross join lateral (
  select case when c.contract_type = 'mrr' then c.monthly_value
              else c.total_value / nullif(c.billing_months, 0) end as valor
) bruto
join public.payment_method_fees pmf on pmf.method = c.payment_method
left join public.gateway_fees gf on gf.installments = coalesce(c.installments, 1)
cross join lateral (
  select case when c.payment_method = 'credito' then coalesce(gf.fee_pct, 0)
              else pmf.variable_pct end as pct
) taxa
cross join public.fiscal_settings fs
where c.status <> 'cancelled'
  and c.billing_active;

create or replace function public.get_net_revenue()
returns table (
  contract_id uuid, client_id uuid, cliente text, contrato text,
  contract_type contract_type, bu business_unit, payment_method payment_method,
  parcelas int, bruto numeric, imposto numeric, taxa_variavel numeric,
  taxa_fixa numeric, liquido numeric, taxa_variavel_pct numeric,
  imposto_pct numeric, is_provisional boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_net_revenue;
end $$;

revoke all on function public.get_net_revenue() from public, anon;
grant execute on function public.get_net_revenue() to authenticated;
