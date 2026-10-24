create or replace view private.v_net_revenue with (security_invoker = true) as
select
  c.id            as contract_id,
  c.client_id,
  cl.name         as cliente,
  c.name          as contrato,
  c.contract_type,
  c.business_unit,
  c.payment_method,
  coalesce(c.installments, 1) as parcelas,
  bruto.valor                                        as bruto,
  round(bruto.valor * fs.tax_pct / 100, 2)           as imposto,
  round(bruto.valor * taxa.pct / 100, 2)             as taxa_variavel,
  pmf.fixed_fee                                      as taxa_fixa,
  bruto.valor
    - round(bruto.valor * fs.tax_pct / 100, 2)
    - round(bruto.valor * taxa.pct / 100, 2)
    - pmf.fixed_fee                                  as liquido,
  taxa.pct                                           as taxa_variavel_pct,
  fs.tax_pct                                         as imposto_pct,
  fs.is_provisional
from public.contracts c
join public.clients cl on cl.id = c.client_id
cross join lateral (
  select round(case when c.contract_type = 'mrr' then c.monthly_value
                    else c.total_value / nullif(c.billing_months, 0) end, 2) as valor
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

