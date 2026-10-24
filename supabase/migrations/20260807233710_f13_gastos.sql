create type expense_category   as enum ('estrutural','operacional','pessoal_socio','divida','imposto');
create type expense_recurrence as enum ('mensal','parcelado','pontual');

create table public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  description        text not null check (btrim(description) <> ''),
  amount             numeric(12,2) not null default 0 check (amount >= 0),
  category           expense_category not null,
  business_unit      business_unit not null default 'compartilhado',
  recurrence         expense_recurrence not null default 'mensal',
  installments_total int,
  installments_paid  int not null default 0 check (installments_paid >= 0),
  start_date         date not null,
  end_date           date,
  vendor             text,
  payment_method     text,
  parent_expense_id  uuid references public.expenses(id),
  is_group           boolean not null default false,
  active             boolean not null default true,
  notes              text,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),

  constraint expenses_agrupador_nao_soma
    check (not is_group or amount = 0),
  constraint expenses_agrupador_nao_tem_pai
    check (not is_group or parent_expense_id is null),
  constraint expenses_agrupador_nao_parcela
    check (not is_group or installments_total is null),

  constraint expenses_nao_e_pai_de_si
    check (parent_expense_id is null or parent_expense_id <> id),

  constraint expenses_parcelado_tem_total
    check ((recurrence = 'parcelado') = (installments_total is not null)),
  constraint expenses_parcelas_positivas
    check (installments_total is null or installments_total > 0),
  constraint expenses_pagas_nao_passam_do_total
    check (installments_total is null or installments_paid <= installments_total),

  constraint expenses_fim_depois_do_inicio
    check (end_date is null or end_date >= start_date)
);
alter table public.expenses enable row level security;

create index expenses_parent_idx on public.expenses (parent_expense_id) where parent_expense_id is not null;
create index expenses_vigencia_idx on public.expenses (active, is_group, start_date);

create function private.expenses_pai_e_agrupador()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pai_e_grupo boolean;
begin
  if new.parent_expense_id is null then
    return new;
  end if;

  select is_group into v_pai_e_grupo
  from public.expenses where id = new.parent_expense_id;

  if v_pai_e_grupo is null then
    raise exception 'A despesa pai % nao existe.', new.parent_expense_id
      using errcode = '23503';
  end if;

  if not v_pai_e_grupo then
    raise exception
      'So agrupador pode ser pai de despesa. Marque "%" como agrupador antes de pendurar despesas nela - e agrupador nao tem valor proprio.',
      new.parent_expense_id
      using errcode = '23514';
  end if;

  return new;
end $$;

create trigger trg_expenses_pai_e_agrupador
  before insert or update of parent_expense_id on public.expenses
  for each row execute function private.expenses_pai_e_agrupador();

revoke all on function private.expenses_pai_e_agrupador() from public, anon, authenticated;

create function private.expenses_carimba_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;

create trigger trg_expenses_carimba_autor
  before insert on public.expenses
  for each row execute function private.expenses_carimba_autor();

revoke all on function private.expenses_carimba_autor() from public, anon, authenticated;

create policy "expenses: so owner"
  on public.expenses for all
  using (public.is_owner()) with check (public.is_owner());
