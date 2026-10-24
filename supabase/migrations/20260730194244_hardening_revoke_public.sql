revoke execute on function public.current_app_role()          from public, anon;
revoke execute on function public.is_owner()                  from public, anon;
revoke execute on function public.is_staff()                  from public, anon;
revoke execute on function public.opportunity_tier(uuid)      from public, anon;
revoke execute on function public.sp_today()                  from public, anon;
revoke execute on function public.sp_month_start(timestamptz) from public, anon;

grant execute on function public.current_app_role()           to authenticated, service_role;
grant execute on function public.is_owner()                   to authenticated, service_role;
grant execute on function public.is_staff()                   to authenticated, service_role;
grant execute on function public.opportunity_tier(uuid)       to authenticated, service_role;
grant execute on function public.sp_today()                   to authenticated, service_role;
grant execute on function public.sp_month_start(timestamptz)  to authenticated, service_role;

