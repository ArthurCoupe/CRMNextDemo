create function private.fn_despesa_encerrada_em(
  p_recurrence   expense_recurrence,
  p_start_date   date,
  p_end_date     date,
  p_installments int,
  p_ref_month    date
) returns boolean language sql immutable set search_path = public as $$
  select case
    when private.fn_meses_desde(p_start_date, p_ref_month) < 0 then false
    when p_end_date is not null
         and private.fn_meses_desde(p_end_date, p_ref_month) > 0 then true
    when p_recurrence = 'pontual'
      then private.fn_meses_desde(p_start_date, p_ref_month) > 0
    when p_recurrence = 'parcelado'
      then p_installments is not null
       and private.fn_meses_desde(p_start_date, p_ref_month) >= p_installments
    else false
  end
$$;

create or replace function private.reconcilia_parcelas()
returns table (reconciliadas int, desativadas int)
language plpgsql security definer set search_path = public as $$
declare
  v_mes date := private.fn_mes_corrente();
  v_reconciliadas int;
  v_desativadas   int;
begin
  update public.expenses e
     set installments_paid =
           private.fn_parcelas_pagas_ate(e.start_date, e.installments_total, v_mes)
   where e.recurrence = 'parcelado'
     and e.installments_total is not null
     and e.installments_paid is distinct from
           private.fn_parcelas_pagas_ate(e.start_date, e.installments_total, v_mes);
  get diagnostics v_reconciliadas = row_count;

  update public.expenses e
     set active = false
   where e.active
     and e.recurrence = 'parcelado'
     and private.fn_despesa_encerrada_em(
               e.recurrence, e.start_date, e.end_date, e.installments_total, v_mes);
  get diagnostics v_desativadas = row_count;

  return query select v_reconciliadas, v_desativadas;
end $$;

create function private.expenses_arvore_rasa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_filhos int;
begin
  if old.is_group and not new.is_group then
    select count(*) into v_filhos from public.expenses where parent_expense_id = old.id;
    if v_filhos > 0 then
      raise exception
        'Este agrupador tem % despesa(s) penduradas nele. Mova ou apague as despesas antes de deixar de ser agrupador - senao a mesma linha viraria despesa contada E pai ao mesmo tempo.', v_filhos
        using errcode = '23514';
    end if;
  end if;

  if new.parent_expense_id is not null
     and new.parent_expense_id is distinct from old.parent_expense_id then
    select count(*) into v_filhos from public.expenses where parent_expense_id = new.id;
    if v_filhos > 0 then
      raise exception
        'Esta linha tem % despesa(s) penduradas nela e por isso nao pode ser pendurada em outro agrupador: a arvore tem um nivel so.', v_filhos
        using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

create trigger trg_expenses_arvore_rasa
  before update on public.expenses
  for each row execute function private.expenses_arvore_rasa();

revoke all on function private.expenses_arvore_rasa() from public, anon, authenticated;

alter table public.expenses
  add constraint expenses_fim_e_so_de_mensal
  check (recurrence = 'mensal' or end_date is null);

create view private.v_cost_drop with (security_invoker = true) as
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
    and private.fn_despesa_corre_em(
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

create function public.get_cost_drop()
returns table (
  mes_fim date, valor_que_sai numeric, despesas bigint,
  custo_no_mes_do_fim numeric, custo_depois numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_cost_drop d order by d.mes_fim;
end $$;

revoke all on function public.get_cost_drop() from public, anon;
grant execute on function public.get_cost_drop() to authenticated;
revoke select on private.v_cost_drop from anon;
