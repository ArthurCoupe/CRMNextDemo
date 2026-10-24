drop function if exists public.horarios_ocupados(uuid[], timestamptz, timestamptz);

create or replace function public.horarios_ocupados(
  p_profiles uuid[],
  p_inicio timestamptz,
  p_fim timestamptz,
  p_excluir_reuniao uuid default null
)
returns table (profile_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c_janela_maxima constant interval := interval '24 hours';
  c_perfis_maximo constant int := 20;
begin
  if not public.is_staff() then
    raise exception 'Apenas o time pode consultar horarios ocupados.'
      using errcode = '42501';
  end if;

  if p_inicio >= p_fim then
    raise exception 'O fim precisa ser depois do inicio.'
      using errcode = '22023';
  end if;

  if p_fim - p_inicio > c_janela_maxima then
    raise exception 'A janela de consulta nao pode passar de 24 horas.'
      using errcode = '22023';
  end if;

  if p_profiles is null or array_length(p_profiles, 1) is null then
    raise exception 'Informe ao menos um perfil para consultar.'
      using errcode = '22023';
  end if;

  if array_length(p_profiles, 1) > c_perfis_maximo then
    raise exception 'Consulte no maximo % perfis por vez.', c_perfis_maximo
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
        and m.id is distinct from p_excluir_reuniao
        and (m.organizer_id = p.id or a.profile_id = p.id)
        and (m.starts_at, m.starts_at + make_interval(mins => m.duration_minutes))
            overlaps (p_inicio, p_fim)
    );
end $$;

revoke execute on function public.horarios_ocupados(uuid[], timestamptz, timestamptz, uuid)
  from public, anon;
grant execute on function public.horarios_ocupados(uuid[], timestamptz, timestamptz, uuid)
  to authenticated;
