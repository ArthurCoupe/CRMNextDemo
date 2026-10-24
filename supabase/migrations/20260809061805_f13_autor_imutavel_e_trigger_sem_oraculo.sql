create or replace function private.expenses_carimba_autor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    return new;
  end if;

  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

drop trigger if exists trg_expenses_carimba_autor on public.expenses;
create trigger trg_expenses_carimba_autor
  before insert or update on public.expenses
  for each row execute function private.expenses_carimba_autor();

create or replace function private.expenses_pai_e_agrupador()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pai_e_grupo boolean;
begin
  if new.parent_expense_id is null then
    return new;
  end if;

  if not public.is_owner() then
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

create or replace function private.expenses_arvore_rasa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_filhos int;
begin
  if not public.is_owner() then
    return new;
  end if;

  if old.is_group and not new.is_group then
    select count(*) into v_filhos from public.expenses where parent_expense_id = old.id;
    if v_filhos > 0 then
      raise exception
        'Este agrupador tem % despesa(s) penduradas nele. Mova ou apague as despesas antes de deixar de ser agrupador - senao a mesma linha viraria despesa contada E pai ao mesmo tempo.', v_filhos
        using errcode = '23514';
    end if;
  end if;

  if new.parent_expense_id is not null
     and new.parent_expense_id is distinct from old.parent_expense_id then
    select count(*) into v_filhos from public.expenses where parent_expense_id = new.id;
    if v_filhos > 0 then
      raise exception
        'Esta linha tem % despesa(s) penduradas nela e por isso nao pode ser pendurada em outro agrupador: a arvore tem um nivel so.', v_filhos
        using errcode = '23514';
    end if;
  end if;

  return new;
end $$;
