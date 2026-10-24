create or replace view private.v_expenses_effective with (security_invoker = true) as
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
  e.installments_total                                                      as parcelas_total,
  private.fn_parcelas_pagas_ate(e.start_date, e.installments_total, ref.mes) as parcelas_pagas,
  case when e.recurrence = 'parcelado'
       then e.installments_total
          - private.fn_parcelas_pagas_ate(e.start_date, e.installments_total, ref.mes)
  end                                                                       as parcelas_restantes,
  private.fn_ultima_parcela_em(e.start_date, e.installments_total)          as ultima_parcela_em,
  e.start_date        as inicio,
  e.end_date          as fim,
  ref.mes             as mes_referencia,
  case when e.parent_expense_id is null then null
       else sum(e.amount) over (partition by e.parent_expense_id)
  end                 as total_do_agrupador
from public.expenses e
left join public.expenses pai on pai.id = e.parent_expense_id
cross join lateral (select private.fn_mes_corrente() as mes) ref
where e.active
  and not e.is_group
  and private.fn_despesa_corre_em(
        e.recurrence, e.start_date, e.end_date, e.installments_total, ref.mes);

drop function if exists public.get_expenses_effective();

create function public.get_expenses_effective()
returns table (
  expense_id uuid, descricao text, valor numeric, categoria expense_category,
  bu business_unit, recorrencia expense_recurrence, fornecedor text,
  meio_de_pagamento text, agrupador_id uuid, agrupador text,
  parcelas_total int, parcelas_pagas int, parcelas_restantes int,
  ultima_parcela_em date, inicio date, fim date, mes_referencia date,
  total_do_agrupador numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_expenses_effective e
                order by e.valor desc, e.descricao;
end $$;

revoke all on function public.get_expenses_effective() from public, anon;
grant execute on function public.get_expenses_effective() to authenticated;
revoke select on private.v_expenses_effective from anon;
