create or replace view public.v_client_health
with (security_invoker = true) as
select
  c.id as client_id,
  greatest(
    (select max(e.created_at)
       from public.opportunity_events e
      where e.opportunity_id = c.opportunity_id),
    (select max(m.starts_at)
       from public.meetings m
      where m.client_id = c.id
        and m.cancelada_em is null
        and m.starts_at <= now())
  ) as ultimo_evento_em,
  (select min(coalesce(ct.billing_ends_at, ct.end_date))
     from public.contracts ct
    where ct.client_id = c.id
      and ct.status <> 'cancelled'
      and ct.billing_active
      and coalesce(ct.billing_ends_at, ct.end_date) is not null) as proximo_fim_de_cobranca,
  (select count(*)
     from public.contracts ct
    where ct.client_id = c.id
      and ct.status <> 'cancelled'
      and ct.billing_active) as contratos_ativos
from public.clients c;

create or replace view private.v_funnel_reach
with (security_invoker = true) as
with entrada as (
  select
    o.id as opportunity_id,
    coalesce(
      (select e.from_stage
         from public.opportunity_events e
        where e.opportunity_id = o.id
          and e.event_type = 'stage_change'
          and e.from_stage is not null
        order by e.created_at, e.id
        limit 1),
      o.stage
    ) as estagio,
    o.created_at as alcancado_em
  from public.opportunities o
),
movimentos as (
  select
    e.opportunity_id,
    e.to_stage as estagio,
    e.created_at as alcancado_em
  from public.opportunity_events e
  where e.event_type = 'stage_change'
    and e.to_stage is not null
    and not (
      e.to_stage = 'fechado'
      and exists (
        select 1
          from public.fechamentos_desfeitos fd
         where fd.opportunity_id = e.opportunity_id
           and fd.desfeito_em > e.created_at
      )
    )
),
tudo as (
  select opportunity_id, estagio, alcancado_em from entrada
  union all
  select opportunity_id, estagio, alcancado_em from movimentos
)
select
  t.opportunity_id,
  coalesce(o.channel::text, 'sem_atribuicao') as canal,
  t.estagio,
  min(t.alcancado_em) as alcancado_em
from tudo t
join public.opportunities o on o.id = t.opportunity_id
where t.estagio is not null
  and o.stage <> 'descartado'
group by t.opportunity_id, o.channel, t.estagio;

