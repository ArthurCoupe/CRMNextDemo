create table public.monthly_snapshot_rewrites (
  id             uuid primary key default gen_random_uuid(),
  ref_month      date not null,
  motivo         text not null,
  resultado_antes numeric(12,2),
  resultado_depois numeric(12,2),
  regravado_por  uuid not null references public.profiles(id),
  regravado_em   timestamptz not null default now()
);
alter table public.monthly_snapshot_rewrites enable row level security;

create policy "owner le as regravacoes"
  on public.monthly_snapshot_rewrites for select
  using (public.is_owner());

revoke all on table public.monthly_snapshot_rewrites from anon;
grant select on table public.monthly_snapshot_rewrites to authenticated;

create function private.fn_regravar_snapshot(p_ref_month date, p_motivo text, p_por uuid)
returns table (regravou boolean, resultado_antes numeric, resultado_depois numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_mes    date := date_trunc('month', p_ref_month)::date;
  v_antes  numeric;
  v_depois numeric;
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'motivo obrigatorio para regravar um mes congelado'
      using errcode = '23514';
  end if;

  if v_mes >= private.fn_mes_corrente() then
    raise exception 'nao se congela mes corrente nem futuro: %', v_mes
      using errcode = '23514';
  end if;

  select s.resultado into v_antes
  from public.monthly_snapshots s where s.ref_month = v_mes;

  if v_antes is null then
    return query select false, null::numeric, null::numeric;
    return;
  end if;

  delete from public.monthly_snapshots s where s.ref_month = v_mes;

  select g.resultado_do_mes into v_depois
  from private.fn_gravar_snapshot(v_mes) g;

  insert into public.monthly_snapshot_rewrites
    (ref_month, motivo, resultado_antes, resultado_depois, regravado_por)
  values (v_mes, btrim(p_motivo), v_antes, v_depois, p_por);

  return query select true, v_antes, v_depois;
end $$;

create function public.regravar_snapshot(p_ref_month date, p_motivo text)
returns table (regravou boolean, resultado_antes numeric, resultado_depois numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.fn_regravar_snapshot(p_ref_month, p_motivo, auth.uid());
end $$;

revoke all on function public.regravar_snapshot(date, text) from public, anon;
grant execute on function public.regravar_snapshot(date, text) to authenticated;
