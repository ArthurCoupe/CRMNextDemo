revoke all on table public.onboarding_journeys       from anon;
revoke all on table public.onboarding_phases         from anon;
revoke all on table public.onboarding_tasks          from anon;
revoke all on table public.onboarding_template_phases from anon;
revoke all on table public.onboarding_template_tasks  from anon;

revoke insert, update, delete, truncate on table public.onboarding_journeys       from authenticated;
revoke insert, update, delete, truncate on table public.onboarding_phases         from authenticated;
revoke insert, update, delete, truncate on table public.onboarding_tasks          from authenticated;
revoke insert, update, delete, truncate on table public.onboarding_template_phases from authenticated;
revoke insert, update, delete, truncate on table public.onboarding_template_tasks  from authenticated;

grant update (concluida_em) on public.onboarding_tasks to authenticated;

