create or replace function private.fn_folha_do_mes(p_ref_month date)
returns table (
  payroll_id     uuid,
  chave_da_pessoa text,
  bu             business_unit,
  custo_fixo     numeric
)
language sql stable set search_path = public as $$
  select
    p.id,
    coalesce(p.profile_id::text, 'linha:' || p.id::text),
    p.business_unit,
    p.monthly_cost + p.benefits
  from public.payroll p
  where private.fn_pessoa_na_folha_em(p.start_date, p.end_date, p_ref_month)
    and not exists (
      select 1
      from public.payroll_saidas s
      where s.payroll_id = p.id
        and date_trunc('month', s.saiu_em at time zone 'America/Sao_Paulo')::date <= p_ref_month
        and (
          s.voltou_em is null
          or p_ref_month < date_trunc('month', s.voltou_em at time zone 'America/Sao_Paulo')::date
        )
    )
$$;

