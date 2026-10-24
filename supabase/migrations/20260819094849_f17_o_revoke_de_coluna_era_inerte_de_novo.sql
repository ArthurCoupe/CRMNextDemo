revoke insert, update on table public.onboarding_journeys from authenticated;

grant insert (client_id, template_versao),
      update (concluida_em)
  on public.onboarding_journeys to authenticated;

