create extension if not exists unaccent with schema extensions;

create function public.buscar_secoes_playbook(p_termo text)
returns table (
  id         uuid,
  area       public.playbook_area,
  title      text,
  content    text,
  sort_order int,
  updated_at timestamptz
)
language sql
stable
as $$
  with termo as (
    select replace(replace(replace(
      extensions.unaccent(lower(p_termo)),
      '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select s.id, s.area, s.title, s.content, s.sort_order, s.updated_at
  from public.playbook_sections s, termo
  where extensions.unaccent(lower(s.title))   like '%' || termo.t || '%' escape '\'
     or extensions.unaccent(lower(s.content)) like '%' || termo.t || '%' escape '\'
  order by s.sort_order, s.area, s.id
  limit 200;
$$;

revoke execute on function public.buscar_secoes_playbook(text) from public, anon;
grant execute on function public.buscar_secoes_playbook(text) to authenticated;
