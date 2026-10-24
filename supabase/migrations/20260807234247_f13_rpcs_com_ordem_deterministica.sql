create or replace function public.get_cost_projection()
returns table (
  mes date, custo_total numeric, custo_demanda numeric,
  custo_sistemas numeric, custo_compartilhado numeric, despesas bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.v_cost_projection p order by p.mes;
end $$;

create or replace function public.get_expenses_effective()
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
  return query select * from private.v_expenses_effective e
                order by e.valor desc, e.descricao;
end $$;
