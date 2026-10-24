create table public.acesso_a_folha (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  incluido_em timestamptz not null default now()
);

alter table public.acesso_a_folha enable row level security;
alter table public.acesso_a_folha force row level security;
revoke all on table public.acesso_a_folha from public, anon, authenticated;

insert into public.acesso_a_folha (profile_id)
select id from public.profiles
where id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002');

create function public.ve_folha()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner()
     and exists (select 1 from public.acesso_a_folha where profile_id = auth.uid());
$$;

revoke all on function public.ve_folha() from public, anon;
grant execute on function public.ve_folha() to authenticated;

drop policy "payroll: so owner" on public.payroll;
create policy "payroll: so quem ve a folha" on public.payroll
  for all
  using (public.ve_folha())
  with check (public.ve_folha());

drop policy "payroll_saidas: so owner" on public.payroll_saidas;
create policy "payroll_saidas: so quem ve a folha" on public.payroll_saidas
  for all
  using (public.ve_folha())
  with check (public.ve_folha());

CREATE OR REPLACE FUNCTION public.get_payroll_cost()
 RETURNS TABLE(bu business_unit, custo_fixo numeric, pessoas bigint, mes_referencia date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.ve_folha() and public.aal_suficiente()) then
    perform private.negar('get_payroll_cost');
  end if;
  return query select c.bu, c.custo_fixo, c.pessoas, c.mes_referencia
               from private.v_payroll_cost c order by c.bu;
end $function$;

CREATE OR REPLACE FUNCTION public.get_team_cost()
 RETURNS TABLE(payroll_id uuid, profile_id uuid, pessoa text, cargo text, vinculo work_kind, bu business_unit, custo_mensal numeric, beneficios numeric, custo_fixo numeric, custo_variavel numeric, contratos_com_participacao bigint, inicio date, fim date, ativa boolean, custo_total numeric, participacao_sem_linha boolean, chave text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.ve_folha() and public.aal_suficiente()) then
    perform private.negar('get_team_cost');
  end if;
  return query
    select t.payroll_id, t.profile_id, t.pessoa, t.cargo, t.vinculo, t.bu,
           t.custo_mensal::numeric, t.beneficios::numeric, t.custo_fixo, t.custo_variavel,
           t.contratos_com_participacao, t.inicio, t.fim, t.ativa, t.custo_total,
           t.participacao_sem_linha, t.chave
    from private.v_team_cost t
    order by t.participacao_sem_linha, t.ativa desc, t.custo_total desc, t.pessoa;
end $function$;
