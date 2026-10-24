set client_min_messages = warning;

do $$
begin
  if not exists (
    select 1 from auth.users
     where id = 'd0000000-0000-4000-8000-000000000001'
       and email = 'helena@crm-demo.test'
  ) then
    raise exception 'trava da demo so roda no banco da demo, depois do seed (supabase/demo/seed.sql).';
  end if;
end $$;

create schema if not exists demo;
revoke all on schema demo from public;

create or replace function demo.recusa_escrita_de_visitante()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    raise exception 'Demonstração somente leitura: as alterações não são gravadas.'
      using errcode = '42501';
  end if;
  return null;
end $$;

do $$
declare
  r record;
begin
  for r in
    select n.nspname as esquema, c.relname as tabela
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname in ('public', 'private')
  loop
    execute format('drop trigger if exists zz_demo_somente_leitura on %I.%I', r.esquema, r.tabela);
    execute format(
      'create trigger zz_demo_somente_leitura before insert or update or delete on %I.%I '
      'for each statement execute function demo.recusa_escrita_de_visitante()',
      r.esquema, r.tabela);
  end loop;
end $$;

create or replace function demo.conta_da_demo_fixa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'mfa_factors' then
    if new.user_id = 'd0000000-0000-4000-8000-000000000001' then
      raise exception 'Demonstração: a conta não aceita segundo fator.' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.id = 'd0000000-0000-4000-8000-000000000001'
     and (new.encrypted_password is distinct from old.encrypted_password
          or new.email is distinct from old.email
          or new.email_change is distinct from old.email_change
          or new.phone is distinct from old.phone
          or new.phone_change is distinct from old.phone_change) then
    raise exception 'Demonstração: a conta não troca senha, e-mail nem telefone.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists zz_demo_conta_fixa on auth.users;
create trigger zz_demo_conta_fixa before update on auth.users
  for each row execute function demo.conta_da_demo_fixa();

drop trigger if exists zz_demo_conta_fixa on auth.mfa_factors;
create trigger zz_demo_conta_fixa before insert on auth.mfa_factors
  for each row execute function demo.conta_da_demo_fixa();

create or replace function public.demo_tabelas_sem_trava()
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p')
     and n.nspname in ('public', 'private')
     and not exists (
       select 1
         from pg_trigger t
         join pg_proc p on p.oid = t.tgfoid
         join pg_namespace pn on pn.oid = p.pronamespace
        where t.tgrelid = c.oid
          and t.tgname = 'zz_demo_somente_leitura'
          and t.tgenabled in ('O', 'A')
          and t.tgtype = 30
          and not t.tgisinternal
          and pn.nspname = 'demo'
          and p.proname = 'recusa_escrita_de_visitante');
$$;
revoke all on function public.demo_tabelas_sem_trava() from public, anon;
grant execute on function public.demo_tabelas_sem_trava() to authenticated;
