create function private.fn_share_cost_by_unit(p_ref_month date)
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
    where private.fn_contrato_fatura_em(
            c.contract_type, c.start_date, c.end_date, c.billing_ends_at, p_ref_month)
  ) s on s.business_unit = u.bu
  group by u.bu
$$;

create function private.fn_result_by_unit(p_ref_month date)
returns table (
  bu                  business_unit,
  receita_bruta       numeric,
  imposto             numeric,
  taxas               numeric,
  receita_liquida     numeric,
  custo_gastos        numeric,
  custo_folha         numeric,
  custo_participacao  numeric,
  custo_direto        numeric,
  custo_rateado       numeric,
  resultado           numeric,
  margem_pct          numeric,
  proporcao_pct       numeric
)
language sql stable set search_path = public as $$
  with receita as (select * from private.fn_cash_revenue_by_unit(p_ref_month)),
       custo    as (select * from private.fn_cost_by_unit(p_ref_month)),
       part     as (select * from private.fn_share_cost_by_unit(p_ref_month)),
       compartilhado as (
         select coalesce(sum(c.custo_total), 0) as total
         from custo c where c.bu = 'compartilhado'
       ),
       caixa_total as (
         select coalesce(sum(r.bruto), 0) as total
         from receita r where r.bu <> 'compartilhado'
       )
  select
    r.bu,
    r.bruto,
    r.imposto,
    r.taxas,
    r.liquido,
    c.custo_gastos,
    c.custo_folha,
    p.custo_participacao,
    c.custo_total + p.custo_participacao                       as custo_direto,
    case
      when ct.total = 0 then 0
      else round(comp.total * r.bruto / ct.total, 2)
    end                                                        as custo_rateado,
    r.liquido - (c.custo_total + p.custo_participacao) - case
      when ct.total = 0 then 0
      else round(comp.total * r.bruto / ct.total, 2)
    end                                                        as resultado,
    case
      when r.liquido = 0 then null
      else round(
        100 * (r.liquido - (c.custo_total + p.custo_participacao) - case
          when ct.total = 0 then 0
          else round(comp.total * r.bruto / ct.total, 2)
        end) / r.liquido, 1)
    end                                                        as margem_pct,
    case when ct.total = 0 then null else round(100 * r.bruto / ct.total, 1) end as proporcao_pct
  from receita r
  join custo c on c.bu = r.bu
  join part  p on p.bu = r.bu
  cross join compartilhado comp
  cross join caixa_total ct
  where r.bu <> 'compartilhado'
$$;

create function public.get_result_by_unit(p_ref_month date)
returns table (
  bu business_unit, receita_bruta numeric, imposto numeric, taxas numeric,
  receita_liquida numeric, custo_gastos numeric, custo_folha numeric,
  custo_participacao numeric, custo_direto numeric, custo_rateado numeric,
  resultado numeric, margem_pct numeric, proporcao_pct numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.bu, r.receita_bruta, r.imposto, r.taxas, r.receita_liquida,
           r.custo_gastos, r.custo_folha, r.custo_participacao, r.custo_direto,
           r.custo_rateado, r.resultado, r.margem_pct, r.proporcao_pct
    from private.fn_result_by_unit(date_trunc('month', p_ref_month)::date) r
    order by r.bu;
end $$;

revoke all on function public.get_result_by_unit(date) from public, anon;
grant execute on function public.get_result_by_unit(date) to authenticated;
