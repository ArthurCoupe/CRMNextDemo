create or replace function private.fn_encerrar_tcv_vencido()
returns table (fechados integer)
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := public.sp_today();
  v_mes  date := private.fn_mes_corrente();
  v_ids  uuid[];
begin
  with alvo as (
    select c.id
    from public.contracts c
    where c.contract_type = 'tcv'
      and c.status = 'active'
      and c.billing_ends_at is not null
      and not private.fn_contrato_fatura_em(
            c.contract_type, c.start_date, c.end_date, c.billing_ends_at, v_mes)
      and c.finished_at is null
      and not exists (
        select 1
        from public.contract_closings cc
        where cc.contract_id = c.id
          and cc.revertido_em is not null
          and (cc.revertido_em at time zone 'America/Sao_Paulo')::date
              >= date_trunc('month', c.billing_ends_at)::date
      )
  ),
  fechado as (
    update public.contracts c
       set status = 'finished',
           billing_active = false,
           finished_at = v_hoje
      from alvo a
     where c.id = a.id
    returning c.id
  )
  select array_agg(id) into v_ids from fechado;

  if v_ids is null then
    return query select 0;
    return;
  end if;

  insert into public.contract_closings (contract_id)
  select unnest(v_ids);

  return query select array_length(v_ids, 1);
end $$;

