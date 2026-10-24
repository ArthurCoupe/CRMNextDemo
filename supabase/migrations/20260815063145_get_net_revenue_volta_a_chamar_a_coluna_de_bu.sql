drop function if exists public.get_net_revenue();

create function public.get_net_revenue()
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
    order by n.fatura_no_mes desc, n.liquido desc;
end $$;

revoke all on function public.get_net_revenue() from public, anon;
grant execute on function public.get_net_revenue() to authenticated;
