alter table public.contracts
  add column opportunity_id uuid references public.opportunities(id) on delete restrict;

create index contracts_opportunity_idx on public.contracts (opportunity_id)
  where opportunity_id is not null;

update public.contracts ct
   set opportunity_id = cl.opportunity_id
  from public.clients cl
 where cl.id = ct.client_id
   and cl.opportunity_id is not null;

drop function public.ligar_cliente_a_oportunidade(uuid, uuid);
drop function public.desligar_cliente_da_oportunidade(uuid);
drop function private.recalcular_valor_fechado(uuid);

create function private.recalcular_valor_fechado(p_opportunity_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_mrr numeric;
  v_tcv numeric;
begin
  if p_opportunity_id is null then
    return;
  end if;

  if not exists (select 1 from public.contracts ct where ct.opportunity_id = p_opportunity_id) then
    update public.opportunities
       set closed_mrr = null, closed_tcv = null
     where id = p_opportunity_id;
    return;
  end if;

  select coalesce(sum(ct.monthly_value) filter (where ct.contract_type = 'mrr'), 0),
         coalesce(sum(ct.total_value)   filter (where ct.contract_type = 'tcv'), 0)
    into v_mrr, v_tcv
    from public.contracts ct
   where ct.opportunity_id = p_opportunity_id
     and ct.status <> 'cancelled'
     and ct.billing_active;

  update public.opportunities
     set closed_mrr = v_mrr, closed_tcv = v_tcv
   where id = p_opportunity_id;
end $$;

revoke all on function private.recalcular_valor_fechado(uuid) from public, anon, authenticated;

create or replace function private.sync_opportunity_value()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    perform private.recalcular_valor_fechado(old.opportunity_id);
  end if;
  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE' and new.opportunity_id is distinct from old.opportunity_id) then
    perform private.recalcular_valor_fechado(new.opportunity_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public.get_closed_by_opportunity()
returns table(opportunity_id uuid, closed_mrr numeric, closed_tcv numeric)
language sql
stable
set search_path = public
as $$
  select c.opportunity_id,
         coalesce(sum(c.monthly_value) filter (where c.contract_type = 'mrr'), 0),
         coalesce(sum(c.total_value)   filter (where c.contract_type = 'tcv'), 0)
    from public.contracts c
   where c.opportunity_id is not null
     and c.status <> 'cancelled'
     and c.billing_active
   group by c.opportunity_id;
$$;

create function private.contracts_venda_de_origem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome  text;
  v_stage public.opportunity_stage;
begin
  if new.opportunity_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.opportunity_id is not distinct from old.opportunity_id
     and new.client_id is not distinct from old.client_id then
    return new;
  end if;

  select o.name, o.stage into v_nome, v_stage
    from public.opportunities o
   where o.id = new.opportunity_id
     for update;

  if not found then
    raise exception 'Venda de origem não encontrada. Recarregue a página.' using errcode = 'P0002';
  end if;

  if v_stage <> 'fechado' then
    raise exception 'A venda "%" não está em Fechado. Marque como ganha no Pipeline antes de ligar o contrato a ela.',
      v_nome using errcode = '23514';
  end if;

  if exists (
    select 1 from public.contracts ct
     where ct.opportunity_id = new.opportunity_id
       and ct.client_id <> new.client_id
       and ct.id <> new.id
  ) then
    raise exception 'A venda "%" já tem contrato de outro cliente. Todos os contratos de uma venda são do mesmo cliente.',
      v_nome using errcode = '23514';
  end if;

  return new;
end $$;

revoke all on function private.contracts_venda_de_origem() from public, anon, authenticated;

create trigger trg_contracts_venda_de_origem
  before insert or update of opportunity_id, client_id on public.contracts
  for each row execute function private.contracts_venda_de_origem();

create function private.opportunities_guarda_contratos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.contracts ct where ct.opportunity_id = old.id) then
    raise exception 'Esta venda tem contrato e não pode ser excluída. Para tirá-la de Fechado, use "Desfazer fechamento" na ficha da oportunidade.'
      using errcode = '23503';
  end if;
  return old;
end $$;

revoke all on function private.opportunities_guarda_contratos() from public, anon, authenticated;

create trigger trg_opportunities_guarda_contratos
  before delete on public.opportunities
  for each row execute function private.opportunities_guarda_contratos();

create or replace function public.pode_ver_propostas(p_opportunity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
     and (
       not exists (select 1 from public.contracts ct where ct.opportunity_id = p_opportunity_id)
       or (
         public.aal_suficiente()
         and (
           public.is_owner()
           or (
             public.current_app_role() = 'manager'
             and exists (
               select 1
                 from public.contracts ct
                 join public.clients c on c.id = ct.client_id
                where ct.opportunity_id = p_opportunity_id
                  and c.owner_id = auth.uid()
             )
           )
         )
       )
     );
$$;

create or replace function public.get_propostas_da_oportunidade(p_opportunity_id uuid)
returns table(id uuid, numero integer, versao integer, status proposal_status, valida_ate date,
              escopo text, prazo_entrega_dias integer, forma_pagamento payment_method,
              parcelas_projeto integer, fidelidade_meses integer,
              enviada_em timestamp with time zone, aceita_em timestamp with time zone,
              recusada_em timestamp with time zone, created_at timestamp with time zone,
              total_mensal numeric, total_projeto numeric, vencida boolean, ultima boolean,
              cliente_id uuid)
language sql
stable
set search_path = public
as $$
  select p.id, p.numero, p.versao, p.status, p.valida_ate, p.escopo, p.prazo_entrega_dias,
         p.forma_pagamento, p.parcelas_projeto, p.fidelidade_meses, p.enviada_em, p.aceita_em,
         p.recusada_em, p.created_at,
         coalesce((select sum(i.valor) from public.proposal_items i
                    where i.proposal_id = p.id and i.contract_type = 'mrr'), 0)::numeric(12,2),
         coalesce((select sum(i.valor) from public.proposal_items i
                    where i.proposal_id = p.id and i.contract_type = 'tcv'), 0)::numeric(12,2),
         p.status = 'enviada' and p.valida_ate < public.sp_today(),
         p.versao = (select max(q.versao) from public.proposals q where q.numero = p.numero),
         (select ct.client_id from public.contracts ct
           where ct.opportunity_id = p.opportunity_id limit 1)
    from public.proposals p
   where p.opportunity_id = p_opportunity_id
   order by p.numero desc, p.versao desc
   limit 100
$$;

create or replace function public.registrar_contrato_da_proposta(p_id uuid, p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status   public.proposal_status;
  v_opp      uuid;
  v_numero   integer;
  v_versao   integer;
  v_tipo     public.contract_type;
  v_bu       public.business_unit;
  v_opp_do_contrato uuid;
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('registrar_contrato_da_proposta');
  end if;
  select status, opportunity_id, numero, versao
    into v_status, v_opp, v_numero, v_versao
    from public.proposals where id = p_id
     for update;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if v_status not in ('enviada', 'aceita') then
    raise exception 'Só proposta enviada pode ser aceita.' using errcode = '22023';
  end if;

  select c.contract_type, c.business_unit, c.opportunity_id
    into v_tipo, v_bu, v_opp_do_contrato
    from public.contracts c
   where c.id = p_contract_id
     for update;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;
  if v_opp_do_contrato is not null and v_opp_do_contrato <> v_opp then
    raise exception 'Este contrato é de outra venda.' using errcode = '22023';
  end if;

  if exists (select 1 from public.proposal_items where proposal_id = p_id and contract_id = p_contract_id) then
    return;
  end if;

  if exists (select 1 from public.proposal_items where contract_id = p_contract_id and proposal_id <> p_id) then
    raise exception 'Este contrato já está ligado a outra proposta.' using errcode = '22023';
  end if;

  if v_status = 'enviada'
     and exists (select 1 from public.proposals where numero = v_numero and versao > v_versao) then
    raise exception 'Existe uma versão mais nova desta proposta. Use a mais nova.' using errcode = '22023';
  end if;

  if v_opp_do_contrato is null then
    update public.contracts set opportunity_id = v_opp where id = p_contract_id;
  end if;

  update public.proposal_items
     set contract_id = p_contract_id
   where proposal_id = p_id
     and contract_id is null
     and contract_type = v_tipo
     and business_unit = v_bu;
  if not found then
    raise exception 'Esta proposta não tem item pendente do tipo e da linha deste contrato.' using errcode = '22023';
  end if;

  if v_status = 'enviada' then
    update public.proposals
       set status = 'aceita', aceita_em = now(), aceita_por = auth.uid()
     where id = p_id;
  end if;
end;
$$;

drop function public.get_contratos_a_criar(uuid);

create function public.get_contratos_a_criar(p_client_id uuid)
returns table(proposta_id uuid, numero integer, versao integer, contract_type contract_type,
              business_unit business_unit, valor numeric, forma_pagamento payment_method,
              prazo_entrega_dias integer, parcelas_projeto integer, fidelidade_meses integer,
              opportunity_id uuid)
language sql
stable
set search_path = public
as $$
  select p.id, p.numero, p.versao, i.contract_type, i.business_unit,
         sum(i.valor)::numeric(12,2),
         p.forma_pagamento, p.prazo_entrega_dias, p.parcelas_projeto, p.fidelidade_meses,
         p.opportunity_id
    from public.proposals p
    join public.proposal_items i on i.proposal_id = p.id and i.contract_id is null
   where p.status = 'aceita'
     and p.opportunity_id in (
       select ct.opportunity_id from public.contracts ct
        where ct.client_id = p_client_id and ct.opportunity_id is not null
     )
     and p.aceita_em > coalesce(
       (select max(f.desfeito_em) from public.fechamentos_desfeitos f
         where f.opportunity_id = p.opportunity_id),
       '-infinity'::timestamptz)
   group by p.id, p.numero, p.versao, i.contract_type, i.business_unit,
            p.forma_pagamento, p.prazo_entrega_dias, p.parcelas_projeto, p.fidelidade_meses,
            p.opportunity_id
   order by p.numero, i.business_unit, i.contract_type
   limit 20
$$;

revoke all on function public.get_contratos_a_criar(uuid) from public, anon;
grant execute on function public.get_contratos_a_criar(uuid) to authenticated;

create or replace function private.opportunities_saida_do_fechado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.stage is distinct from 'fechado' or new.stage = 'fechado' then
    return new;
  end if;

  if exists (select 1 from public.contracts ct where ct.opportunity_id = old.id) then
    raise exception 'Esta venda já tem contrato. Para tirá-la de Fechado, use "Desfazer fechamento" na ficha da oportunidade.'
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
     'Ganha sem contrato tirada de Fechado no Pipeline.', auth.uid());

  return new;
end $$;

drop function public.desfazer_fechamento(uuid, text);
drop function private.fn_desfazer_fechamento(uuid, text, uuid);

create function private.fn_desfazer_fechamento(p_opportunity_id uuid, p_motivo text, p_por uuid)
returns table(contratos_apagados integer, estagio_restaurado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda          public.opportunities%rowtype;
  v_motivo         text := coalesce(btrim(p_motivo), '');
  v_mes            date;
  v_n_contratos    int;
  v_cliente_nome   text;
  v_stage_anterior public.opportunity_stage;
begin
  if v_motivo = '' then
    raise exception 'Informe o motivo para desfazer o fechamento.' using errcode = '23514';
  end if;

  perform 1 from public.contracts ct where ct.opportunity_id = p_opportunity_id for update;

  select * into v_venda from public.opportunities o where o.id = p_opportunity_id for update;
  if not found then
    raise exception 'Venda não encontrada.' using errcode = 'P0002';
  end if;

  if v_venda.stage <> 'fechado' then
    raise exception 'A venda "%" não está em Fechado, então não há fechamento a desfazer.',
      v_venda.name using errcode = '23514';
  end if;

  select count(*), min(cl.name) into v_n_contratos, v_cliente_nome
    from public.contracts ct
    join public.clients cl on cl.id = ct.client_id
   where ct.opportunity_id = p_opportunity_id;

  if v_n_contratos = 0 then
    raise exception 'A venda "%" não tem contrato. Para tirá-la de Fechado, arraste o card para outra etapa no Pipeline.',
      v_venda.name using errcode = '23514';
  end if;

  v_mes := date_trunc('month', coalesce(v_venda.stage_changed_at at time zone 'America/Sao_Paulo',
                                        public.sp_today()))::date;

  if exists (select 1 from public.monthly_snapshots s where s.ref_month = v_mes) then
    raise exception 'O mês % já foi fechado e não se desfaz um fechamento dele. Para corrigir um mês congelado o caminho é regravar_snapshot, com motivo.',
      to_char(v_mes, 'MM/YYYY') using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.contracts ct
      join public.monthly_snapshots s on s.ref_month >= date_trunc('month', ct.start_date)::date
     where ct.opportunity_id = p_opportunity_id
  ) then
    raise exception 'Um contrato da venda "%" já entrou em pelo menos um mês fechado. Para mexer em mês congelado o caminho é regravar_snapshot, com motivo.',
      v_venda.name using errcode = '23514';
  end if;

  select e.from_stage into v_stage_anterior
    from public.opportunity_events e
   where e.opportunity_id = p_opportunity_id
     and e.event_type = 'stage_change'
     and e.to_stage = 'fechado'
   order by e.created_at desc
   limit 1;

  if v_stage_anterior in ('perdido', 'descartado') then
    v_stage_anterior := null;
  end if;

  insert into public.fechamentos_desfeitos
    (opportunity_id, cliente_nome, contratos_apagados, closed_mrr_antes,
     closed_tcv_antes, estagio_restaurado, motivo, desfeito_por)
  values
    (p_opportunity_id, v_cliente_nome, v_n_contratos, v_venda.closed_mrr,
     v_venda.closed_tcv, v_stage_anterior::text, v_motivo, p_por);

  delete from public.contracts ct where ct.opportunity_id = p_opportunity_id;

  if v_stage_anterior is not null then
    update public.opportunities set stage = v_stage_anterior where id = p_opportunity_id;
  end if;

  return query select v_n_contratos, v_stage_anterior::text;
end $$;

revoke all on function private.fn_desfazer_fechamento(uuid, text, uuid) from public, anon, authenticated;

create function public.desfazer_fechamento(p_opportunity_id uuid, p_motivo text)
returns table(contratos_apagados integer, estagio_restaurado text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('desfazer_fechamento');
  end if;
  return query select * from private.fn_desfazer_fechamento(p_opportunity_id, p_motivo, auth.uid());
end $$;

revoke all on function public.desfazer_fechamento(uuid, text) from public, anon;
grant execute on function public.desfazer_fechamento(uuid, text) to authenticated;

create function public.get_origens_dos_clientes()
returns table(opportunity_id uuid, opportunity_name text, client_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    perform private.negar('get_origens_dos_clientes');
  end if;

  return query
    select distinct ct.opportunity_id, o.name, ct.client_id
      from public.contracts ct
      join public.opportunities o on o.id = ct.opportunity_id
     order by ct.client_id, o.name, ct.opportunity_id
     limit 500;
end $$;

revoke all on function public.get_origens_dos_clientes() from public, anon;
grant execute on function public.get_origens_dos_clientes() to authenticated;

create function public.listar_ganhas_sem_contrato()
returns table(id uuid, name text, contact_name text, contact_email text, contact_phone text,
              segment text, nicho text, ganha_em timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    perform private.negar('listar_ganhas_sem_contrato');
  end if;

  return query
    select o.id, o.name, o.contact_name, o.contact_email, o.contact_phone,
           o.segment, o.nicho, o.stage_changed_at
      from public.opportunities o
     where o.stage = 'fechado'
       and not exists (select 1 from public.contracts ct where ct.opportunity_id = o.id)
     order by o.stage_changed_at, o.id
     limit 200;
end $$;

revoke all on function public.listar_ganhas_sem_contrato() from public, anon;
grant execute on function public.listar_ganhas_sem_contrato() to authenticated;

drop function public.listar_ganhas_sem_cliente();

create or replace view private.v_closings_by_campaign
with (security_invoker = true)
as
select coalesce(nullif(btrim(o.utm_campaign), ''), 'sem atribuicao') as campanha,
       coalesce(nullif(btrim(o.utm_source), ''), 'sem origem') as origem,
       coalesce(o.channel::text, 'sem_atribuicao') as canal,
       count(*) filter (where c.status <> 'cancelled') as contratos,
       count(*) filter (where c.status = 'cancelled') as cancelados
  from public.contracts c
  left join public.opportunities o on o.id = c.opportunity_id
 group by 1, 2, 3;

create or replace view public.v_client_health
with (security_invoker = true)
as
select c.id as client_id,
       greatest(
         (select max(e.created_at)
            from public.opportunity_events e
           where e.opportunity_id in (select og.opportunity_id
                                        from public.get_origens_dos_clientes() og
                                       where og.client_id = c.id)),
         (select max(m.starts_at)
            from public.meetings m
           where m.client_id = c.id and m.cancelada_em is null and m.starts_at <= now())
       ) as ultimo_evento_em,
       (select min(coalesce(ct.billing_ends_at, ct.end_date))
          from public.contracts ct
         where ct.client_id = c.id and ct.status <> 'cancelled' and ct.billing_active
           and coalesce(ct.billing_ends_at, ct.end_date) is not null) as proximo_fim_de_cobranca,
       (select count(*)
          from public.contracts ct
         where ct.client_id = c.id and ct.status <> 'cancelled' and ct.billing_active) as contratos_ativos
  from public.clients c;

create or replace function public.anonimizar_cliente(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opps integer;
  v_toques integer;
begin
  if not public.is_owner() then
    perform private.negar('anonimizar_cliente');
  end if;
  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'cliente inexistente' using errcode = 'P0002';
  end if;

  update public.clients
     set contact_name = null, contact_email = null, contact_phone = null
   where id = p_client_id;

  update public.opportunities
     set contact_name = null, contact_email = null, contact_phone = null
   where id in (select ct.opportunity_id from public.contracts ct
                 where ct.client_id = p_client_id and ct.opportunity_id is not null);
  get diagnostics v_opps = row_count;

  update public.lead_touches
     set user_agent = null, landing_url = null
   where opportunity_id in (select ct.opportunity_id from public.contracts ct
                             where ct.client_id = p_client_id and ct.opportunity_id is not null);
  get diagnostics v_toques = row_count;

  perform private.registrar_evento(
    'cliente_anonimizado', p_client_id::text,
    jsonb_build_object('oportunidades', v_opps, 'toques', v_toques)
  );
  return jsonb_build_object('ok', true, 'oportunidades', v_opps, 'toques', v_toques);
end;
$$;

drop function public.save_client_and_contract(uuid, text, uuid, text, contract_type, business_unit,
  jsonb, date, text, text, text, text, text, client_status, numeric, numeric, integer, integer,
  integer, boolean, date, date, payment_method, integer, boolean, text, jsonb);

drop function public.save_contract(uuid, text, contract_type, business_unit, jsonb, date, uuid,
  numeric, numeric, integer, integer, integer, boolean, boolean, text, date, date, payment_method,
  integer, boolean, contract_status, text);

create function public.save_contract(
  p_client_id uuid, p_name text, p_type contract_type, p_bu business_unit, p_items jsonb,
  p_start_date date, p_contract_id uuid default null, p_monthly numeric default null,
  p_total numeric default null, p_billing_months integer default null,
  p_duration_months integer default null, p_commitment_months integer default null,
  p_is_firm boolean default true, p_billing_active boolean default null,
  p_pause_reason text default null, p_end_date date default null,
  p_delivery_deadline date default null,
  p_payment_method payment_method default 'transferencia'::payment_method,
  p_installments integer default null, p_is_commissionable boolean default true,
  p_status contract_status default 'active'::contract_status, p_notes text default null,
  p_opportunity_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id            uuid;
  v_qtd_itens     int;
  v_incoerentes   int;
  v_soma_itens    numeric;
  v_esperado      numeric;
  v_billing       boolean;
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    raise exception 'Somente owner grava contrato.' using errcode = '42501';
  end if;

  set constraints all deferred;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'A decomposição por frente é obrigatória: envie ao menos um item.'
      using errcode = '22023';
  end if;

  select count(*) into v_qtd_itens from jsonb_array_elements(p_items);
  if v_qtd_itens = 0 then
    raise exception 'A decomposição por frente é obrigatória: envie ao menos um item.'
      using errcode = '22023';
  end if;

  select count(*) into v_incoerentes
  from jsonb_array_elements(p_items) it
  where (case (it->>'front')
           when 'sistemas' then 'sistemas'::business_unit
           else 'demanda'::business_unit
         end) <> p_bu;

  if v_incoerentes > 0 then
    raise exception
      'Frente incompatível com a linha de negócio: % item(ns) de outra BU. Posicionamento, tráfego e comercial são de Demanda; sistemas é de Sistemas.',
      v_incoerentes
      using errcode = '22023';
  end if;

  select coalesce(sum((it->>'value')::numeric), 0) into v_soma_itens
  from jsonb_array_elements(p_items) it;

  v_esperado := coalesce(p_monthly, p_total);

  if v_esperado is null then
    raise exception 'Contrato % exige %.',
      p_type,
      case p_type when 'mrr' then 'valor mensal' else 'valor total e meses de cobrança' end
      using errcode = '22023';
  end if;

  if v_soma_itens <> v_esperado then
    raise exception
      'A soma dos itens (%) não fecha com o valor do contrato (%). Ajuste a decomposição por frente.',
      v_soma_itens, v_esperado
      using errcode = '23514';
  end if;

  if p_type = 'tcv' and coalesce(p_billing_months, 0) <= 0 then
    raise exception 'Contrato tcv exige meses de cobrança maior que zero.' using errcode = '22023';
  end if;

  if p_status = 'paused' and p_billing_active is null then
    raise exception
      'Pausar exige decisão explícita sobre a cobrança: informe se ela continua ou não.'
      using errcode = '22023';
  end if;

  v_billing := coalesce(p_billing_active, true);

  if p_contract_id is null then
    insert into public.contracts (
      client_id, name, contract_type, business_unit,
      monthly_value, total_value, billing_months, duration_months, commitment_months,
      is_firm, billing_active, billing_paused_at, pause_reason,
      start_date, end_date, delivery_deadline,
      payment_method, installments, is_commissionable, status, notes,
      opportunity_id
    ) values (
      p_client_id, p_name, p_type, p_bu,
      p_monthly, p_total, p_billing_months, p_duration_months, p_commitment_months,
      p_is_firm, v_billing,
      case when not v_billing then public.sp_today() end,
      p_pause_reason,
      p_start_date, p_end_date, p_delivery_deadline,
      p_payment_method, p_installments, p_is_commissionable, p_status, p_notes,
      p_opportunity_id
    )
    returning id into v_id;
  else
    update public.contracts set
      client_id = p_client_id, name = p_name, contract_type = p_type, business_unit = p_bu,
      monthly_value = p_monthly, total_value = p_total, billing_months = p_billing_months,
      duration_months = p_duration_months, commitment_months = p_commitment_months,
      is_firm = p_is_firm, billing_active = v_billing,
      billing_paused_at = case when not v_billing then coalesce(billing_paused_at, public.sp_today()) end,
      pause_reason = p_pause_reason,
      start_date = p_start_date, end_date = p_end_date, delivery_deadline = p_delivery_deadline,
      payment_method = p_payment_method, installments = p_installments,
      is_commissionable = p_is_commissionable, status = p_status, notes = p_notes,
      opportunity_id = p_opportunity_id,
      updated_at = now()
    where id = p_contract_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Contrato não encontrado.' using errcode = '23503';
    end if;

    if p_status in ('active', 'paused') then
      update public.contract_closings
         set revertido_em = now(), revertido_por = auth.uid()
       where contract_id = v_id and revertido_em is null;
      if found then
        update public.contracts set finished_at = null where id = v_id;
      end if;
    end if;
  end if;

  delete from public.contract_items where contract_id = v_id;

  insert into public.contract_items (contract_id, front, product_id, value)
  select
    v_id,
    (it->>'front')::service_front,
    nullif(it->>'product_id', '')::uuid,
    (it->>'value')::numeric
  from jsonb_array_elements(p_items) it;

  begin
    set constraints all immediate;
  exception
    when check_violation then
      set constraints all deferred;
      raise exception
        'A soma dos itens não fecha com o valor do contrato. Ajuste a decomposição por frente.'
        using errcode = '23514';
  end;

  set constraints all deferred;

  return v_id;
end $$;

revoke all on function public.save_contract(uuid, text, contract_type, business_unit, jsonb, date,
  uuid, numeric, numeric, integer, integer, integer, boolean, boolean, text, date, date,
  payment_method, integer, boolean, contract_status, text, uuid) from public, anon;
grant execute on function public.save_contract(uuid, text, contract_type, business_unit, jsonb, date,
  uuid, numeric, numeric, integer, integer, integer, boolean, boolean, text, date, date,
  payment_method, integer, boolean, contract_status, text, uuid) to authenticated;

drop trigger trg_clients_vinculo_da_oportunidade on public.clients;
drop function private.clients_vinculo_da_oportunidade_imutavel();

create function private.clients_criacao_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated' and new.created_at is distinct from old.created_at then
    raise exception 'A data de criação do cliente não pode ser alterada.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.clients_criacao_imutavel() from public, anon, authenticated;

create trigger trg_clients_criacao_imutavel
  before update of created_at on public.clients
  for each row execute function private.clients_criacao_imutavel();

revoke insert (opportunity_id), update (opportunity_id) on public.clients from authenticated;

alter table public.clients drop column opportunity_id;
