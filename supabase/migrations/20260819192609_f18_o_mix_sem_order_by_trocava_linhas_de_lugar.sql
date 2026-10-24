create or replace function public.get_opportunity_mix()
returns table (
  nicho text,
  tier text,
  canal text,
  oportunidades bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select m.nicho, m.tier, m.canal, m.oportunidades
      from private.v_opportunity_mix m
     order by m.oportunidades desc, m.nicho, m.tier, m.canal;
end $$;

revoke all on function public.get_opportunity_mix() from public;
revoke all on function public.get_opportunity_mix() from anon;
grant execute on function public.get_opportunity_mix() to authenticated;
