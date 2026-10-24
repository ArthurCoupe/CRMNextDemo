create or replace function private.expenses_pai_e_agrupador()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pai_e_grupo boolean;
  v_owner boolean := public.is_owner();
begin
  if new.parent_expense_id is null then
    return new;
  end if;

  select is_group into v_pai_e_grupo
  from public.expenses where id = new.parent_expense_id;

  if v_pai_e_grupo is null then
    if v_owner then
      raise exception 'A despesa pai % nao existe.', new.parent_expense_id
        using errcode = '23503';
    end if;
    raise exception 'permission denied for table expenses' using errcode = '42501';
  end if;

  if not v_pai_e_grupo then
    if v_owner then
      raise exception
        'So agrupador pode ser pai de despesa. Marque "%" como agrupador antes de pendurar despesas nela - e agrupador nao tem valor proprio.',
        new.parent_expense_id
        using errcode = '23514';
    end if;
    raise exception 'permission denied for table expenses' using errcode = '42501';
  end if;

  return new;
end $$;

create or replace function private.expenses_arvore_rasa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_filhos int;
  v_owner boolean := public.is_owner();
begin
  if old.is_group and not new.is_group then
    perform 1 from public.expenses where id = old.id for update;

    select count(*) into v_filhos from public.expenses where parent_expense_id = old.id;
    if v_filhos > 0 then
      if v_owner then
        raise exception
          'Este agrupador tem % despesa(s) penduradas nele. Mova-as para outro agrupador ou tire-as do custo antes de deixar de ser agrupador - senao a mesma linha viraria despesa contada E pai ao mesmo tempo.', v_filhos
          using errcode = '23514';
      end if;
      raise exception 'permission denied for table expenses' using errcode = '42501';
    end if;
  end if;

  if new.parent_expense_id is not null
     and new.parent_expense_id is distinct from old.parent_expense_id then
    select count(*) into v_filhos from public.expenses where parent_expense_id = new.id;
    if v_filhos > 0 then
      if v_owner then
        raise exception
          'Esta linha tem % despesa(s) penduradas nela e por isso nao pode ser pendurada em outro agrupador: a arvore tem um nivel so.', v_filhos
          using errcode = '23514';
      end if;
      raise exception 'permission denied for table expenses' using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

create or replace function private.expenses_pai_e_agrupador_lock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.parent_expense_id is not null then
    perform 1 from public.expenses where id = new.parent_expense_id for update;
  end if;
  return new;
end $$;

create trigger trg_expenses_pai_e_agrupador_lock
  before insert or update of parent_expense_id on public.expenses
  for each row execute function private.expenses_pai_e_agrupador_lock();

revoke all on function private.expenses_pai_e_agrupador_lock() from public, anon, authenticated;

alter table public.expenses
  add column deactivated_at timestamptz;

alter table public.expenses
  add constraint expenses_saida_tem_data
  check (active = (deactivated_at is null));

create function private.expenses_carimba_saida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.active and not new.active then
    new.deactivated_at := coalesce(new.deactivated_at, now());
  elsif not old.active and new.active then
    new.deactivated_at := null;
  end if;
  return new;
end $$;

create trigger trg_expenses_carimba_saida
  before update on public.expenses
  for each row execute function private.expenses_carimba_saida();

revoke all on function private.expenses_carimba_saida() from public, anon, authenticated;
