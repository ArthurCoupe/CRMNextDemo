drop trigger trg_validate_shares on public.contract_shares;

create or replace function private.validate_contract_shares()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  total numeric;
  v_msg text;
begin
  perform 1 from public.contracts where id = new.contract_id for update;

  select coalesce(sum(share_pct), 0) into total
  from public.contract_shares
  where contract_id = new.contract_id;

  if total > 100 then
    v_msg := format(
      'Participações deste contrato somariam %s%%. O teto é 100%% somando venda, produção e indicação.',
      total
    );
    raise exception '%', v_msg using errcode = '23514';
  end if;

  return null;
end $$;

create constraint trigger trg_validate_shares
  after insert or update on public.contract_shares
  deferrable initially deferred
  for each row execute function private.validate_contract_shares();
