create or replace function public.aal_suficiente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;
revoke all on function public.aal_suficiente() from public, anon;
grant execute on function public.aal_suficiente() to authenticated, service_role;

create policy "aal2 para quem tem TOTP" on public.bu_default_shares
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.contract_closings
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.contract_items
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.contract_shares
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.contracts
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.expenses
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.expenses_saidas
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.fechamentos_desfeitos
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.fiscal_settings
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.gateway_fees
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.monthly_snapshot_rewrites
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.monthly_snapshot_units
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.monthly_snapshots
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.payment_method_fees
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.payroll
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));
create policy "aal2 para quem tem TOTP" on public.payroll_saidas
  as restrictive for all to authenticated
  using ((select public.aal_suficiente())) with check ((select public.aal_suficiente()));

CREATE OR REPLACE FUNCTION public.definir_entrega(p_contract_id uuid, p_data date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('definir_entrega');
  end if;

  if p_data is not null and p_data > public.sp_today() then
    raise exception 'data de entrega no futuro nao e entrega: %', p_data
      using errcode = '22007';
  end if;

  update public.contracts
     set delivered_at = p_data
   where id = p_contract_id
     and contract_type = 'tcv';

  if not found then
    raise exception 'contrato tcv nao encontrado: %', p_contract_id
      using errcode = 'P0002';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.encerrar_tcv_vencido()
 RETURNS TABLE(fechados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('encerrar_tcv_vencido');
  end if;
  return query select * from private.fn_encerrar_tcv_vencido();
end $function$;

CREATE OR REPLACE FUNCTION public.get_break_even(p_ref_month date)
 RETURNS TABLE(custo_fixo_total numeric, ticket_medio_mrr numeric, ticket_medio_bruto numeric, clientes_para_pagar integer, contratos_mrr bigint, mrr_firme_total numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_break_even');
  end if;
  return query select * from private.fn_break_even(date_trunc('month', p_ref_month)::date);
end $function$;

CREATE OR REPLACE FUNCTION public.get_cash_revenue_by_unit(p_ref_month date)
 RETURNS TABLE(bu business_unit, bruto numeric, imposto numeric, taxas numeric, liquido numeric, contratos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_cash_revenue_by_unit');
  end if;
  return query
    select r.bu, r.bruto, r.imposto, r.taxas, r.liquido, r.contratos
    from private.fn_cash_revenue_by_unit(date_trunc('month', p_ref_month)::date) r
    order by r.bu;
end $function$;

CREATE OR REPLACE FUNCTION public.get_contract_closings()
 RETURNS TABLE(contract_id uuid, contrato text, cliente text, business_unit business_unit, total_value numeric, fechado_em date, motivo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_contract_closings');
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
end $function$;

CREATE OR REPLACE FUNCTION public.get_cost_by_unit(p_ref_month date)
 RETURNS TABLE(bu business_unit, custo_gastos numeric, custo_folha numeric, custo_total numeric, despesas bigint, pessoas bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_cost_by_unit');
  end if;
  return query
    select c.bu, c.custo_gastos, c.custo_folha, c.custo_total, c.despesas, c.pessoas
    from private.fn_cost_by_unit(date_trunc('month', p_ref_month)::date) c
    order by c.bu;
end $function$;

CREATE OR REPLACE FUNCTION public.get_cost_drop()
 RETURNS TABLE(mes_fim date, valor_que_sai numeric, despesas bigint, custo_no_mes_do_fim numeric, custo_depois numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_cost_drop');
  end if;
  return query select * from private.v_cost_drop d order by d.mes_fim;
end $function$;

CREATE OR REPLACE FUNCTION public.get_cost_projection()
 RETURNS TABLE(mes date, custo_total numeric, custo_demanda numeric, custo_sistemas numeric, custo_compartilhado numeric, despesas bigint, custo_gastos numeric, custo_folha numeric, pessoas_na_folha bigint, folha_demanda numeric, folha_sistemas numeric, folha_compartilhado numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_cost_projection');
  end if;
  return query
    select p.mes, p.custo_total, p.custo_demanda, p.custo_sistemas,
           p.custo_compartilhado, p.despesas, p.custo_gastos, p.custo_folha,
           p.pessoas_na_folha::bigint,
           p.folha_demanda, p.folha_sistemas, p.folha_compartilhado
    from private.v_cost_projection p order by p.mes;
end $function$;

CREATE OR REPLACE FUNCTION public.get_delayed_projects()
 RETURNS TABLE(id uuid, cliente text, projeto text, delivery_deadline date, dias_atraso integer, total_value numeric, parcela_mensal numeric, meses_extra integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_delayed_projects');
  end if;
  return query select * from private.v_delayed_projects;
end $function$;

CREATE OR REPLACE FUNCTION public.get_expenses_effective()
 RETURNS TABLE(expense_id uuid, descricao text, valor numeric, categoria expense_category, bu business_unit, recorrencia expense_recurrence, fornecedor text, meio_de_pagamento text, agrupador_id uuid, agrupador text, parcelas_total integer, parcelas_pagas integer, parcelas_restantes integer, ultima_parcela_em date, inicio date, fim date, mes_referencia date, total_do_agrupador numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_expenses_effective');
  end if;
  return query select * from private.v_expenses_effective e
                order by e.valor desc, e.descricao;
end $function$;

CREATE OR REPLACE FUNCTION public.get_metas_financeiras()
 RETURNS TABLE(mrr_mensal numeric, tcv_alvo numeric, confirmado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_metas_financeiras');
  end if;

  return query
    select (s.value ->> 'mrr_mensal')::numeric,
           (s.value ->> 'tcv_alvo')::numeric,
           coalesce((s.value ->> '_confirmado')::boolean, false)
      from public.app_settings s
     where s.key = 'metas';
end $function$;

CREATE OR REPLACE FUNCTION public.get_mrr_by_unit()
 RETURNS TABLE(bu business_unit, mrr_total numeric, mrr_firme numeric, contratos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_mrr_by_unit');
  end if;
  return query select * from private.v_mrr_by_unit;
end $function$;

CREATE OR REPLACE FUNCTION public.get_net_revenue()
 RETURNS TABLE(contract_id uuid, client_id uuid, cliente text, contrato text, contract_type contract_type, bu business_unit, payment_method payment_method, parcelas integer, bruto numeric, imposto numeric, taxa_variavel numeric, taxa_fixa numeric, liquido numeric, taxa_variavel_pct numeric, imposto_pct numeric, is_provisional boolean, fatura_no_mes boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_net_revenue');
  end if;
  return query
    select n.contract_id, n.client_id, n.cliente, n.contrato, n.contract_type,
           n.business_unit, n.payment_method, n.parcelas, n.bruto, n.imposto,
           n.taxa_variavel, n.taxa_fixa, n.liquido, n.taxa_variavel_pct,
           n.imposto_pct, n.is_provisional, n.fatura_no_mes
    from private.v_net_revenue n
    join public.contracts c on c.id = n.contract_id
    where c.billing_active
    order by n.fatura_no_mes desc, n.liquido desc;
end $function$;

CREATE OR REPLACE FUNCTION public.get_net_revenue_total()
 RETURNS TABLE(bruto numeric, deducoes numeric, liquido numeric, contratos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_net_revenue_total');
  end if;
  return query select * from private.fn_net_revenue_total();
end $function$;

CREATE OR REPLACE FUNCTION public.get_payroll_cost()
 RETURNS TABLE(bu business_unit, custo_fixo numeric, pessoas bigint, mes_referencia date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_payroll_cost');
  end if;
  return query select c.bu, c.custo_fixo, c.pessoas, c.mes_referencia
               from private.v_payroll_cost c order by c.bu;
end $function$;

CREATE OR REPLACE FUNCTION public.get_result_by_unit(p_ref_month date)
 RETURNS TABLE(bu business_unit, receita_bruta numeric, imposto numeric, taxas numeric, receita_liquida numeric, custo_gastos numeric, custo_folha numeric, custo_participacao numeric, custo_direto numeric, custo_rateado numeric, resultado numeric, margem_pct numeric, proporcao_pct numeric, congelado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_result_by_unit');
  end if;
  return query
    select r.bu, r.receita_bruta, r.imposto, r.taxas, r.receita_liquida,
           r.custo_gastos, r.custo_folha, r.custo_participacao, r.custo_direto,
           r.custo_rateado, r.resultado, r.margem_pct, r.proporcao_pct, r.congelado
    from private.fn_result_by_unit_do_mes(date_trunc('month', p_ref_month)::date) r
    order by r.bu;
end $function$;

CREATE OR REPLACE FUNCTION public.get_result_history(p_meses integer DEFAULT 12)
 RETURNS TABLE(mes date, receita_liquida numeric, custo_total numeric, resultado numeric, congelado boolean, parcial boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_result_history');
  end if;
  return query select * from private.fn_result_history(p_meses);
end $function$;

CREATE OR REPLACE FUNCTION public.get_result_total(p_ref_month date)
 RETURNS TABLE(receita_bruta numeric, imposto numeric, taxas numeric, receita_liquida numeric, custo_direto numeric, custo_rateado numeric, custo_compartilhado_nao_rateado numeric, custo_total numeric, resultado numeric, margem_pct numeric, congelado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_result_total');
  end if;
  return query
    select * from private.fn_result_total_do_mes(date_trunc('month', p_ref_month)::date);
end $function$;

CREATE OR REPLACE FUNCTION public.get_revenue_by_front()
 RETURNS TABLE(front service_front, bu business_unit, mrr_mensal numeric, tcv_total numeric, caixa_mes numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_revenue_by_front');
  end if;
  return query select * from private.v_revenue_by_front;
end $function$;

CREATE OR REPLACE FUNCTION public.get_share_cost()
 RETURNS TABLE(contract_id uuid, client_id uuid, bu business_unit, kind share_kind, beneficiario text, share_pct numeric, custo_mes numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_share_cost');
  end if;
  return query
    select s.contract_id, s.client_id, s.business_unit, s.kind,
           s.beneficiario, s.share_pct, s.custo_mes
    from private.v_share_cost s
    where s.fatura_no_mes;
end $function$;

CREATE OR REPLACE FUNCTION public.get_tcv_by_unit()
 RETURNS TABLE(bu business_unit, tcv_total numeric, projetos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('get_tcv_by_unit');
  end if;
  return query select * from private.v_tcv_by_unit;
end $function$;

CREATE OR REPLACE FUNCTION public.get_team_cost()
 RETURNS TABLE(payroll_id uuid, profile_id uuid, pessoa text, cargo text, vinculo work_kind, bu business_unit, custo_mensal numeric, beneficios numeric, custo_fixo numeric, custo_variavel numeric, contratos_com_participacao bigint, inicio date, fim date, ativa boolean, custo_total numeric, participacao_sem_linha boolean, chave text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
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

CREATE OR REPLACE FUNCTION public.gravar_snapshot(p_ref_month date)
 RETURNS TABLE(gravou boolean, mes_gravado date, resultado_do_mes numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('gravar_snapshot');
  end if;
  return query select * from private.fn_gravar_snapshot(p_ref_month);
end $function$;

CREATE OR REPLACE FUNCTION public.regravar_snapshot(p_ref_month date, p_motivo text)
 RETURNS TABLE(regravou boolean, resultado_antes numeric, resultado_depois numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('regravar_snapshot');
  end if;
  return query select * from private.fn_regravar_snapshot(p_ref_month, p_motivo, auth.uid());
end $function$;

CREATE OR REPLACE FUNCTION public.reverter_encerramento(p_contract_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('reverter_encerramento');
  end if;

  update public.contracts
     set status = 'active', billing_active = true, finished_at = null
   where id = p_contract_id;

  update public.contract_closings
     set revertido_em = now(), revertido_por = auth.uid()
   where contract_id = p_contract_id and revertido_em is null;
end $function$;

CREATE OR REPLACE FUNCTION public.save_client_and_contract(p_opportunity_id uuid, p_client_name text, p_client_owner_id uuid, p_contract_name text, p_type contract_type, p_bu business_unit, p_items jsonb, p_start_date date, p_client_segment text DEFAULT NULL::text, p_client_nicho text DEFAULT NULL::text, p_contact_name text DEFAULT NULL::text, p_contact_email text DEFAULT NULL::text, p_contact_phone text DEFAULT NULL::text, p_client_status client_status DEFAULT 'onboarding'::client_status, p_monthly numeric DEFAULT NULL::numeric, p_total numeric DEFAULT NULL::numeric, p_billing_months integer DEFAULT NULL::integer, p_duration_months integer DEFAULT NULL::integer, p_commitment_months integer DEFAULT NULL::integer, p_is_firm boolean DEFAULT true, p_end_date date DEFAULT NULL::date, p_delivery_deadline date DEFAULT NULL::date, p_payment_method payment_method DEFAULT 'transferencia'::payment_method, p_installments integer DEFAULT NULL::integer, p_is_commissionable boolean DEFAULT true, p_notes text DEFAULT NULL::text, p_shares jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_client_id   uuid;
  v_contract_id uuid;
  v_share       jsonb;
  v_pct         numeric;
  v_duplicadas  int;
  v_stage       opportunity_stage;
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    raise exception
      'Somente owner fecha negocio: criar cliente e o ato que concede leitura de contrato ao gestor.'
      using errcode = '42501';
  end if;

  if p_client_owner_id is null then
    raise exception
      'O cliente precisa de um responsavel. E esse campo que faz o contrato aparecer para o gestor.'
      using errcode = '23502';
  end if;

  if p_shares is not null then
    for v_share in select * from jsonb_array_elements(p_shares) loop
      if nullif(v_share->>'profile_id', '') is null
         and nullif(v_share->>'external_name', '') is null then
        raise exception
          'Participacao sem beneficiario: escolha alguem do time ou informe o nome de quem indicou. Se a linha ficou em branco por engano, remova-a.'
          using errcode = '22023';
      end if;

      v_pct := nullif(v_share->>'share_pct', '')::numeric;

      if v_pct is null or v_pct <= 0 then
        raise exception
          'Participacao sem percentual: informe um valor maior que zero, ou remova a linha.'
          using errcode = '22023';
      end if;

      if v_pct > 100 then
        raise exception using
          message = format('Participacao de %s%%: o percentual de uma linha nao pode passar de 100%%.', v_pct),
          errcode = '22023';
      end if;
    end loop;

    select count(*) into v_duplicadas from (
      select nullif(s->>'profile_id', '') as pid, s->>'kind' as k
      from jsonb_array_elements(p_shares) s
      where nullif(s->>'profile_id', '') is not null
      group by 1, 2
      having count(*) > 1
    ) x;

    if v_duplicadas > 0 then
      raise exception
        'Ha duas participacoes para a mesma pessoa no mesmo tipo. Some os percentuais numa linha so.'
        using errcode = '22023';
    end if;
  end if;

  select stage into v_stage
    from public.opportunities
   where id = p_opportunity_id
     for update;
  if not found then
    raise exception 'Oportunidade nao encontrada.' using errcode = '23503';
  end if;

  if v_stage = 'fechado'
     and exists (select 1 from public.clients where opportunity_id = p_opportunity_id) then
    raise exception
      'Esta oportunidade ja gerou um cliente. Abra a ficha dele para adicionar outro contrato.'
      using errcode = '23505';
  end if;

  if v_stage in ('fechado', 'perdido', 'descartado') then
    raise exception
      'Esta oportunidade já foi fechada, perdida ou descartada por outra pessoa. Recarregue o board.'
      using errcode = '23514';
  end if;

  if exists (select 1 from public.clients where opportunity_id = p_opportunity_id) then
    raise exception
      'Esta oportunidade ja gerou um cliente. Abra a ficha dele para adicionar outro contrato.'
      using errcode = '23505';
  end if;

  insert into public.clients (
    name, segment, nicho, status, contact_name, contact_email, contact_phone,
    owner_id, opportunity_id, signed_at
  ) values (
    p_client_name, p_client_segment, p_client_nicho, p_client_status,
    p_contact_name, p_contact_email, p_contact_phone,
    p_client_owner_id, p_opportunity_id, public.sp_today()
  )
  returning id into v_client_id;

  v_contract_id := public.save_contract(
    p_client_id         => v_client_id,
    p_name              => p_contract_name,
    p_type              => p_type,
    p_bu                => p_bu,
    p_items             => p_items,
    p_start_date        => p_start_date,
    p_monthly           => p_monthly,
    p_total             => p_total,
    p_billing_months    => p_billing_months,
    p_duration_months   => p_duration_months,
    p_commitment_months => p_commitment_months,
    p_is_firm           => p_is_firm,
    p_end_date          => p_end_date,
    p_delivery_deadline => p_delivery_deadline,
    p_payment_method    => p_payment_method,
    p_installments      => p_installments,
    p_is_commissionable => p_is_commissionable,
    p_status            => 'active',
    p_notes             => p_notes
  );

  if p_shares is not null then
    delete from public.contract_shares where contract_id = v_contract_id;

    insert into public.contract_shares (contract_id, profile_id, external_name, kind, share_pct)
    select
      v_contract_id,
      nullif(s->>'profile_id', '')::uuid,
      nullif(s->>'external_name', ''),
      (s->>'kind')::share_kind,
      (s->>'share_pct')::numeric
    from jsonb_array_elements(p_shares) s;
  end if;

  update public.opportunities set stage = 'fechado' where id = p_opportunity_id;

  return jsonb_build_object('client_id', v_client_id, 'contract_id', v_contract_id);
end $function$;

CREATE OR REPLACE FUNCTION public.save_contract(p_client_id uuid, p_name text, p_type contract_type, p_bu business_unit, p_items jsonb, p_start_date date, p_contract_id uuid DEFAULT NULL::uuid, p_monthly numeric DEFAULT NULL::numeric, p_total numeric DEFAULT NULL::numeric, p_billing_months integer DEFAULT NULL::integer, p_duration_months integer DEFAULT NULL::integer, p_commitment_months integer DEFAULT NULL::integer, p_is_firm boolean DEFAULT true, p_billing_active boolean DEFAULT NULL::boolean, p_pause_reason text DEFAULT NULL::text, p_end_date date DEFAULT NULL::date, p_delivery_deadline date DEFAULT NULL::date, p_payment_method payment_method DEFAULT 'transferencia'::payment_method, p_installments integer DEFAULT NULL::integer, p_is_commissionable boolean DEFAULT true, p_status contract_status DEFAULT 'active'::contract_status, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      payment_method, installments, is_commissionable, status, notes
    ) values (
      p_client_id, p_name, p_type, p_bu,
      p_monthly, p_total, p_billing_months, p_duration_months, p_commitment_months,
      p_is_firm, v_billing,
      case when not v_billing then public.sp_today() end,
      p_pause_reason,
      p_start_date, p_end_date, p_delivery_deadline,
      p_payment_method, p_installments, p_is_commissionable, p_status, p_notes
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
end $function$;

CREATE OR REPLACE FUNCTION public.save_contract_shares(p_contract_id uuid, p_shares jsonb)
 RETURNS SETOF contract_shares
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_share      jsonb;
  v_kind       text;
  v_pct        numeric;
  v_ids        uuid[];
  v_duplicadas int;
  v_estranhos  int;
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    raise exception 'Somente owner grava participação de contrato.'
      using errcode = '42501';
  end if;

  if p_shares is null or jsonb_typeof(p_shares) <> 'array' then
    raise exception 'As participações precisam vir como lista.'
      using errcode = '22023';
  end if;

  for v_share in select * from jsonb_array_elements(p_shares) loop
    if jsonb_typeof(v_share) <> 'object' then
      raise exception 'Cada participação precisa ser um objeto com kind e share_pct.'
        using errcode = '22023';
    end if;

    if nullif(v_share->>'profile_id', '') is null
       and nullif(v_share->>'external_name', '') is null then
      raise exception
        'Participação sem beneficiário: escolha alguém do time ou informe o nome de quem indicou. Se a linha ficou em branco por engano, remova-a.'
        using errcode = '22023';
    end if;

    v_kind := v_share->>'kind';
    if v_kind is null or v_kind <> all (enum_range(null::public.share_kind)::text[]) then
      raise exception 'Participação sem tipo válido: use venda, produção ou indicação.'
        using errcode = '22023';
    end if;

    v_pct := nullif(v_share->>'share_pct', '')::numeric;

    if v_pct is null or v_pct <= 0 then
      raise exception
        'Participação sem percentual: informe um valor maior que zero, ou remova a linha.'
        using errcode = '22023';
    end if;

    if v_pct > 100 then
      raise exception using
        message = 'Participação de ' || v_pct || '%: o percentual de uma linha não pode passar de 100%.',
        errcode = '22023';
    end if;
  end loop;

  select count(*) into v_duplicadas from (
    select nullif(s->>'profile_id', '') as pid, s->>'kind' as k
    from jsonb_array_elements(p_shares) s
    where nullif(s->>'profile_id', '') is not null
    group by 1, 2
    having count(*) > 1
  ) x;

  if v_duplicadas > 0 then
    raise exception
      'Há duas participações para a mesma pessoa no mesmo tipo. Some os percentuais numa linha só.'
      using errcode = '22023';
  end if;

  perform 1 from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = '23503';
  end if;

  select array_agg(x.id) into v_ids
  from (select nullif(s->>'id', '')::uuid as id from jsonb_array_elements(p_shares) s) x
  where x.id is not null;

  if v_ids is not null then
    if (select count(*) from unnest(v_ids)) <> (select count(distinct u) from unnest(v_ids) u) then
      raise exception
        'Há a mesma participação duas vezes no pedido. Recarregue a ficha antes de gravar.'
        using errcode = '22023';
    end if;

    select count(*) into v_estranhos
    from unnest(v_ids) u(id)
    where not exists (
      select 1 from public.contract_shares cs
      where cs.id = u.id and cs.contract_id = p_contract_id
    );

    if v_estranhos > 0 then
      raise exception
        'Há participação no pedido que não está gravada neste contrato. Recarregue a ficha antes de gravar.'
        using errcode = '22023';
    end if;
  end if;

  delete from public.contract_shares
  where contract_id = p_contract_id
    and id <> all (coalesce(v_ids, '{}'::uuid[]));

  update public.contract_shares cs
  set profile_id    = nullif(s->>'profile_id', '')::uuid,
      external_name = nullif(s->>'external_name', ''),
      kind          = (s->>'kind')::public.share_kind,
      share_pct     = (s->>'share_pct')::numeric
  from jsonb_array_elements(p_shares) s
  where cs.id = nullif(s->>'id', '')::uuid
    and cs.contract_id = p_contract_id
    and (cs.profile_id, cs.external_name, cs.kind, cs.share_pct) is distinct from (
      nullif(s->>'profile_id', '')::uuid,
      nullif(s->>'external_name', ''),
      (s->>'kind')::public.share_kind,
      (s->>'share_pct')::numeric
    );

  insert into public.contract_shares (contract_id, profile_id, external_name, kind, share_pct)
  select p_contract_id,
         nullif(s->>'profile_id', '')::uuid,
         nullif(s->>'external_name', ''),
         (s->>'kind')::public.share_kind,
         (s->>'share_pct')::numeric
  from jsonb_array_elements(p_shares) s
  where nullif(s->>'id', '') is null;

  return query
    select cs.id, cs.contract_id, cs.profile_id, cs.external_name, cs.kind, cs.share_pct, cs.created_at
    from public.contract_shares cs
    where cs.contract_id = p_contract_id
    order by cs.kind, cs.share_pct desc;
end $function$;
