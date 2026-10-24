create table public.contract_closings (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.contracts(id) on delete cascade,
  fechado_em   date not null default public.sp_today(),
  motivo       text not null default 'faturamento encerrado (billing_ends_at)',
  revertido_em timestamptz,
  revertido_por uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
alter table public.contract_closings enable row level security;

create index contract_closings_abertos_idx
  on public.contract_closings (fechado_em desc) where revertido_em is null;

create policy "contract_closings: so owner"
  on public.contract_closings for all
  using (public.is_owner()) with check (public.is_owner());

revoke all on public.contract_closings from anon;

create function private.fn_encerrar_tcv_vencido()
returns table (fechados int)
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := public.sp_today();
  v_ids  uuid[];
begin
  with alvo as (
    select c.id
    from public.contracts c
    where c.contract_type = 'tcv'
      and c.status = 'active'
      and c.billing_ends_at is not null
      and c.billing_ends_at < v_hoje
      and c.finished_at is null
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

create function public.encerrar_tcv_vencido()
returns table (fechados int)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.fn_encerrar_tcv_vencido();
end $$;

create function public.reverter_encerramento(p_contract_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.contracts
     set status = 'active', billing_active = true, finished_at = null
   where id = p_contract_id;

  update public.contract_closings
     set revertido_em = now(), revertido_por = auth.uid()
   where contract_id = p_contract_id and revertido_em is null;
end $$;

revoke all on function public.encerrar_tcv_vencido()      from public, anon;
revoke all on function public.reverter_encerramento(uuid) from public, anon;
grant execute on function public.encerrar_tcv_vencido()      to authenticated;
grant execute on function public.reverter_encerramento(uuid) to authenticated;

create function public.get_contract_closings()
returns table (
  contract_id uuid, contrato text, cliente text, business_unit business_unit,
  total_value numeric, fechado_em date, motivo text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select cc.contract_id, c.name, cl.name, c.business_unit,
           c.total_value, cc.fechado_em, cc.motivo
    from public.contract_closings cc
    join public.contracts c on c.id = cc.contract_id
    join public.clients cl on cl.id = c.client_id
    where cc.revertido_em is null
    order by cc.fechado_em desc
    limit 50;
end $$;

revoke all on function public.get_contract_closings() from public, anon;
grant execute on function public.get_contract_closings() to authenticated;

select cron.schedule(
  'f15-encerra-tcv-vencido',
  '0 9 * * *',
  $job$ select private.fn_encerrar_tcv_vencido(); $job$
);
