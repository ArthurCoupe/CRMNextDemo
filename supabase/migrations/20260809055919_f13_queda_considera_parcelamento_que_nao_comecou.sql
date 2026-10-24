create or replace view private.v_cost_drop with (security_invoker = true) as
with fins as (
  select
    private.fn_ultima_parcela_em(e.start_date, e.installments_total) as mes_fim,
    sum(e.amount)  as valor_que_sai,
    count(*)       as despesas
  from public.expenses e
  cross join lateral (select private.fn_mes_corrente() as mes) ref
  where e.active
    and not e.is_group
    and e.recurrence = 'parcelado'
    and not private.fn_despesa_encerrada_em(
              e.recurrence, e.start_date, e.end_date, e.installments_total, ref.mes)
  group by 1
)
select
  f.mes_fim,
  f.valor_que_sai,
  f.despesas,
  atual.custo_total     as custo_no_mes_do_fim,
  seguinte.custo_total  as custo_depois
from fins f
left join private.v_cost_projection atual    on atual.mes    = f.mes_fim
left join private.v_cost_projection seguinte on seguinte.mes = (f.mes_fim + interval '1 month')::date;

