create table public.expenses_saidas (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  saiu_em    timestamptz not null default now(),
  voltou_em  timestamptz,
  constraint expenses_saidas_volta_depois_da_saida
    check (voltou_em is null or voltou_em >= saiu_em)
);
alter table public.expenses_saidas enable row level security;

create index expenses_saidas_por_gasto_idx on public.expenses_saidas (expense_id, saiu_em);

create policy "expenses_saidas: so owner"
  on public.expenses_saidas for all
  using (public.is_owner()) with check (public.is_owner());

insert into public.expenses_saidas (expense_id, saiu_em)
select e.id, e.deactivated_at
  from public.expenses e
 where not e.active and e.deactivated_at is not null;

create or replace function private.expenses_carimba_saida()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  agora timestamptz := now();
begin
  if old.active and not new.active then
    new.deactivated_at := coalesce(new.deactivated_at, agora);
    insert into public.expenses_saidas (expense_id, saiu_em)
    values (new.id, new.deactivated_at);
  elsif not old.active and new.active then
    update public.expenses_saidas
       set voltou_em = agora
     where expense_id = new.id and voltou_em is null;
    new.deactivated_at := null;
  end if;
  return new;
end $$;

create or replace function private.fn_expenses_cost(p_ref_month date)
returns table (bu business_unit, custo numeric, linhas bigint)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(e.amount), 0) as custo,
    count(e.id)                as linhas
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join public.expenses e
         on e.business_unit = u.bu
        and not e.is_group
        and private.fn_despesa_corre_em(
              e.recurrence, e.start_date, e.end_date, e.installments_total, p_ref_month)
        and (
          e.deactivated_at is null
          or p_ref_month < date_trunc('month', e.deactivated_at at time zone 'America/Sao_Paulo')::date
        )
        and not exists (
          select 1
          from public.expenses_saidas s
          where s.expense_id = e.id
            and date_trunc('month', s.saiu_em at time zone 'America/Sao_Paulo')::date <= p_ref_month
            and (
              s.voltou_em is null
              or p_ref_month < date_trunc('month', s.voltou_em at time zone 'America/Sao_Paulo')::date
            )
        )
  group by u.bu
$$;

revoke all on public.expenses_saidas from anon;
revoke truncate on public.expenses_saidas from authenticated;
