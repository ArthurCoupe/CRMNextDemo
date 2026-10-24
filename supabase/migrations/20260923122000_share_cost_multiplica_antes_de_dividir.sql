create or replace view private.v_share_cost with (security_invoker = true) as
select
  c.id           as contract_id,
  c.client_id,
  c.business_unit,
  cs.kind,
  coalesce(p.full_name, cs.external_name) as beneficiario,
  cs.share_pct,
  round(
    case c.contract_type
      when 'mrr'::contract_type then c.monthly_value * cs.share_pct / 100::numeric
      when 'tcv'::contract_type then c.total_value * cs.share_pct / (100::numeric * nullif(c.billing_months, 0)::numeric)
      else null::numeric
    end,
    2
  )                                        as custo_mes,
  cs.profile_id,
  cs.id          as share_id,
  private.fn_contrato_vigente_em(c, private.fn_mes_corrente()) as fatura_no_mes
from public.contract_shares cs
join public.contracts c on c.id = cs.contract_id
left join public.profiles p on p.id = cs.profile_id
where c.status <> 'cancelled'::contract_status
  and c.is_commissionable;

