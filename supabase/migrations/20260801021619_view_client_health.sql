create or replace view public.v_client_health
with (security_invoker = true) as
select
  c.id as client_id,

  (
    select max(e.created_at)
    from public.opportunity_events e
    where e.opportunity_id = c.opportunity_id
  ) as ultimo_evento_em,

  (
    select min(coalesce(ct.billing_ends_at, ct.end_date))
    from public.contracts ct
    where ct.client_id = c.id
      and ct.status <> 'cancelled'
      and ct.billing_active
      and coalesce(ct.billing_ends_at, ct.end_date) is not null
  ) as proximo_fim_de_cobranca,

  (
    select count(*)
    from public.contracts ct
    where ct.client_id = c.id
      and ct.status <> 'cancelled'
      and ct.billing_active
  ) as contratos_ativos
from public.clients c;

revoke all on public.v_client_health from public, anon;
grant select on public.v_client_health to authenticated;
