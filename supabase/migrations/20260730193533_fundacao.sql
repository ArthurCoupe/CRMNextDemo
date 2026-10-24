create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant  usage on schema private to postgres, service_role;

create or replace function public.sp_today()
returns date
language sql stable
set search_path = public
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.sp_month_start(p_when timestamptz default now())
returns date
language sql stable
set search_path = public
as $$ select date_trunc('month', p_when at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create type app_role           as enum ('owner','manager','member','client');
create type business_unit      as enum ('demanda','sistemas','compartilhado');
create type service_front      as enum ('posicionamento','trafego','comercial','sistemas');
create type client_status      as enum ('onboarding','active','paused','churned');
create type contract_type      as enum ('mrr','tcv');
create type contract_status    as enum ('active','paused','cancelled','finished');
create type share_kind         as enum ('venda','producao','indicacao');
create type payment_method     as enum ('pix','credito','transferencia');
create type opportunity_stage  as enum
  ('prospeccao','abordagem','qualificacao','r1','r2','fechado','perdido','descartado');
create type acquisition_channel as enum ('indicacao','pago','inbound','outbound');

