create extension if not exists pg_cron;

create function private.reconcilia_parcelas()
returns table (reconciliadas int, desativadas int)
language plpgsql security definer set search_path = public as $$
declare
  v_mes date := private.fn_mes_corrente();
  v_reconciliadas int;
  v_desativadas   int;
begin
  update public.expenses e
     set installments_paid =
           private.fn_parcelas_pagas_ate(e.start_date, e.installments_total, v_mes)
   where e.recurrence = 'parcelado'
     and e.installments_total is not null
     and e.installments_paid is distinct from
           private.fn_parcelas_pagas_ate(e.start_date, e.installments_total, v_mes);
  get diagnostics v_reconciliadas = row_count;

  update public.expenses e
     set active = false
   where e.active
     and e.recurrence = 'parcelado'
     and not private.fn_despesa_corre_em(
               e.recurrence, e.start_date, e.end_date, e.installments_total, v_mes);
  get diagnostics v_desativadas = row_count;

  return query select v_reconciliadas, v_desativadas;
end $$;

revoke all on function private.reconcilia_parcelas() from public, anon, authenticated;

select cron.schedule(
  'f13-reconcilia-parcelas',
  '10 6 * * *',
  $job$ select private.reconcilia_parcelas() $job$
);
