create view private.v_mrr_by_unit with (security_invoker = true) as
select c.business_unit,
       sum(c.monthly_value)                          as mrr_total,
       sum(c.monthly_value) filter (where c.is_firm) as mrr_firme,
       count(*)                                      as contratos
from public.contracts c
where c.contract_type = 'mrr'
  and c.status <> 'cancelled'
  and c.billing_active
group by c.business_unit;

create view private.v_tcv_by_unit with (security_invoker = true) as
select c.business_unit,
       sum(c.total_value) as tcv_total,
       count(*)           as projetos
from public.contracts c
where c.contract_type = 'tcv'
  and c.status <> 'cancelled'
  and c.billing_active
group by c.business_unit;

create view private.v_revenue_by_front with (security_invoker = true) as
select ci.front,
       c.business_unit,
       coalesce(sum(ci.value) filter (where c.contract_type = 'mrr'), 0) as mrr_mensal,
       coalesce(sum(ci.value) filter (where c.contract_type = 'tcv'), 0) as tcv_total,
       coalesce(sum(
         case when c.contract_type = 'mrr' then ci.value
              else ci.value / nullif(c.billing_months, 0) end
       ), 0) as caixa_mes
from public.contract_items ci
join public.contracts c on c.id = ci.contract_id
where c.status <> 'cancelled'
  and c.billing_active
group by ci.front, c.business_unit;

create view private.v_share_cost with (security_invoker = true) as
select c.id                                   as contract_id,
       c.client_id,
       c.business_unit,
       cs.kind,
       coalesce(p.full_name, cs.external_name) as beneficiario,
       cs.share_pct,
       case c.contract_type
         when 'mrr' then c.monthly_value
         when 'tcv' then c.total_value / nullif(c.billing_months, 0)
       end * cs.share_pct / 100                as custo_mes
from public.contract_shares cs
join public.contracts c        on c.id = cs.contract_id
left join public.profiles p    on p.id = cs.profile_id
where c.status <> 'cancelled'
  and c.billing_active
  and c.is_commissionable;

create view private.v_delayed_projects with (security_invoker = true) as
select c.id,
       cl.name                                          as cliente,
       c.name                                           as projeto,
       c.delivery_deadline,
       public.sp_today() - c.delivery_deadline          as dias_atraso,
       c.total_value,
       c.total_value / nullif(c.billing_months, 0)      as parcela_mensal,
       greatest(0, ceil((public.sp_today() - c.delivery_deadline) / 30.0))::int as meses_extra
from public.contracts c
join public.clients cl on cl.id = c.client_id
where c.contract_type = 'tcv'
  and c.status <> 'cancelled'
  and c.delivered_at is null
  and c.delivery_deadline is not null
  and c.delivery_deadline < public.sp_today();

create or replace function public.get_mrr_by_unit()
returns table (bu business_unit, mrr_total numeric, mrr_firme numeric, contratos bigint)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_mrr_by_unit;
end $$;

create or replace function public.get_tcv_by_unit()
returns table (bu business_unit, tcv_total numeric, projetos bigint)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_tcv_by_unit;
end $$;

create or replace function public.get_revenue_by_front()
returns table (front service_front, bu business_unit,
               mrr_mensal numeric, tcv_total numeric, caixa_mes numeric)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_revenue_by_front;
end $$;

create or replace function public.get_share_cost()
returns table (contract_id uuid, client_id uuid, bu business_unit, kind share_kind,
               beneficiario text, share_pct numeric, custo_mes numeric)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_share_cost;
end $$;

create or replace function public.get_delayed_projects()
returns table (id uuid, cliente text, projeto text, delivery_deadline date,
               dias_atraso int, total_value numeric, parcela_mensal numeric, meses_extra int)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_delayed_projects;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.get_mrr_by_unit()', 'public.get_tcv_by_unit()',
    'public.get_revenue_by_front()', 'public.get_share_cost()',
    'public.get_delayed_projects()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
