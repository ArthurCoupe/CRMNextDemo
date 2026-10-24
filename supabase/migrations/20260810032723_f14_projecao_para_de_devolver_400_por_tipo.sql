create or replace function public.get_cost_projection()
returns table (
  mes date, custo_total numeric, custo_demanda numeric,
  custo_sistemas numeric, custo_compartilhado numeric, despesas bigint,
  custo_gastos numeric, custo_folha numeric, pessoas_na_folha bigint,
  folha_demanda numeric, folha_sistemas numeric, folha_compartilhado numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.mes, p.custo_total, p.custo_demanda, p.custo_sistemas,
           p.custo_compartilhado, p.despesas, p.custo_gastos, p.custo_folha,
           p.pessoas_na_folha::bigint,
           p.folha_demanda, p.folha_sistemas, p.folha_compartilhado
    from private.v_cost_projection p order by p.mes;
end $$;

