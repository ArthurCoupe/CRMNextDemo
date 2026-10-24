create or replace function private.contracts_venda_de_origem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome  text;
  v_stage public.opportunity_stage;
begin
  if tg_op = 'UPDATE' and new.opportunity_id is distinct from old.opportunity_id then
    select o.name into v_nome
      from public.proposal_items pi
      join public.proposals p on p.id = pi.proposal_id
      join public.opportunities o on o.id = p.opportunity_id
     where pi.contract_id = new.id
       and p.opportunity_id is distinct from new.opportunity_id
     limit 1;
    if found then
      raise exception 'Este contrato veio de uma proposta da venda "%" e não pode sair dela. Para refazer, use "Desfazer fechamento" na ficha da oportunidade.',
        v_nome using errcode = '23514';
    end if;
  end if;

  if new.opportunity_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.opportunity_id is not distinct from old.opportunity_id
     and new.client_id is not distinct from old.client_id then
    return new;
  end if;

  select o.name, o.stage into v_nome, v_stage
    from public.opportunities o
   where o.id = new.opportunity_id
     for update;

  if not found then
    raise exception 'Venda de origem não encontrada. Recarregue a página.' using errcode = 'P0002';
  end if;

  if v_stage <> 'fechado' then
    raise exception 'A venda "%" não está em Fechado. Marque como ganha no Pipeline antes de ligar o contrato a ela.',
      v_nome using errcode = '23514';
  end if;

  if exists (
    select 1 from public.contracts ct
     where ct.opportunity_id = new.opportunity_id
       and ct.client_id <> new.client_id
       and ct.id <> new.id
  ) then
    raise exception 'A venda "%" já tem contrato de outro cliente. Todos os contratos de uma venda são do mesmo cliente.',
      v_nome using errcode = '23514';
  end if;

  return new;
end $$;

revoke all on function private.contracts_venda_de_origem() from public, anon, authenticated;
