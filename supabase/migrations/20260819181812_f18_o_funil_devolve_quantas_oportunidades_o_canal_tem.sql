drop function if exists public.get_funnel_by_channel(date);

create function public.get_funnel_by_channel(p_desde date default null)
returns table (
  canal text,
  estagio public.opportunity_stage,
  oportunidades bigint,
  oportunidades_no_canal bigint
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
    with alcance as (
      select r.canal, r.estagio, r.opportunity_id
        from private.v_funnel_reach r
       where p_desde is null
          or (r.alcancado_em at time zone 'America/Sao_Paulo')::date >= p_desde
    ),
    por_canal as (
      select a.canal, count(distinct a.opportunity_id) as total from alcance a group by a.canal
    )
    select a.canal,
           a.estagio,
           count(distinct a.opportunity_id) as oportunidades,
           c.total as oportunidades_no_canal
      from alcance a
      join por_canal c on c.canal = a.canal
     group by a.canal, a.estagio, c.total;
end $$;

revoke all on function public.get_funnel_by_channel(date) from public;
revoke all on function public.get_funnel_by_channel(date) from anon;
grant execute on function public.get_funnel_by_channel(date) to authenticated;
