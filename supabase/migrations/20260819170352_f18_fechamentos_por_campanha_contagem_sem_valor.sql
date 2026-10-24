create view private.v_closings_by_campaign with (security_invoker = true) as
select coalesce(nullif(btrim(o.utm_campaign), ''), 'sem atribuicao') as campanha,
       coalesce(nullif(btrim(o.utm_source), ''), 'sem origem') as origem,
       coalesce(o.channel::text, 'sem_atribuicao') as canal,
       count(*) filter (where c.status <> 'cancelled') as contratos,
       count(*) filter (where c.status = 'cancelled') as cancelados
  from public.contracts c
  join public.clients cl on cl.id = c.client_id
  left join public.opportunities o on o.id = cl.opportunity_id
 group by 1, 2, 3;

create or replace function public.get_closings_by_campaign()
returns table (campanha text, origem text, canal text, contratos bigint, cancelados bigint)
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
    select v.campanha, v.origem, v.canal, v.contratos, v.cancelados
      from private.v_closings_by_campaign v
     order by v.contratos desc, v.campanha;
end $$;

revoke all on function public.get_closings_by_campaign() from public;
revoke all on function public.get_closings_by_campaign() from anon;
grant execute on function public.get_closings_by_campaign() to authenticated;
