create or replace function public.sp_week_start(p_when timestamptz default now())
returns date
language sql
stable
set search_path = public
as $$ select date_trunc('week', p_when at time zone 'America/Sao_Paulo')::date $$;

