create function private.recalcular_valor_fechado(p_client_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_opp_id uuid;
  v_mrr    numeric;
  v_tcv    numeric;
begin
  select opportunity_id into v_opp_id from public.clients where id = p_client_id;
  if v_opp_id is null then
    return;
  end if;

  select coalesce(sum(monthly_value) filter (where contract_type = 'mrr'), 0),
         coalesce(sum(total_value)   filter (where contract_type = 'tcv'), 0)
    into v_mrr, v_tcv
  from public.contracts
  where client_id = p_client_id
    and status <> 'cancelled'
    and billing_active;

  update public.opportunities
     set closed_mrr = v_mrr,
         closed_tcv = v_tcv
   where id = v_opp_id;
end $$;

revoke all on function private.recalcular_valor_fechado(uuid) from public, anon, authenticated;

create or replace function private.sync_opportunity_value()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  perform private.recalcular_valor_fechado(
    case when tg_op = 'DELETE' then old.client_id else new.client_id end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create function public.ligar_cliente_a_oportunidade(p_client_id uuid, p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clients%rowtype;
  v_opp     public.opportunities%rowtype;
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('ligar_cliente_a_oportunidade');
  end if;

  select * into v_cliente from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente não encontrado. Recarregue a página.' using errcode = 'P0002';
  end if;
  if v_cliente.opportunity_id is not null then
    raise exception 'O cliente "%" já está ligado a uma oportunidade.', v_cliente.name
      using errcode = '23514';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id for update;
  if not found then
    raise exception 'Oportunidade não encontrada. Recarregue a página.' using errcode = 'P0002';
  end if;
  if v_opp.stage <> 'fechado' then
    raise exception 'A oportunidade "%" não está em Fechado. Marque como ganha no Pipeline antes de ligar o cliente.', v_opp.name
      using errcode = '23514';
  end if;
  if exists (select 1 from public.clients where opportunity_id = p_opportunity_id) then
    raise exception 'A oportunidade "%" já tem cliente.', v_opp.name
      using errcode = '23505';
  end if;

  update public.clients set opportunity_id = p_opportunity_id where id = p_client_id;

  perform private.recalcular_valor_fechado(p_client_id);
end $$;

revoke execute on function public.ligar_cliente_a_oportunidade(uuid, uuid) from public, anon;
grant execute on function public.ligar_cliente_a_oportunidade(uuid, uuid) to authenticated;

create function public.desligar_cliente_da_oportunidade(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clients%rowtype;
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('desligar_cliente_da_oportunidade');
  end if;

  select * into v_cliente from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente não encontrado. Recarregue a página.' using errcode = 'P0002';
  end if;
  if v_cliente.opportunity_id is null then
    raise exception 'O cliente "%" não está ligado a nenhuma oportunidade.', v_cliente.name
      using errcode = '23514';
  end if;

  perform 1 from public.opportunities where id = v_cliente.opportunity_id for update;

  update public.clients set opportunity_id = null where id = p_client_id;

  update public.opportunities
     set closed_mrr = null,
         closed_tcv = null
   where id = v_cliente.opportunity_id;
end $$;

revoke execute on function public.desligar_cliente_da_oportunidade(uuid) from public, anon;
grant execute on function public.desligar_cliente_da_oportunidade(uuid) to authenticated;

create function public.listar_ganhas_sem_cliente()
returns table (
  id            uuid,
  name          text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  segment       text,
  nicho         text,
  ganha_em      timestamptz
)
language sql
stable
set search_path = public
as $$
  select o.id, o.name, o.contact_name, o.contact_email, o.contact_phone,
         o.segment, o.nicho, o.stage_changed_at
    from public.opportunities o
   where o.stage = 'fechado'
     and not exists (select 1 from public.clients c where c.opportunity_id = o.id)
   order by o.stage_changed_at, o.id
   limit 200;
$$;

revoke execute on function public.listar_ganhas_sem_cliente() from public, anon;
grant execute on function public.listar_ganhas_sem_cliente() to authenticated;

alter table public.fechamentos_desfeitos alter column cliente_nome drop not null;
alter table public.fechamentos_desfeitos
  add constraint fechamentos_desfeitos_nome_quando_ha_cliente
  check (cliente_nome is not null or contratos_apagados = 0);

create function private.opportunities_saida_do_fechado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.stage is distinct from 'fechado' or new.stage = 'fechado' then
    return new;
  end if;

  if exists (select 1 from public.clients where opportunity_id = old.id) then
    raise exception 'Esta oportunidade já tem cliente. Para tirá-la de Fechado, use "Desligar da oportunidade" ou "Desfazer fechamento" na ficha do cliente.'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.fechamentos_desfeitos
     where opportunity_id = old.id and desfeito_em = now()
  ) then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  insert into public.fechamentos_desfeitos
    (opportunity_id, cliente_nome, contratos_apagados, closed_mrr_antes,
     closed_tcv_antes, estagio_restaurado, motivo, desfeito_por)
  values
    (old.id, null, 0, null, null, new.stage::text,
     'Ganha sem cliente tirada de Fechado no Pipeline.', auth.uid());

  return new;
end $$;

revoke all on function private.opportunities_saida_do_fechado() from public, anon, authenticated;

create trigger trg_opportunities_03_saida_do_fechado
  before update of stage, stage_id on public.opportunities
  for each row execute function private.opportunities_saida_do_fechado();
