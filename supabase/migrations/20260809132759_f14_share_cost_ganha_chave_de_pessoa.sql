create or replace view private.v_share_cost with (security_invoker = true) as
select
  c.id           as contract_id,
  c.client_id,
  c.business_unit,
  cs.kind,
  coalesce(p.full_name, cs.external_name) as beneficiario,
  cs.share_pct,
  case c.contract_type
    when 'mrr'::contract_type then c.monthly_value
    when 'tcv'::contract_type then c.total_value / nullif(c.billing_months, 0)::numeric
    else null::numeric
  end * cs.share_pct / 100::numeric        as custo_mes,
  cs.profile_id,
  cs.id          as share_id
from public.contract_shares cs
join public.contracts c on c.id = cs.contract_id
left join public.profiles p on p.id = cs.profile_id
where c.status <> 'cancelled'::contract_status
  and c.billing_active
  and c.is_commissionable;

create or replace function public.get_share_cost()
returns table (
  contract_id uuid, client_id uuid, bu business_unit, kind share_kind,
  beneficiario text, share_pct numeric, custo_mes numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.contract_id, s.client_id, s.business_unit, s.kind,
           s.beneficiario, s.share_pct, s.custo_mes
    from private.v_share_cost s;
end $$;

revoke all on function public.get_share_cost() from public, anon;
grant execute on function public.get_share_cost() to authenticated;
revoke select on private.v_share_cost from anon;
