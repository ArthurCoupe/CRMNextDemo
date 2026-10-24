revoke all on function public.sp_week_start(timestamptz) from public;
revoke all on function public.sp_week_start(timestamptz) from anon;
grant execute on function public.sp_week_start(timestamptz) to authenticated;
