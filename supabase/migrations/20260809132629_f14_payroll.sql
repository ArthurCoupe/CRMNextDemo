create type work_kind as enum ('clt','pj','estagio','freela','socio','comissionado');

create table public.payroll (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references public.profiles(id),
  person_name    text not null check (btrim(person_name) <> ''),
  job_title      text,
  work_kind      work_kind not null,
  monthly_cost   numeric(12,2) not null default 0 check (monthly_cost >= 0),
  benefits       numeric(12,2) not null default 0 check (benefits >= 0),

  commission_pct numeric(5,2) check (commission_pct is null
                                     or (commission_pct >= 0 and commission_pct <= 100)),

  business_unit  business_unit not null,

  start_date     date not null,
  end_date       date,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),

  constraint payroll_fim_depois_do_inicio
    check (end_date is null or end_date >= start_date)
);
alter table public.payroll enable row level security;

create index payroll_vigencia_idx on public.payroll (active, start_date);
create index payroll_profile_idx on public.payroll (profile_id) where profile_id is not null;

create policy "payroll: so owner"
  on public.payroll for all
  using (public.is_owner()) with check (public.is_owner());

create function private.recusa_v_commission_cost()
returns event_trigger language plpgsql as $$
declare
  r record;
begin
  for r in select * from pg_event_trigger_ddl_commands() loop
    if r.object_identity ilike '%v_commission_cost%' then
      raise exception
        'v_commission_cost foi APAGADA pelo addendum D1 e nao deve voltar. Ela duplica pagamento com dois participantes na mesma BU, ignora MRR ao filtrar contract_type = tcv, e REESCREVE O PASSADO porque o percentual mora em payroll. A participacao vive em contract_shares, por contrato, e o custo sai de private.v_share_cost.'
        using errcode = '42501';
    end if;
  end loop;
end $$;

create event trigger trg_recusa_v_commission_cost
  on ddl_command_end
  when tag in ('CREATE VIEW', 'CREATE MATERIALIZED VIEW', 'CREATE TABLE', 'CREATE FUNCTION')
  execute function private.recusa_v_commission_cost();
