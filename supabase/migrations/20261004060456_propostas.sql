create type public.proposal_status as enum ('rascunho', 'enviada', 'aceita', 'recusada');

create sequence public.proposals_numero_seq;
revoke all on sequence public.proposals_numero_seq from public, anon, authenticated;

create table public.proposals (
  id                 uuid primary key default gen_random_uuid(),
  opportunity_id     uuid not null references public.opportunities(id) on delete cascade,
  numero             integer not null,
  versao             integer not null default 1,
  origem_id          uuid references public.proposals(id) on delete set null,
  status             public.proposal_status not null default 'rascunho',
  valida_ate         date not null default (public.sp_today() + 15),
  escopo             text check (char_length(escopo) <= 5000),
  prazo_entrega_dias integer check (prazo_entrega_dias > 0),
  forma_pagamento    public.payment_method not null default 'transferencia',
  parcelas_projeto   integer check (parcelas_projeto > 0),
  fidelidade_meses   integer check (fidelidade_meses > 0),
  enviada_em         timestamptz,
  enviada_por        uuid,
  aceita_em          timestamptz,
  aceita_por         uuid,
  recusada_em        timestamptz,
  created_by         uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint proposals_numero_versao_key unique (numero, versao),
  constraint proposals_carimbos_coerentes check (
    (status = 'rascunho') = (enviada_em is null)
    and (status = 'aceita') = (aceita_em is not null)
    and (status = 'recusada') = (recusada_em is not null)
  )
);

create index proposals_opportunity_idx on public.proposals (opportunity_id, numero desc, versao desc);
create index proposals_origem_idx on public.proposals (origem_id);
create unique index proposals_uma_aceita_por_numero on public.proposals (numero) where status = 'aceita';

create table public.proposal_items (
  id             uuid primary key default gen_random_uuid(),
  proposal_id    uuid not null references public.proposals(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  nome           text not null check (char_length(nome) between 1 and 200),
  descricao      text check (char_length(descricao) <= 2000),
  front          public.service_front not null,
  combo_fronts   public.service_front[],
  business_unit  public.business_unit not null,
  contract_type  public.contract_type not null,
  preco_catalogo numeric(12,2) not null check (preco_catalogo >= 0),
  valor          numeric(12,2) not null check (valor >= 0),
  ordem          integer not null default 0,
  contract_id    uuid references public.contracts(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index proposal_items_proposal_idx on public.proposal_items (proposal_id, ordem);
create index proposal_items_product_idx on public.proposal_items (product_id);
create index proposal_items_contract_idx on public.proposal_items (contract_id);

create function public.pode_ver_propostas(p_opportunity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
     and (
       not exists (select 1 from public.clients c where c.opportunity_id = p_opportunity_id)
       or (
         public.aal_suficiente()
         and (
           public.is_owner()
           or (
             public.current_app_role() = 'manager'
             and exists (
               select 1 from public.clients c
                where c.opportunity_id = p_opportunity_id and c.owner_id = auth.uid()
             )
           )
         )
       )
     );
$$;
revoke all on function public.pode_ver_propostas(uuid) from public, anon;
grant execute on function public.pode_ver_propostas(uuid) to authenticated;

alter table public.proposals enable row level security;
alter table public.proposals force row level security;
alter table public.proposal_items enable row level security;
alter table public.proposal_items force row level security;

create policy "proposals: lê antes do fechamento, depois quem lê o contrato" on public.proposals
  for select to authenticated using (public.pode_ver_propostas(opportunity_id));
create policy "proposals: cria rascunho com a mesma regra da leitura" on public.proposals
  for insert to authenticated
  with check (status = 'rascunho' and public.pode_ver_propostas(opportunity_id));
create policy "proposals: edita rascunho com a mesma regra da leitura" on public.proposals
  for update to authenticated
  using (status = 'rascunho' and public.pode_ver_propostas(opportunity_id))
  with check (status = 'rascunho' and public.pode_ver_propostas(opportunity_id));
create policy "proposals: apaga rascunho com a mesma regra da leitura" on public.proposals
  for delete to authenticated using (status = 'rascunho' and public.pode_ver_propostas(opportunity_id));

create policy "proposal_items: lê o item da proposta que a pessoa pode ler" on public.proposal_items
  for select to authenticated
  using (
    public.is_staff()
    and exists (select 1 from public.proposals p where p.id = proposal_id)
  );
create policy "proposal_items: escreve no rascunho que a pessoa pode ler" on public.proposal_items
  for all to authenticated
  using (
    public.is_staff()
    and exists (select 1 from public.proposals p where p.id = proposal_id and p.status = 'rascunho')
  )
  with check (
    public.is_staff()
    and exists (select 1 from public.proposals p where p.id = proposal_id and p.status = 'rascunho')
  );

revoke all on table public.proposals from anon, authenticated;
grant select, delete on table public.proposals to authenticated;
grant insert (opportunity_id, valida_ate, escopo, prazo_entrega_dias, forma_pagamento, parcelas_projeto, fidelidade_meses) on table public.proposals to authenticated;
grant update (valida_ate, escopo, prazo_entrega_dias, forma_pagamento, parcelas_projeto, fidelidade_meses) on table public.proposals to authenticated;

revoke all on table public.proposal_items from anon, authenticated;
grant select, delete on table public.proposal_items to authenticated;
grant insert (proposal_id, product_id, ordem) on table public.proposal_items to authenticated;
grant update (nome, descricao, valor, ordem) on table public.proposal_items to authenticated;

create function private.proposals_numera()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.origem_id is null then
    new.numero := nextval('public.proposals_numero_seq');
    new.versao := 1;
  end if;
  return new;
end;
$$;
revoke all on function private.proposals_numera() from public, anon, authenticated;

create trigger trg_proposals_00_numera
  before insert on public.proposals
  for each row execute function private.proposals_numera();

create trigger trg_proposals_updated_at
  before update on public.proposals
  for each row execute function private.set_updated_at();

create function private.opportunities_guarda_propostas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.proposals where opportunity_id = old.id and status <> 'rascunho') then
    raise exception 'Esta oportunidade tem proposta já enviada ao cliente (enviada, aceita ou recusada) e não pode ser excluída. Marque-a como perdida.'
      using errcode = '42501';
  end if;
  return old;
end;
$$;
revoke all on function private.opportunities_guarda_propostas() from public, anon, authenticated;

create trigger trg_opportunities_guarda_propostas
  before delete on public.opportunities
  for each row execute function private.opportunities_guarda_propostas();

create function private.proposal_items_copia_do_catalogo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  select left(p.name, 200), left(p.description, 2000), p.front, p.combo_fronts, p.business_unit,
         p.contract_type, p.price
    into new.nome, new.descricao, new.front, new.combo_fronts, new.business_unit,
         new.contract_type, new.preco_catalogo
    from public.products p
   where p.id = new.product_id and p.active;
  if not found then
    raise exception 'Produto fora do catálogo ativo. Escolha um produto ativo.' using errcode = '22023';
  end if;
  new.valor := new.preco_catalogo;
  return new;
end;
$$;
revoke all on function private.proposal_items_copia_do_catalogo() from public, anon, authenticated;

create trigger trg_proposal_items_00_copia
  before insert on public.proposal_items
  for each row execute function private.proposal_items_copia_do_catalogo();

create function private.proposal_items_congela()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_proposta uuid := coalesce(new.proposal_id, old.proposal_id);
  v_status   public.proposal_status;
begin
  if current_user = 'authenticated' then
    select status into v_status from public.proposals where id = v_proposta for share;
    if v_status is distinct from 'rascunho'
       and exists (select 1 from public.proposals where id = v_proposta) then
      raise exception 'Esta proposta já foi enviada. Crie uma nova versão para mudar.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.proposal_items_congela() from public, anon, authenticated;

create trigger trg_proposal_items_01_congela
  before insert or update or delete on public.proposal_items
  for each row execute function private.proposal_items_congela();

create function private.clients_vinculo_da_oportunidade_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.opportunity_id is not null then
      raise exception 'O vínculo do cliente com a oportunidade não pode ser alterado.' using errcode = '42501';
    end if;
  else
    if new.opportunity_id is distinct from old.opportunity_id then
      raise exception 'O vínculo do cliente com a oportunidade não pode ser alterado.' using errcode = '42501';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'A data de criação do cliente não pode ser alterada.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.clients_vinculo_da_oportunidade_imutavel() from public, anon, authenticated;

create trigger trg_clients_vinculo_da_oportunidade
  before insert or update of opportunity_id, created_at on public.clients
  for each row execute function private.clients_vinculo_da_oportunidade_imutavel();

create function public.enviar_proposta(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.proposal_status;
  v_opp    uuid;
  v_numero integer;
  v_versao integer;
begin
  if not public.is_staff() then
    perform private.negar('enviar_proposta');
  end if;
  select status, opportunity_id, numero, versao
    into v_status, v_opp, v_numero, v_versao
    from public.proposals where id = p_id and public.pode_ver_propostas(opportunity_id)
     for update;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'Esta proposta já foi enviada. Crie uma nova versão para mudar.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.proposal_items where proposal_id = p_id) then
    raise exception 'Adicione ao menos um item antes de enviar.' using errcode = '22023';
  end if;

  update public.proposals
     set status = 'enviada', enviada_em = now(), enviada_por = auth.uid()
   where id = p_id;

  insert into public.opportunity_events (opportunity_id, event_type, content)
  values (v_opp, 'proposal_sent',
          format('Proposta Nº %s v%s enviada.', lpad(v_numero::text, 4, '0'), v_versao));
end;
$$;

create function public.recusar_proposta(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.proposal_status;
  v_numero integer;
  v_versao integer;
begin
  if not public.is_staff() then
    perform private.negar('recusar_proposta');
  end if;
  select status, numero, versao into v_status, v_numero, v_versao
    from public.proposals where id = p_id and public.pode_ver_propostas(opportunity_id)
     for update;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if v_status <> 'enviada' then
    raise exception 'Só proposta enviada pode ser marcada como recusada.' using errcode = '22023';
  end if;
  if exists (select 1 from public.proposals where numero = v_numero and versao > v_versao) then
    raise exception 'Existe uma versão mais nova desta proposta. Use a mais nova.' using errcode = '22023';
  end if;
  update public.proposals set status = 'recusada', recusada_em = now() where id = p_id;
end;
$$;

create function public.nova_versao_proposta(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.proposal_status;
  v_numero integer;
  v_versao integer;
  v_nova   uuid;
begin
  if not public.is_staff() then
    perform private.negar('nova_versao_proposta');
  end if;
  select status, numero, versao into v_status, v_numero, v_versao
    from public.proposals where id = p_id and public.pode_ver_propostas(opportunity_id)
     for update;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if v_status not in ('enviada', 'recusada') then
    raise exception 'Só proposta enviada ou recusada ganha nova versão.' using errcode = '22023';
  end if;
  if exists (select 1 from public.proposals where numero = v_numero and versao > v_versao) then
    raise exception 'Existe uma versão mais nova desta proposta. Use a mais nova.' using errcode = '22023';
  end if;

  insert into public.proposals
    (opportunity_id, numero, versao, origem_id, escopo, prazo_entrega_dias,
     forma_pagamento, parcelas_projeto, fidelidade_meses)
  select opportunity_id, numero, versao + 1, id, escopo, prazo_entrega_dias,
         forma_pagamento, parcelas_projeto, fidelidade_meses
    from public.proposals where id = p_id
  returning id into v_nova;

  insert into public.proposal_items
    (proposal_id, product_id, nome, descricao, front, combo_fronts, business_unit,
     contract_type, preco_catalogo, valor, ordem)
  select v_nova, product_id, nome, descricao, front, combo_fronts, business_unit,
         contract_type, preco_catalogo, valor, ordem
    from public.proposal_items where proposal_id = p_id;

  return v_nova;
end;
$$;

create function public.registrar_contrato_da_proposta(p_id uuid, p_contract_id uuid)
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

  select c.contract_type, c.business_unit, cl.opportunity_id
    into v_tipo, v_bu, v_opp_do_contrato
    from public.contracts c
    join public.clients cl on cl.id = c.client_id
   where c.id = p_contract_id;
  if not found or v_opp_do_contrato is distinct from v_opp then
    raise exception 'Este contrato não é do cliente desta oportunidade.' using errcode = '22023';
  end if;

  perform 1 from public.contracts where id = p_contract_id for update;

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

create function public.get_propostas_da_oportunidade(p_opportunity_id uuid)
returns table (
  id uuid,
  numero integer,
  versao integer,
  status public.proposal_status,
  valida_ate date,
  escopo text,
  prazo_entrega_dias integer,
  forma_pagamento public.payment_method,
  parcelas_projeto integer,
  fidelidade_meses integer,
  enviada_em timestamptz,
  aceita_em timestamptz,
  recusada_em timestamptz,
  created_at timestamptz,
  total_mensal numeric,
  total_projeto numeric,
  vencida boolean,
  ultima boolean,
  cliente_id uuid
)
language sql
stable
security invoker
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
         (select c.id from public.clients c where c.opportunity_id = p.opportunity_id)
    from public.proposals p
   where p.opportunity_id = p_opportunity_id
   order by p.numero desc, p.versao desc
   limit 100
$$;

create function public.get_contratos_a_criar(p_client_id uuid)
returns table (
  proposta_id uuid,
  numero integer,
  versao integer,
  contract_type public.contract_type,
  business_unit public.business_unit,
  valor numeric,
  forma_pagamento public.payment_method,
  prazo_entrega_dias integer,
  parcelas_projeto integer,
  fidelidade_meses integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.numero, p.versao, i.contract_type, i.business_unit,
         sum(i.valor)::numeric(12,2),
         p.forma_pagamento, p.prazo_entrega_dias, p.parcelas_projeto, p.fidelidade_meses
    from public.clients c
    join public.proposals p on p.opportunity_id = c.opportunity_id and p.status = 'aceita'
    join public.proposal_items i on i.proposal_id = p.id and i.contract_id is null
   where c.id = p_client_id
     and p.aceita_em >= c.created_at
   group by p.id, p.numero, p.versao, i.contract_type, i.business_unit,
            p.forma_pagamento, p.prazo_entrega_dias, p.parcelas_projeto, p.fidelidade_meses
   order by p.numero, i.business_unit, i.contract_type
   limit 20
$$;

revoke all on function public.enviar_proposta(uuid) from public, anon;
revoke all on function public.recusar_proposta(uuid) from public, anon;
revoke all on function public.nova_versao_proposta(uuid) from public, anon;
revoke all on function public.registrar_contrato_da_proposta(uuid, uuid) from public, anon;
revoke all on function public.get_propostas_da_oportunidade(uuid) from public, anon;
revoke all on function public.get_contratos_a_criar(uuid) from public, anon;
grant execute on function public.enviar_proposta(uuid) to authenticated;
grant execute on function public.recusar_proposta(uuid) to authenticated;
grant execute on function public.nova_versao_proposta(uuid) to authenticated;
grant execute on function public.registrar_contrato_da_proposta(uuid, uuid) to authenticated;
grant execute on function public.get_propostas_da_oportunidade(uuid) to authenticated;
grant execute on function public.get_contratos_a_criar(uuid) to authenticated;
