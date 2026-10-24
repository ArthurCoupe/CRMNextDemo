CREATE OR REPLACE FUNCTION public.definir_entrega(p_contract_id uuid, p_data date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
    perform private.negar('get_cash_revenue_by_unit');
  end if;
  return query
    select r.bu, r.bruto, r.imposto, r.taxas, r.liquido, r.contratos
    from private.fn_cash_revenue_by_unit(date_trunc('month', p_ref_month)::date) r
    order by r.bu;
end $function$;

CREATE OR REPLACE FUNCTION public.get_closings_by_campaign()
 RETURNS TABLE(campanha text, origem text, canal text, contratos bigint, cancelados bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_staff() then
    perform private.negar('get_closings_by_campaign');
  end if;

  return query
    select v.campanha, v.origem, v.canal, v.contratos, v.cancelados
      from private.v_closings_by_campaign v
     order by v.contratos desc, v.campanha;
end $function$;

CREATE OR REPLACE FUNCTION public.get_contract_closings()
 RETURNS TABLE(contract_id uuid, contrato text, cliente text, business_unit business_unit, total_value numeric, fechado_em date, motivo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
    perform private.negar('get_expenses_effective');
  end if;
  return query select * from private.v_expenses_effective e
                order by e.valor desc, e.descricao;
end $function$;

CREATE OR REPLACE FUNCTION public.get_funnel_by_channel(p_desde date DEFAULT NULL::date)
 RETURNS TABLE(canal text, estagio opportunity_stage, oportunidades bigint, oportunidades_no_canal bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_staff() then
    perform private.negar('get_funnel_by_channel');
  end if;

  return query
    with alcance as (
      select r.canal, r.estagio, r.opportunity_id
        from private.v_funnel_reach r
       where p_desde is null
          or (r.alcancado_em at time zone 'America/Sao_Paulo')::date >= p_desde
    ),
    por_canal as (
      select a.canal, count(distinct a.opportunity_id) as total from alcance a group by a.canal
    )
    select a.canal,
           a.estagio,
           count(distinct a.opportunity_id) as oportunidades,
           c.total as oportunidades_no_canal
      from alcance a
      join por_canal c on c.canal = a.canal
     group by a.canal, a.estagio, c.total;
end $function$;

CREATE OR REPLACE FUNCTION public.get_metas()
 RETURNS TABLE(toques_semana integer, r1_semana integer, confirmado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_staff() then
    perform private.negar('get_metas');
  end if;

  return query
    select round((s.value ->> 'toques_semana')::numeric)::integer,
           round((s.value ->> 'r1_semana')::numeric)::integer,
           coalesce((s.value ->> '_confirmado')::boolean, false)
      from public.app_settings s
     where s.key = 'metas';
end $function$;

CREATE OR REPLACE FUNCTION public.get_metas_financeiras()
 RETURNS TABLE(mrr_mensal numeric, tcv_alvo numeric, confirmado boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
    perform private.negar('get_net_revenue_total');
  end if;
  return query select * from private.fn_net_revenue_total();
end $function$;

CREATE OR REPLACE FUNCTION public.get_opportunity_mix()
 RETURNS TABLE(nicho text, tier text, canal text, oportunidades bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_staff() then
    perform private.negar('get_opportunity_mix');
  end if;

  return query
    select m.nicho, m.tier, m.canal, m.oportunidades
      from private.v_opportunity_mix m
     order by m.oportunidades desc, m.nicho, m.tier, m.canal;
end $function$;

CREATE OR REPLACE FUNCTION public.get_payroll_cost()
 RETURNS TABLE(bu business_unit, custo_fixo numeric, pessoas bigint, mes_referencia date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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
  if not public.is_owner() then
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

CREATE OR REPLACE FUNCTION public.get_weekly_activity(p_desde date DEFAULT NULL::date)
 RETURNS TABLE(semana date, responsavel_id uuid, responsavel text, toques bigint, r1_marcadas bigint, r1_distintas_na_semana bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_staff() then
    perform private.negar('get_weekly_activity');
  end if;

  return query
    with r1_da_semana as (
      select public.sp_week_start(e.created_at) as semana,
             count(distinct e.opportunity_id) as distintas
        from public.opportunity_events e
       where e.event_type = 'stage_change'
         and e.to_stage = 'r1'
         and e.from_stage is distinct from 'r1'
       group by 1
    )
    select a.semana,
           a.actor_id,
           coalesce(p.full_name, 'sem responsavel'),
           a.toques,
           a.r1_marcadas,
           coalesce(r.distintas, 0)
      from private.v_weekly_activity a
      left join public.profiles p on p.id = a.actor_id
      left join r1_da_semana r on r.semana = a.semana
     where p_desde is null or a.semana >= p_desde
     order by a.semana desc, coalesce(p.full_name, 'sem responsavel');
end $function$;

CREATE OR REPLACE FUNCTION public.gravar_snapshot(p_ref_month date)
 RETURNS TABLE(gravou boolean, mes_gravado date, resultado_do_mes numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_owner() then
    perform private.negar('gravar_snapshot');
  end if;
  return query select * from private.fn_gravar_snapshot(p_ref_month);
end $function$;

CREATE OR REPLACE FUNCTION public.iniciar_jornada(p_client_id uuid, p_versao smallint DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_journey uuid;
  v_phase   uuid;
  v_vazia   text;
  v_dia     date;
  r_fase    record;
  r_item    record;
begin
  if not (public.is_owner()
          or (public.current_app_role() = 'manager'
              and exists (select 1 from public.clients c
                           where c.id = p_client_id and c.owner_id = auth.uid()))) then
    perform private.negar('iniciar_jornada');
  end if;

  if not exists (select 1 from public.onboarding_template_phases where versao = p_versao) then
    raise exception 'Versao % do metodo de onboarding nao existe.', p_versao
      using errcode = '22023';
  end if;

  select string_agg(f.nome, ', ' order by f.ordem) into v_vazia
    from public.onboarding_template_phases f
   where f.versao = p_versao
     and not exists (select 1 from public.onboarding_template_tasks t
                      where t.versao = f.versao and t.fase_ordem = f.ordem);
  if v_vazia is not null then
    raise exception 'A versao % do metodo tem etapa sem nenhum item: %. Corrija o metodo antes de abrir jornada.',
      p_versao, v_vazia using errcode = 'P0001';
  end if;

  select c.signed_at
    into v_dia from public.clients c where c.id = p_client_id;

  insert into public.onboarding_journeys (client_id, template_versao, dia_zero)
  values (p_client_id, p_versao, v_dia)
  returning id into v_journey;

  for r_fase in
    select * from public.onboarding_template_phases
     where versao = p_versao order by ordem
  loop
    insert into public.onboarding_phases (journey_id, ordem, nome, descricao, periodo, responsavel)
    values (v_journey, r_fase.ordem, r_fase.nome, r_fase.descricao, r_fase.periodo, r_fase.responsavel)
    returning id into v_phase;

    for r_item in
      select * from public.onboarding_template_tasks
       where versao = p_versao and fase_ordem = r_fase.ordem order by ordem
    loop
      insert into public.onboarding_tasks
        (phase_id, ordem, titulo, papel, category, task_type, deadline_days)
      values
        (v_phase, r_item.ordem, r_item.titulo, r_item.papel,
         r_item.category, r_item.task_type, r_item.deadline_days);
    end loop;
  end loop;

  return v_journey;
end $function$;

CREATE OR REPLACE FUNCTION public.liberar_etapa(p_phase_id uuid, p_forcar boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_journey uuid;
begin
  select f.journey_id into v_journey
    from public.onboarding_phases f where f.id = p_phase_id;

  if v_journey is null then
    raise exception 'Etapa % nao existe.', p_phase_id using errcode = '22023';
  end if;

  if not private.pode_mexer_na_jornada(v_journey) then
    perform private.negar('liberar_etapa');
  end if;

  return private.fn_libera_etapa(p_phase_id, p_forcar);
end $function$;

CREATE OR REPLACE FUNCTION public.link_attribution(p_opportunity_id uuid, p_attribution_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_toque record;
  v_linhas int;
begin
  if coalesce(public.current_app_role() in ('owner', 'manager'), false) is false then
    perform private.negar('link_attribution');
  end if;

  select id, opportunity_id, utm_source, utm_medium, utm_campaign,
         utm_content, utm_term, landing_url, created_at
    into v_toque
  from public.lead_touches
  where attribution_id = p_attribution_id
  for update;

  if not found then
    return jsonb_build_object('status', 'nao_encontrado');
  end if;

  if v_toque.opportunity_id is not null and v_toque.opportunity_id <> p_opportunity_id then
    return jsonb_build_object('status', 'ja_vinculado');
  end if;

  update public.lead_touches
     set opportunity_id = p_opportunity_id
   where id = v_toque.id;

  update public.opportunities
     set attribution_id = p_attribution_id,
         utm_source     = v_toque.utm_source,
         utm_medium     = v_toque.utm_medium,
         utm_campaign   = v_toque.utm_campaign,
         utm_content    = v_toque.utm_content,
         utm_term       = v_toque.utm_term,
         landing_url    = v_toque.landing_url
   where id = p_opportunity_id;

  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Oportunidade % não encontrada.', p_opportunity_id using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'status', 'vinculado',
    'toque', jsonb_build_object(
      'attribution_id', p_attribution_id,
      'utm_source',   v_toque.utm_source,
      'utm_medium',   v_toque.utm_medium,
      'utm_campaign', v_toque.utm_campaign,
      'utm_content',  v_toque.utm_content,
      'utm_term',     v_toque.utm_term,
      'landing_url',  v_toque.landing_url,
      'created_at',   v_toque.created_at
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.regravar_snapshot(p_ref_month date, p_motivo text)
 RETURNS TABLE(regravou boolean, resultado_antes numeric, resultado_depois numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_owner() then
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
  if not public.is_owner() then
    perform private.negar('reverter_encerramento');
  end if;

  update public.contracts
     set status = 'active', billing_active = true, finished_at = null
   where id = p_contract_id;

  update public.contract_closings
     set revertido_em = now(), revertido_por = auth.uid()
   where contract_id = p_contract_id and revertido_em is null;
end $function$;
