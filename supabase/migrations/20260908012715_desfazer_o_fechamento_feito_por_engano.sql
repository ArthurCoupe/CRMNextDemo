create table public.fechamentos_desfeitos (
  id                  uuid primary key default gen_random_uuid(),
  opportunity_id      uuid references public.opportunities(id) on delete set null,
  cliente_nome        text not null,
  contratos_apagados  int  not null,
  closed_mrr_antes    numeric(12,2),
  closed_tcv_antes    numeric(12,2),
  estagio_restaurado  text,
  motivo              text not null,
  desfeito_por        uuid not null references public.profiles(id),
  desfeito_em         timestamptz not null default now()
);

alter table public.fechamentos_desfeitos enable row level security;

create policy "owner le os fechamentos desfeitos"
  on public.fechamentos_desfeitos for select
  using (public.is_owner());

revoke all on table public.fechamentos_desfeitos from anon, authenticated;
grant select on table public.fechamentos_desfeitos to authenticated;

create or replace function private.fn_desfazer_fechamento(
  p_client_id uuid,
  p_motivo    text,
  p_por       uuid
)
returns table (contratos_apagados int, estagio_restaurado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente         public.clients%rowtype;
  v_motivo          text := coalesce(btrim(p_motivo), '');
  v_mes             date;
  v_n_jornadas      int;
  v_n_contratos     int;
  v_stage_anterior  public.opportunity_stage;
  v_mrr             numeric(12,2);
  v_tcv             numeric(12,2);
begin

  if v_motivo = '' then
    raise exception 'Informe o motivo para desfazer o fechamento.'
      using errcode = '23514';
  end if;

  select * into v_cliente from public.clients where id = p_client_id for update;

  if not found then
    raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
  end if;

  if v_cliente.opportunity_id is null then
    raise exception
      'O cliente "%" nao veio de um fechamento, entao nao ha fechamento a desfazer. Para remove-lo, use apagar cliente.',
      v_cliente.name
      using errcode = '23514';
  end if;

  perform 1 from public.opportunities where id = v_cliente.opportunity_id for update;

  select count(*) into v_n_jornadas
    from public.onboarding_journeys where client_id = p_client_id;

  if v_n_jornadas > 0 then
    raise exception
      'O cliente "%" ja tem onboarding aberto. Feche ou apague a jornada antes de desfazer o fechamento -- desfazer agora levaria as etapas, os itens e as tarefas do quadro junto.',
      v_cliente.name
      using errcode = '23503';
  end if;

  select count(*) into v_n_contratos
    from public.contracts where client_id = p_client_id;

  if v_n_contratos > 1 then
    raise exception
      'O cliente "%" tem % contratos, e desfazer o fechamento apagaria todos. Apague pela tela de contratos o que nao deveria existir, e desfaca depois.',
      v_cliente.name, v_n_contratos
      using errcode = '23514';
  end if;

  v_mes := date_trunc('month', coalesce(v_cliente.signed_at, public.sp_today()))::date;

  if exists (select 1 from public.monthly_snapshots where ref_month = v_mes) then
    raise exception
      'O mes % ja foi fechado e nao se desfaz um fechamento dele. Para corrigir um mes congelado o caminho e regravar_snapshot, com motivo.',
      to_char(v_mes, 'MM/YYYY')
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.contracts c
      join public.monthly_snapshots s
        on s.ref_month >= date_trunc('month', c.start_date)::date
     where c.client_id = p_client_id
  ) then
    raise exception
      'O contrato de "%" ja entrou em pelo menos um mes fechado. Para mexer em mes congelado o caminho e regravar_snapshot, com motivo.',
      v_cliente.name
      using errcode = '23514';
  end if;

  select e.from_stage into v_stage_anterior
    from public.opportunity_events e
   where e.opportunity_id = v_cliente.opportunity_id
     and e.event_type = 'stage_change'
     and e.to_stage = 'fechado'
   order by e.created_at desc
   limit 1;

  if v_stage_anterior in ('perdido', 'descartado') then
    v_stage_anterior := null;
  end if;

  select o.closed_mrr, o.closed_tcv into v_mrr, v_tcv
    from public.opportunities o where o.id = v_cliente.opportunity_id;

  insert into public.fechamentos_desfeitos
    (opportunity_id, cliente_nome, contratos_apagados, closed_mrr_antes,
     closed_tcv_antes, estagio_restaurado, motivo, desfeito_por)
  values
    (v_cliente.opportunity_id, v_cliente.name, v_n_contratos, v_mrr,
     v_tcv, v_stage_anterior::text, v_motivo, p_por);

  delete from public.contracts where client_id = p_client_id;

  delete from public.clients where id = p_client_id;

  if v_stage_anterior is not null then
    update public.opportunities
       set stage = v_stage_anterior
     where id = v_cliente.opportunity_id;
  end if;

  return query select v_n_contratos, v_stage_anterior::text;
end $$;

create or replace function public.desfazer_fechamento(p_client_id uuid, p_motivo text)
returns table (contratos_apagados int, estagio_restaurado text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'Desfazer um fechamento e do owner.' using errcode = '42501';
  end if;
  return query select * from private.fn_desfazer_fechamento(p_client_id, p_motivo, auth.uid());
end $$;

revoke all on function private.fn_desfazer_fechamento(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.desfazer_fechamento(uuid, text) from public, anon;
grant execute on function public.desfazer_fechamento(uuid, text) to authenticated;

