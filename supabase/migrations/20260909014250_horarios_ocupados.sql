create or replace function public.horarios_ocupados(
  p_profiles uuid[],
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (profile_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Apenas o time pode consultar horarios ocupados.'
      using errcode = '42501';
  end if;

  if p_inicio >= p_fim then
    raise exception 'O fim precisa ser depois do inicio.'
      using errcode = '22023';
  end if;

  return query
    select distinct p.id
    from unnest(p_profiles) as p(id)
    where exists (
      select 1
      from public.meetings m
      left join public.meeting_attendees a on a.meeting_id = m.id
      where m.cancelada_em is null
        and (m.organizer_id = p.id or a.profile_id = p.id)
        and (m.starts_at, m.starts_at + make_interval(mins => m.duration_minutes))
            overlaps (p_inicio, p_fim)
    );
end $$;

revoke execute on function public.horarios_ocupados(uuid[], timestamptz, timestamptz)
  from public, anon;
grant execute on function public.horarios_ocupados(uuid[], timestamptz, timestamptz)
  to authenticated;
