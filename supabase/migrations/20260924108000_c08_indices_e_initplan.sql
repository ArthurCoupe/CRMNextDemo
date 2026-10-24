create index if not exists bu_default_shares_profile_id_fk_idx on public.bu_default_shares (profile_id);
create index if not exists contract_closings_contract_id_fk_idx on public.contract_closings (contract_id);
create index if not exists contract_closings_revertido_por_fk_idx on public.contract_closings (revertido_por);
create index if not exists contract_items_product_id_fk_idx on public.contract_items (product_id);
create index if not exists contract_shares_profile_id_fk_idx on public.contract_shares (profile_id);
create index if not exists contracts_finished_by_fk_idx on public.contracts (finished_by);
create index if not exists expenses_created_by_fk_idx on public.expenses (created_by);
create index if not exists fechamentos_desfeitos_desfeito_por_fk_idx on public.fechamentos_desfeitos (desfeito_por);
create index if not exists fechamentos_desfeitos_opportunity_id_fk_idx on public.fechamentos_desfeitos (opportunity_id);
create index if not exists internal_tasks_category_task_type_fk_idx on public.internal_tasks (category, task_type);
create index if not exists internal_tasks_created_by_fk_idx on public.internal_tasks (created_by);
create index if not exists internal_tasks_opportunity_id_fk_idx on public.internal_tasks (opportunity_id);
create index if not exists internal_tasks_raiz_recorrente_fk_idx on public.internal_tasks (raiz_recorrente);
create index if not exists internal_tasks_recorrente_de_fk_idx on public.internal_tasks (recorrente_de);
create index if not exists meetings_cancelada_por_fk_idx on public.meetings (cancelada_por);
create index if not exists monthly_snapshot_rewrites_regravado_por_fk_idx on public.monthly_snapshot_rewrites (regravado_por);
create index if not exists onboarding_journeys_created_by_fk_idx on public.onboarding_journeys (created_by);
create index if not exists onboarding_tasks_category_task_type_fk_idx on public.onboarding_tasks (category, task_type);
create index if not exists onboarding_template_tasks_category_task_type_fk_idx on public.onboarding_template_tasks (category, task_type);
create index if not exists onboarding_template_tasks_papel_fk_idx on public.onboarding_template_tasks (papel);
create index if not exists opportunities_stage_id_fk_idx on public.opportunities (stage_id);
create index if not exists opportunity_events_actor_id_fk_idx on public.opportunity_events (actor_id);
create index if not exists playbook_sections_updated_by_fk_idx on public.playbook_sections (updated_by);
create index if not exists qualification_answers_answered_by_fk_idx on public.qualification_answers (answered_by);
create index if not exists role_assignments_profile_id_fk_idx on public.role_assignments (profile_id);
create index if not exists script_usage_log_client_id_fk_idx on public.script_usage_log (client_id);
create index if not exists script_usage_log_used_by_fk_idx on public.script_usage_log (used_by);
create index if not exists scripts_created_by_fk_idx on public.scripts (created_by);

alter policy "ai_conversations: cada um so a sua" on public.ai_conversations
  using ((is_staff() AND (profile_id = ( SELECT auth.uid() AS uid))))
  with check ((is_staff() AND (profile_id = ( SELECT auth.uid() AS uid))));

alter policy "ai_messages: grava quem e dono da conversa" on public.ai_messages
  with check ((is_staff() AND (EXISTS ( SELECT 1
   FROM ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.profile_id = ( SELECT auth.uid() AS uid)))))));

alter policy "ai_messages: le quem e dono da conversa" on public.ai_messages
  using ((is_staff() AND (EXISTS ( SELECT 1
   FROM ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.profile_id = ( SELECT auth.uid() AS uid)))))));

alter policy "clients: manager edita os clientes dele" on public.clients
  using (((current_app_role() = 'manager'::app_role) AND (owner_id = ( SELECT auth.uid() AS uid))))
  with check ((current_app_role() = 'manager'::app_role));

alter policy "contract_items: manager lê o que enxerga do contrato" on public.contract_items
  using (((current_app_role() = 'manager'::app_role) AND (EXISTS ( SELECT 1
   FROM (contracts c
     JOIN clients cl ON ((cl.id = c.client_id)))
  WHERE ((c.id = contract_items.contract_id) AND (cl.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "contracts: manager lê os clientes dele" on public.contracts
  using (((current_app_role() = 'manager'::app_role) AND (EXISTS ( SELECT 1
   FROM clients cl
  WHERE ((cl.id = contracts.client_id) AND (cl.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "edita quem responde" on public.internal_tasks
  using ((is_staff() AND (is_owner() OR (current_app_role() = 'manager'::app_role) OR (assignee_id = ( SELECT auth.uid() AS uid)))))
  with check ((is_staff() AND (is_owner() OR (current_app_role() = 'manager'::app_role) OR (assignee_id = ( SELECT auth.uid() AS uid)))));

alter policy "le conforme papel" on public.internal_tasks
  using ((is_staff() AND (is_owner() OR (current_app_role() = 'manager'::app_role) OR (assignee_id = ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid)))));

alter policy "participantes: escreve quem edita a reuniao" on public.meeting_attendees
  using ((is_staff() AND (EXISTS ( SELECT 1
   FROM meetings m
  WHERE ((m.id = meeting_attendees.meeting_id) AND ((m.organizer_id = ( SELECT auth.uid() AS uid)) OR (current_app_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role]))))))))
  with check ((is_staff() AND (EXISTS ( SELECT 1
   FROM meetings m
  WHERE ((m.id = meeting_attendees.meeting_id) AND ((m.organizer_id = ( SELECT auth.uid() AS uid)) OR (current_app_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role]))))))));

alter policy "reunioes: apaga quem organizou, mais owner e manager" on public.meetings
  using ((is_staff() AND ((organizer_id = ( SELECT auth.uid() AS uid)) OR (current_app_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])))));

alter policy "reunioes: edita quem organizou, mais owner e manager" on public.meetings
  using ((is_staff() AND ((organizer_id = ( SELECT auth.uid() AS uid)) OR (current_app_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])))))
  with check ((is_staff() AND ((organizer_id = ( SELECT auth.uid() AS uid)) OR (current_app_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])))));

alter policy "reunioes: ve quem participa, e a gestao ve tudo" on public.meetings
  using ((is_staff() AND ((organizer_id = ( SELECT auth.uid() AS uid)) OR (current_app_role() = ANY (ARRAY['owner'::app_role, 'manager'::app_role])) OR pode_ver_reuniao(id))));

alter policy "notif log: cada um le o seu" on public.notification_log
  using (((destinatario_id = ( SELECT auth.uid() AS uid)) OR is_owner()));

alter policy "notif pref: cada um manda na sua" on public.notification_preferences
  using ((profile_id = ( SELECT auth.uid() AS uid)))
  with check ((profile_id = ( SELECT auth.uid() AS uid)));

alter policy "w jornada: manager nos clientes dele" on public.onboarding_journeys
  using (((current_app_role() = 'manager'::app_role) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = onboarding_journeys.client_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))))
  with check (((current_app_role() = 'manager'::app_role) AND (EXISTS ( SELECT 1
   FROM clients c
  WHERE ((c.id = onboarding_journeys.client_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "w etapa: manager nos clientes dele" on public.onboarding_phases
  using (((current_app_role() = 'manager'::app_role) AND (EXISTS ( SELECT 1
   FROM (onboarding_journeys j
     JOIN clients c ON ((c.id = j.client_id)))
  WHERE ((j.id = onboarding_phases.journey_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))))
  with check (((current_app_role() = 'manager'::app_role) AND (EXISTS ( SELECT 1
   FROM (onboarding_journeys j
     JOIN clients c ON ((c.id = j.client_id)))
  WHERE ((j.id = onboarding_phases.journey_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "w item: manager nos clientes dele" on public.onboarding_tasks
  using (((current_app_role() = 'manager'::app_role) AND (EXISTS ( SELECT 1
   FROM ((onboarding_phases f
     JOIN onboarding_journeys j ON ((j.id = f.journey_id)))
     JOIN clients c ON ((c.id = j.client_id)))
  WHERE ((f.id = onboarding_tasks.phase_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))))
  with check (((current_app_role() = 'manager'::app_role) AND (EXISTS ( SELECT 1
   FROM ((onboarding_phases f
     JOIN onboarding_journeys j ON ((j.id = f.journey_id)))
     JOIN clients c ON ((c.id = j.client_id)))
  WHERE ((f.id = onboarding_tasks.phase_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "profiles: cada um edita o seu" on public.profiles
  using ((id = ( SELECT auth.uid() AS uid)))
  with check ((id = ( SELECT auth.uid() AS uid)));

alter policy "profiles: cada um lê o seu" on public.profiles
  using ((id = ( SELECT auth.uid() AS uid)));
