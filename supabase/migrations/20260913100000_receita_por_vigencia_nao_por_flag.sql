create function private.fn_contrato_vigente_em(p_contrato public.contracts, p_ref_month date)
returns boolean language sql immutable set search_path = public as $$
  select (p_contrato).status <> 'cancelled'::contract_status
     and private.fn_contrato_fatura_em(
           (p_contrato).contract_type, (p_contrato).start_date, (p_contrato).end_date,
           (p_contrato).billing_ends_at, p_ref_month)
     and ((p_contrato).billing_paused_at is null
          or (p_contrato).billing_paused_at >= (date_trunc('month', p_ref_month) + interval '1 month')::date)
$$;

create or replace view private.v_net_revenue with (security_invoker = true) as
select
  c.id            as contract_id,
  c.client_id,
  cl.name         as cliente,
  c.name          as contrato,
  c.contract_type,
  c.business_unit,
  c.payment_method,
  coalesce(c.installments, 1)                                    as parcelas,
  bruto.valor                                                    as bruto,
  round(bruto.valor * fs.tax_pct / 100::numeric, 2)              as imposto,
  round(bruto.valor * taxa.pct / 100::numeric, 2)                as taxa_variavel,
  pmf.fixed_fee                                                  as taxa_fixa,
  bruto.valor
    - round(bruto.valor * fs.tax_pct / 100::numeric, 2)
    - round(bruto.valor * taxa.pct / 100::numeric, 2)
    - pmf.fixed_fee                                              as liquido,
  taxa.pct                                                       as taxa_variavel_pct,
  fs.tax_pct                                                     as imposto_pct,
  fs.is_provisional,
  private.fn_contrato_vigente_em(c, private.fn_mes_corrente())   as fatura_no_mes
from public.contracts c
join public.clients cl on cl.id = c.client_id
cross join lateral (
  select round(case when c.contract_type = 'mrr' then c.monthly_value
                    else c.total_value / nullif(c.billing_months, 0)::numeric
               end, 2) as valor
) bruto
join public.payment_method_fees pmf on pmf.method = c.payment_method
left join public.gateway_fees gf on gf.installments = coalesce(c.installments, 1)
cross join lateral (
  select case when c.payment_method = 'credito' then coalesce(gf.fee_pct, 0::numeric)
              else pmf.variable_pct end as pct
) taxa
cross join public.fiscal_settings fs
where c.status <> 'cancelled';

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
  cs.id          as share_id,
  private.fn_contrato_vigente_em(c, private.fn_mes_corrente()) as fatura_no_mes
from public.contract_shares cs
join public.contracts c on c.id = cs.contract_id
left join public.profiles p on p.id = cs.profile_id
where c.status <> 'cancelled'::contract_status
  and c.is_commissionable;

create or replace function public.get_net_revenue()
returns table (
  contract_id uuid, client_id uuid, cliente text, contrato text,
  contract_type contract_type, bu business_unit,
  payment_method payment_method, parcelas int,
  bruto numeric, imposto numeric, taxa_variavel numeric, taxa_fixa numeric,
  liquido numeric, taxa_variavel_pct numeric, imposto_pct numeric,
  is_provisional boolean, fatura_no_mes boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select n.contract_id, n.client_id, n.cliente, n.contrato, n.contract_type,
           n.business_unit, n.payment_method, n.parcelas, n.bruto, n.imposto,
           n.taxa_variavel, n.taxa_fixa, n.liquido, n.taxa_variavel_pct,
           n.imposto_pct, n.is_provisional, n.fatura_no_mes
    from private.v_net_revenue n
    join public.contracts c on c.id = n.contract_id
    where c.billing_active
    order by n.fatura_no_mes desc, n.liquido desc;
end $$;

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
    from private.v_share_cost s
    where s.fatura_no_mes;
end $$;

create or replace view private.v_team_cost with (security_invoker = true) as
with variavel as (
  select
    s.profile_id,
    s.beneficiario,
    s.business_unit                 as bu,
    coalesce(sum(s.custo_mes), 0)   as custo_variavel,
    count(distinct s.contract_id)::bigint as contratos
  from private.v_share_cost s
  where s.fatura_no_mes
  group by s.profile_id, s.beneficiario, s.business_unit
),
atribuida as (
  select v.profile_id, v.beneficiario, v.bu, v.custo_variavel, v.contratos,
         alvo.id as payroll_id
  from variavel v
  join lateral (
    select p.id
    from public.payroll p
    where p.business_unit = v.bu
      and ((v.profile_id is not null and p.profile_id = v.profile_id)
        or (v.profile_id is null and p.profile_id is null and p.person_name = v.beneficiario))
    order by p.active desc, (p.monthly_cost + p.benefits) desc, p.id
    limit 1
  ) alvo on true
)
select
  p.id                              as payroll_id,
  p.profile_id,
  p.person_name                     as pessoa,
  p.job_title                       as cargo,
  p.work_kind                       as vinculo,
  p.business_unit                   as bu,
  p.monthly_cost                    as custo_mensal,
  p.benefits                        as beneficios,
  p.monthly_cost + p.benefits       as custo_fixo,
  coalesce(a.custo_variavel, 0)     as custo_variavel,
  coalesce(a.contratos, 0)          as contratos_com_participacao,
  p.start_date                      as inicio,
  p.end_date                        as fim,
  p.active                          as ativa,
  p.monthly_cost + p.benefits + coalesce(a.custo_variavel, 0) as custo_total,
  false                             as participacao_sem_linha,
  p.id::text                        as chave
from public.payroll p
left join atribuida a on a.payroll_id = p.id

union all

select
  null::uuid                        as payroll_id,
  v.profile_id,
  v.beneficiario                    as pessoa,
  null::text                        as cargo,
  null::work_kind                   as vinculo,
  v.bu,
  0::numeric(12,2)                  as custo_mensal,
  0::numeric(12,2)                  as beneficios,
  0::numeric                        as custo_fixo,
  coalesce(v.custo_variavel, 0)     as custo_variavel,
  v.contratos                       as contratos_com_participacao,
  null::date                        as inicio,
  null::date                        as fim,
  true                              as ativa,
  coalesce(v.custo_variavel, 0)     as custo_total,
  true                              as participacao_sem_linha,
  'participacao:' || v.bu::text || ':' || coalesce(v.profile_id::text, v.beneficiario) as chave
from variavel v
where not exists (
  select 1 from atribuida a
  where a.bu = v.bu
    and a.beneficiario = v.beneficiario
    and a.profile_id is not distinct from v.profile_id
);

create or replace function private.fn_cash_revenue_by_unit(p_ref_month date)
returns table (
  bu        business_unit,
  bruto     numeric,
  imposto   numeric,
  taxas     numeric,
  liquido   numeric,
  contratos bigint
)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(n.bruto), 0)                              as bruto,
    coalesce(sum(n.imposto), 0)                            as imposto,
    coalesce(sum(n.taxa_variavel + n.taxa_fixa), 0)        as taxas,
    coalesce(sum(n.liquido), 0)                            as liquido,
    count(n.contract_id)                                   as contratos
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join (
    select n.contract_id, n.business_unit, n.bruto, n.imposto,
           n.taxa_variavel, n.taxa_fixa, n.liquido
    from private.v_net_revenue n
    join public.contracts c on c.id = n.contract_id
    where private.fn_contrato_vigente_em(c, p_ref_month)
  ) n on n.business_unit = u.bu
  group by u.bu
$$;

create or replace function private.fn_share_cost_by_unit(p_ref_month date)
returns table (bu business_unit, custo_participacao numeric, participacoes bigint)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(s.custo_mes), 0) as custo_participacao,
    count(s.share_id)             as participacoes
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join (
    select s.share_id, s.business_unit, s.custo_mes
    from private.v_share_cost s
    join public.contracts c on c.id = s.contract_id
    where private.fn_contrato_vigente_em(c, p_ref_month)
  ) s on s.business_unit = u.bu
  group by u.bu
$$;

create or replace function private.fn_break_even(p_ref_month date)
returns table (
  custo_fixo_total     numeric,
  ticket_medio_mrr     numeric,
  ticket_medio_bruto   numeric,
  clientes_para_pagar  int,
  contratos_mrr        bigint,
  mrr_firme_total      numeric
)
language sql stable set search_path = public as $$
  with custo as (
    select coalesce(sum(c.custo_total), 0) as total
    from private.fn_cost_by_unit(p_ref_month) c
  ),
  mrr as (
    select
      coalesce(avg(n.liquido), 0)                                  as ticket_liquido,
      coalesce(avg(ct.monthly_value), 0)                           as ticket_bruto,
      count(*)                                                     as contratos,
      coalesce(sum(ct.monthly_value) filter (where ct.is_firm), 0) as firme
    from public.contracts ct
    join private.v_net_revenue n on n.contract_id = ct.id
    where ct.contract_type = 'mrr'
      and private.fn_contrato_vigente_em(ct, p_ref_month)
  )
  select
    custo.total,
    round(mrr.ticket_liquido, 2),
    round(mrr.ticket_bruto, 2),
    case when mrr.ticket_liquido <= 0 then null
         else ceil(custo.total / mrr.ticket_liquido)::int end,
    mrr.contratos,
    mrr.firme
  from custo cross join mrr
$$;

create or replace function private.fn_gravar_snapshot(p_ref_month date)
returns table (gravou boolean, mes_gravado date, resultado_do_mes numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_mes       date := date_trunc('month', p_ref_month)::date;
  v_id        uuid;
  v_resultado numeric;
  v_resto     numeric;
begin
  select coalesce((select k.custo_total from private.fn_cost_by_unit(v_mes) k
                    where k.bu = 'compartilhado'), 0)
       - coalesce((select sum(r.custo_rateado) from private.fn_result_by_unit(v_mes) r), 0)
    into v_resto;

  insert into public.monthly_snapshots (
    ref_month, mrr_demanda, mrr_sistemas, mrr_firme_total,
    tcv_demanda, tcv_sistemas, receita_caixa, receita_liquida,
    custo_total, custo_compartilhado_nao_rateado, resultado, clientes_ativos
  )
  select
    v_mes,
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.business_unit = 'demanda'), 0),
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.business_unit = 'sistemas'), 0),
    coalesce(sum(c.monthly_value) filter (
      where c.contract_type = 'mrr' and c.is_firm), 0),
    coalesce(sum(c.total_value) filter (
      where c.contract_type = 'tcv' and c.business_unit = 'demanda'
        and date_trunc('month', c.start_date)::date = v_mes), 0),
    coalesce(sum(c.total_value) filter (
      where c.contract_type = 'tcv' and c.business_unit = 'sistemas'
        and date_trunc('month', c.start_date)::date = v_mes), 0),
    (select coalesce(sum(r.receita_bruta), 0)   from private.fn_result_by_unit(v_mes) r),
    (select coalesce(sum(r.receita_liquida), 0) from private.fn_result_by_unit(v_mes) r),
    (select coalesce(sum(r.custo_direto + r.custo_rateado), 0)
       from private.fn_result_by_unit(v_mes) r) + v_resto,
    v_resto,
    (select coalesce(sum(r.resultado), 0) from private.fn_result_by_unit(v_mes) r) - v_resto,
    count(distinct c.client_id)
  from public.contracts c
  where private.fn_contrato_vigente_em(c, v_mes)
  on conflict (ref_month) do nothing
  returning monthly_snapshots.id, monthly_snapshots.resultado
  into v_id, v_resultado;

  if v_id is null then
    return query
      select false,
             v_mes,
             (select s.resultado from public.monthly_snapshots s where s.ref_month = v_mes);
    return;
  end if;

  insert into public.monthly_snapshot_units (
    snapshot_id, bu, receita_bruta, imposto, taxas, receita_liquida,
    custo_gastos, custo_folha, custo_participacao, custo_direto,
    custo_rateado, resultado, margem_pct, proporcao_pct)
  select v_id, r.bu, r.receita_bruta, r.imposto, r.taxas, r.receita_liquida,
         r.custo_gastos, r.custo_folha, r.custo_participacao, r.custo_direto,
         r.custo_rateado, r.resultado, r.margem_pct, r.proporcao_pct
  from private.fn_result_by_unit(v_mes) r;

  return query select true, v_mes, v_resultado;
end $$;

