alter table public.opportunities add column closed_mrr numeric(12,2);
alter table public.opportunities add column closed_tcv numeric(12,2);



create or replace function private.sync_opportunity_value()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_opp_id    uuid;
  v_mrr       numeric;
  v_tcv       numeric;
begin
  v_client_id := case when tg_op = 'DELETE' then old.client_id else new.client_id end;

  select opportunity_id into v_opp_id from public.clients where id = v_client_id;
  if v_opp_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select coalesce(sum(monthly_value) filter (where contract_type = 'mrr'), 0),
         coalesce(sum(total_value)   filter (where contract_type = 'tcv'), 0)
    into v_mrr, v_tcv
  from public.contracts
  where client_id = v_client_id
    and status <> 'cancelled'
    and billing_active;

  update public.opportunities
     set closed_mrr = v_mrr,
         closed_tcv = v_tcv
   where id = v_opp_id;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

alter table public.opportunities drop column closed_value;
