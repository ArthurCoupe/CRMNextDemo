create function private.fn_meses_desde(p_start date, p_ref_month date)
returns int language sql immutable as $$
  select ((extract(year  from p_ref_month) - extract(year  from p_start)) * 12
        + (extract(month from p_ref_month) - extract(month from p_start)))::int
$$;

create function private.fn_mes_corrente()
returns date language sql stable as $$
  select date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date
$$;

create function private.fn_despesa_corre_em(
  p_recurrence   expense_recurrence,
  p_start_date   date,
  p_end_date     date,
  p_installments int,
  p_ref_month    date
) returns boolean language sql immutable as $$
  select case
    when private.fn_meses_desde(p_start_date, p_ref_month) < 0 then false
    when p_end_date is not null
         and private.fn_meses_desde(p_end_date, p_ref_month) > 0 then false
    when p_recurrence = 'pontual'
      then private.fn_meses_desde(p_start_date, p_ref_month) = 0
    when p_recurrence = 'parcelado'
      then p_installments is not null
       and private.fn_meses_desde(p_start_date, p_ref_month) < p_installments
    else true
  end
$$;

create function private.fn_parcelas_pagas_ate(p_start date, p_total int, p_ref_month date)
returns int language sql immutable as $$
  select case when p_total is null then null
              else least(p_total, greatest(0, private.fn_meses_desde(p_start, p_ref_month) + 1))
         end
$$;

create function private.fn_ultima_parcela_em(p_start date, p_total int)
returns date language sql immutable as $$
  select case when p_total is null then null
              else (date_trunc('month', p_start) + make_interval(months => p_total - 1))::date
         end
$$;

create view private.v_expenses_effective with (security_invoker = true) as
select
  e.id                as expense_id,
  e.description       as descricao,
  e.amount            as valor,
  e.category          as categoria,
  e.business_unit     as bu,
  e.recurrence        as recorrencia,
  e.vendor            as fornecedor,
  e.payment_method    as meio_de_pagamento,
  e.parent_expense_id as agrupador_id,
  pai.description     as agrupador,
  e.installments_total                                                    as parcelas_total,
  private.fn_parcelas_pagas_ate(e.start_date, e.installments_total, ref.mes) as parcelas_pagas,
  case when e.recurrence = 'parcelado'
       then e.installments_total
          - private.fn_parcelas_pagas_ate(e.start_date, e.installments_total, ref.mes)
  end                                                                     as parcelas_restantes,
  private.fn_ultima_parcela_em(e.start_date, e.installments_total)        as ultima_parcela_em,
  e.start_date        as inicio,
  e.end_date          as fim,
  ref.mes             as mes_referencia
from public.expenses e
left join public.expenses pai on pai.id = e.parent_expense_id
cross join lateral (select private.fn_mes_corrente() as mes) ref
where e.active
  and not e.is_group
  and private.fn_despesa_corre_em(
        e.recurrence, e.start_date, e.end_date, e.installments_total, ref.mes);

create view private.v_cost_projection with (security_invoker = true) as
select
  m.mes,
  coalesce(sum(e.amount), 0)                                                  as custo_total,
  coalesce(sum(e.amount) filter (where e.business_unit = 'demanda'), 0)       as custo_demanda,
  coalesce(sum(e.amount) filter (where e.business_unit = 'sistemas'), 0)      as custo_sistemas,
  coalesce(sum(e.amount) filter (where e.business_unit = 'compartilhado'), 0) as custo_compartilhado,
  count(e.id)                                                                 as despesas
from (
  select (private.fn_mes_corrente() + make_interval(months => g))::date as mes
  from generate_series(0, 11) g
) m
left join public.expenses e
       on e.active
      and not e.is_group
      and private.fn_despesa_corre_em(
            e.recurrence, e.start_date, e.end_date, e.installments_total, m.mes)
group by m.mes;

create function public.get_expenses_effective()
returns table (
  expense_id uuid, descricao text, valor numeric, categoria expense_category,
  bu business_unit, recorrencia expense_recurrence, fornecedor text,
  meio_de_pagamento text, agrupador_id uuid, agrupador text,
  parcelas_total int, parcelas_pagas int, parcelas_restantes int,
  ultima_parcela_em date, inicio date, fim date, mes_referencia date
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_expenses_effective;
end $$;

create function public.get_cost_projection()
returns table (
  mes date, custo_total numeric, custo_demanda numeric,
  custo_sistemas numeric, custo_compartilhado numeric, despesas bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_cost_projection;
end $$;

revoke all on function public.get_expenses_effective() from public, anon;
revoke all on function public.get_cost_projection()   from public, anon;
grant execute on function public.get_expenses_effective() to authenticated;
grant execute on function public.get_cost_projection()   to authenticated;

revoke select on private.v_expenses_effective from anon;
revoke select on private.v_cost_projection    from anon;
