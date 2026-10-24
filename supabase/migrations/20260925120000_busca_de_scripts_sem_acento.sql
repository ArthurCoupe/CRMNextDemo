create function public.buscar_scripts(
  p_tipo    public.script_kind,
  p_termo   text,
  p_nicho   text                  default null,
  p_canal   public.script_channel default null,
  p_momento public.script_moment  default null
)
returns table (
  id             uuid,
  tipo           public.script_kind,
  title          text,
  body           text,
  nicho          text,
  canal          public.script_channel,
  momento        public.script_moment,
  pipeline_stage public.opportunity_stage,
  sort_order     int,
  active         boolean,
  updated_at     timestamptz
)
language sql
stable
set search_path = public
as $$
  with termo as (
    select replace(replace(replace(
      extensions.unaccent(lower(p_termo)),
      '\', '\\'), '%', '\%'), '_', '\_') as t
  ),
  candidatos as (
    select s.id, s.tipo, s.title, s.body, s.nicho, s.canal, s.momento,
           s.pipeline_stage, s.sort_order, s.active, s.updated_at,
           extensions.unaccent(lower(s.title)) like '%' || termo.t || '%' escape '\' as no_titulo,
           extensions.unaccent(lower(s.body))  like '%' || termo.t || '%' escape '\' as no_corpo
    from public.scripts s, termo
    where s.tipo = p_tipo
      and s.active
      and (p_nicho   is null or s.nicho   = p_nicho)
      and (p_canal   is null or s.canal   = p_canal)
      and (p_momento is null or s.momento = p_momento)
  )
  select c.id, c.tipo, c.title, c.body, c.nicho, c.canal, c.momento,
         c.pipeline_stage, c.sort_order, c.active, c.updated_at
  from candidatos c
  where c.no_titulo or c.no_corpo
  order by c.no_titulo desc, c.sort_order, c.title, c.id
  limit 200;
$$;

revoke execute on function public.buscar_scripts(public.script_kind, text, text, public.script_channel, public.script_moment) from public, anon;
grant execute on function public.buscar_scripts(public.script_kind, text, text, public.script_channel, public.script_moment) to authenticated;
