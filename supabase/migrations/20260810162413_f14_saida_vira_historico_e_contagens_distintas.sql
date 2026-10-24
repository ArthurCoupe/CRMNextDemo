create table public.payroll_saidas (
  id         uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payroll(id) on delete cascade,
  saiu_em    timestamptz not null default now(),
  voltou_em  timestamptz,
  constraint payroll_saidas_volta_depois_da_saida
    check (voltou_em is null or voltou_em >= saiu_em)
);
alter table public.payroll_saidas enable row level security;

create index payroll_saidas_por_pessoa_idx on public.payroll_saidas (payroll_id, saiu_em);

create policy "payroll_saidas: so owner"
  on public.payroll_saidas for all
  using (public.is_owner()) with check (public.is_owner());

insert into public.payroll_saidas (payroll_id, saiu_em)
select p.id, p.deactivated_at from public.payroll p where p.deactivated_at is not null;

create or replace function private.payroll_carimba_saida()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  agora timestamptz := now();
begin
  if old.active and not new.active then
    new.deactivated_at := coalesce(new.deactivated_at, agora);
    insert into public.payroll_saidas (payroll_id, saiu_em)
    values (new.id, new.deactivated_at);
  elsif not old.active and new.active then
    update public.payroll_saidas
       set voltou_em = agora
     where payroll_id = new.id and voltou_em is null;
    new.deactivated_at := null;
  end if;
  return new;
end $$;

create function private.fn_folha_do_mes(p_ref_month date)
returns table (
  payroll_id     uuid,
  chave_da_pessoa text,
  bu             business_unit,
  custo_fixo     numeric
)
language sql stable set search_path = public as $$
  select
    p.id,
    coalesce(p.profile_id::text, p.person_name),
    p.business_unit,
    p.monthly_cost + p.benefits
  from public.payroll p
  where private.fn_pessoa_na_folha_em(p.start_date, p.end_date, p_ref_month)
    and not exists (
      select 1
      from public.payroll_saidas s
      where s.payroll_id = p.id
        and date_trunc('month', s.saiu_em at time zone 'America/Sao_Paulo')::date <= p_ref_month
        and (
          s.voltou_em is null
          or p_ref_month < date_trunc('month', s.voltou_em at time zone 'America/Sao_Paulo')::date
        )
    )
$$;

create or replace function private.fn_payroll_cost(p_ref_month date)
returns table (bu business_unit, custo_fixo numeric, pessoas bigint)
language sql stable set search_path = public as $$
  select
    u.bu,
    coalesce(sum(f.custo_fixo), 0)          as custo_fixo,
    count(distinct f.chave_da_pessoa)       as pessoas
  from unnest(enum_range(null::business_unit)) as u(bu)
  left join private.fn_folha_do_mes(p_ref_month) f on f.bu = u.bu
  group by u.bu
$$;

create or replace view private.v_cost_projection with (security_invoker = true) as
with meses as (
  select (private.fn_mes_corrente() + make_interval(months => g))::date as mes
  from generate_series(0, 11) g
),
gastos as (
  select
    m.mes,
    coalesce(sum(e.amount), 0)                                                  as total,
    coalesce(sum(e.amount) filter (where e.business_unit = 'demanda'), 0)       as demanda,
    coalesce(sum(e.amount) filter (where e.business_unit = 'sistemas'), 0)      as sistemas,
    coalesce(sum(e.amount) filter (where e.business_unit = 'compartilhado'), 0) as compartilhado,
    count(e.id)                                                                 as linhas
  from meses m
  left join public.expenses e
         on e.active
        and not e.is_group
        and private.fn_despesa_corre_em(
              e.recurrence, e.start_date, e.end_date, e.installments_total, m.mes)
  group by m.mes
),
folha as (
  select
    m.mes,
    coalesce(sum(f.custo_fixo), 0)                                              as total,
    coalesce(sum(f.custo_fixo) filter (where f.bu = 'demanda'), 0)              as demanda,
    coalesce(sum(f.custo_fixo) filter (where f.bu = 'sistemas'), 0)             as sistemas,
    coalesce(sum(f.custo_fixo) filter (where f.bu = 'compartilhado'), 0)        as compartilhado,
    count(distinct f.chave_da_pessoa)::numeric                                  as pessoas
  from meses m
  left join lateral private.fn_folha_do_mes(m.mes) f on true
  group by m.mes
)
select
  g.mes,
  g.total + f.total                          as custo_total,
  g.demanda + f.demanda                      as custo_demanda,
  g.sistemas + f.sistemas                    as custo_sistemas,
  g.compartilhado + f.compartilhado          as custo_compartilhado,
  g.linhas                                   as despesas,
  g.total                                    as custo_gastos,
  f.total                                    as custo_folha,
  f.pessoas                                  as pessoas_na_folha,
  f.demanda                                  as folha_demanda,
  f.sistemas                                 as folha_sistemas,
  f.compartilhado                            as folha_compartilhado
from gastos g
join folha f on f.mes = g.mes;

create or replace view private.v_team_cost with (security_invoker = true) as
with variavel as (
  select
    s.profile_id,
    s.beneficiario,
    s.business_unit                 as bu,
    coalesce(sum(s.custo_mes), 0)   as custo_variavel,
    count(distinct s.contract_id)::bigint as contratos
  from private.v_share_cost s
  group by s.profile_id, s.beneficiario, s.business_unit
),
atribuida as (
  select v.profile_id, v.beneficiario, v.bu, v.custo_variavel, v.contratos,
         alvo.id as payroll_id
  from variavel v
  join lateral (
    select p.id
    from public.payroll p
    where p.business_unit = v.bu
      and ((v.profile_id is not null and p.profile_id = v.profile_id)
        or (v.profile_id is null and p.profile_id is null and p.person_name = v.beneficiario))
    order by p.active desc, (p.monthly_cost + p.benefits) desc, p.id
    limit 1
  ) alvo on true
)
select
  p.id                              as payroll_id,
  p.profile_id,
  p.person_name                     as pessoa,
  p.job_title                       as cargo,
  p.work_kind                       as vinculo,
  p.business_unit                   as bu,
  p.monthly_cost                    as custo_mensal,
  p.benefits                        as beneficios,
  p.monthly_cost + p.benefits       as custo_fixo,
  coalesce(a.custo_variavel, 0)     as custo_variavel,
  coalesce(a.contratos, 0)          as contratos_com_participacao,
  p.start_date                      as inicio,
  p.end_date                        as fim,
  p.active                          as ativa,
  p.monthly_cost + p.benefits + coalesce(a.custo_variavel, 0) as custo_total,
  false                             as participacao_sem_linha,
  p.id::text                        as chave
from public.payroll p
left join atribuida a on a.payroll_id = p.id

union all

select
  null::uuid                        as payroll_id,
  v.profile_id,
  v.beneficiario                    as pessoa,
  null::text                        as cargo,
  null::work_kind                   as vinculo,
  v.bu,
  0::numeric(12,2)                  as custo_mensal,
  0::numeric(12,2)                  as beneficios,
  0::numeric                        as custo_fixo,
  coalesce(v.custo_variavel, 0)     as custo_variavel,
  v.contratos                       as contratos_com_participacao,
  null::date                        as inicio,
  null::date                        as fim,
  true                              as ativa,
  coalesce(v.custo_variavel, 0)     as custo_total,
  true                              as participacao_sem_linha,
  'participacao:' || v.bu::text || ':' || coalesce(v.profile_id::text, v.beneficiario) as chave
from variavel v
where not exists (
  select 1 from atribuida a
  where a.bu = v.bu
    and a.beneficiario = v.beneficiario
    and a.profile_id is not distinct from v.profile_id
);

drop event trigger trg_recusa_v_commission_cost;

create or replace function private.recusa_v_commission_cost()
returns event_trigger language plpgsql set search_path = public as $$
declare
  r record;
begin
  for r in select * from pg_event_trigger_ddl_commands() loop
    if r.object_identity ~ '(^|\.)v_commission_cost(\(|$)' then
      raise exception
        'v_commission_cost foi APAGADA pelo addendum D1 e nao deve voltar. Ela duplica pagamento com dois participantes na mesma BU, ignora MRR ao filtrar contract_type = tcv, e REESCREVE O PASSADO porque o percentual mora em payroll. A participacao vive em contract_shares, por contrato, e o custo sai de private.v_share_cost.'
        using errcode = '42501';
    end if;
  end loop;
end $$;

create event trigger trg_recusa_v_commission_cost
  on ddl_command_end
  when tag in (
    'CREATE VIEW', 'CREATE MATERIALIZED VIEW', 'CREATE TABLE', 'CREATE FUNCTION',
    'ALTER VIEW', 'ALTER MATERIALIZED VIEW', 'ALTER TABLE', 'ALTER FUNCTION'
  )
  execute function private.recusa_v_commission_cost();

revoke all on public.payroll_saidas from anon;
