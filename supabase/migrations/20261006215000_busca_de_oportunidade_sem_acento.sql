create function public.buscar_oportunidades_para_reuniao(p_termo text)
returns table (
  id   uuid,
  name text
)
language sql
stable
set search_path = public
as $$
  with termo as (
    select replace(replace(replace(
      extensions.unaccent(lower(btrim(p_termo))),
      '\', '\\'), '%', '\%'), '_', '\_') as t
  ),
  candidatos as (
    select o.id, o.name,
           extensions.unaccent(lower(o.name)) like termo.t || '%' escape '\' as comeca
    from public.opportunities o, termo
    where char_length(btrim(p_termo)) >= 2
      and extensions.unaccent(lower(o.name)) like '%' || termo.t || '%' escape '\'
  )
  select c.id, c.name
  from candidatos c
  order by c.comeca desc, c.name, c.id
  limit 21;
$$;

revoke execute on function public.buscar_oportunidades_para_reuniao(text) from public, anon;
grant execute on function public.buscar_oportunidades_para_reuniao(text) to authenticated;
