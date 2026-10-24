create or replace function public.definir_entrega(p_contract_id uuid, p_data date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_data is not null and p_data > public.sp_today() then
    raise exception 'data de entrega no futuro nao e entrega: %', p_data
      using errcode = '22007';
  end if;

  update public.contracts
     set delivered_at = p_data
   where id = p_contract_id
     and contract_type = 'tcv';

  if not found then
    raise exception 'contrato tcv nao encontrado: %', p_contract_id
      using errcode = 'P0002';
  end if;
end $$;

