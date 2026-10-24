drop function if exists public.apply_default_shares();

create or replace function private.apply_default_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_commissionable then
    return new;
  end if;

  insert into public.contract_shares (contract_id, profile_id, kind, share_pct)
  select new.id, d.profile_id, d.kind, d.share_pct
  from public.bu_default_shares d
  where d.business_unit = new.business_unit
    and d.kind = 'producao'
    and d.active
  on conflict (contract_id, profile_id, kind) do nothing;

  return new;
end $$;

