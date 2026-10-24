create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text not null unique,
  role       app_role not null default 'member',
  job_title  text,
  avatar_url text,
  initials   text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_app_role()
returns app_role
language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active $$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and active) = 'owner',
    false)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and active)
      in ('owner','manager','member'),
    false)
$$;

create policy "profiles: staff lê todos"
  on public.profiles for select
  using (public.is_staff());

create policy "profiles: cada um lê o seu"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: cada um edita o seu"
  on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: owner administra"
  on public.profiles for all
  using (public.is_owner()) with check (public.is_owner());

