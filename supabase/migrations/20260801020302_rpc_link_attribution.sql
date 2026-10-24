create or replace function public.link_attribution(
  p_opportunity_id uuid,
  p_attribution_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_toque record;
  v_linhas int;
begin
  if public.current_app_role() not in ('owner', 'manager') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id, opportunity_id, utm_source, utm_medium, utm_campaign,
         utm_content, utm_term, landing_url, created_at
    into v_toque
  from public.lead_touches
  where attribution_id = p_attribution_id
  for update;

  if not found then
    return jsonb_build_object('status', 'nao_encontrado');
  end if;

  if v_toque.opportunity_id is not null and v_toque.opportunity_id <> p_opportunity_id then
    return jsonb_build_object('status', 'ja_vinculado');
  end if;

  update public.lead_touches
     set opportunity_id = p_opportunity_id
   where id = v_toque.id;

  update public.opportunities
     set attribution_id = p_attribution_id,
         utm_source     = v_toque.utm_source,
         utm_medium     = v_toque.utm_medium,
         utm_campaign   = v_toque.utm_campaign,
         utm_content    = v_toque.utm_content,
         utm_term       = v_toque.utm_term,
         landing_url    = v_toque.landing_url
   where id = p_opportunity_id;

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Oportunidade % não encontrada.', p_opportunity_id using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'status', 'vinculado',
    'toque', jsonb_build_object(
      'attribution_id', p_attribution_id,
      'utm_source',   v_toque.utm_source,
      'utm_medium',   v_toque.utm_medium,
      'utm_campaign', v_toque.utm_campaign,
      'utm_content',  v_toque.utm_content,
      'utm_term',     v_toque.utm_term,
      'landing_url',  v_toque.landing_url,
      'created_at',   v_toque.created_at
    )
  );
end $$;

revoke all on function public.link_attribution from public, anon;
grant execute on function public.link_attribution to authenticated;
