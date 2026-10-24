do $$
begin
  if exists (select 1 from auth.users) or exists (select 1 from public.clients) then
    raise exception 'seed da demo so roda em banco vazio (sem usuarios nem clientes): este ja tem dados.';
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

create function pg_temp.mes(n int) returns date language sql stable as
  $$ select (date_trunc('month', public.sp_today()) + make_interval(months => n))::date $$;
create function pg_temp.dia(n int) returns date language sql stable as
  $$ select public.sp_today() + n $$;
create function pg_temp.hora(n int, h text) returns timestamptz language sql stable as
  $$ select ((public.sp_today() + n)::text || ' ' || h)::timestamp at time zone 'America/Sao_Paulo' $$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email,
  extensions.crypt(coalesce(p.senha, extensions.gen_random_uuid()::text), extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', p.nome),
  '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'helena@crm-demo.test',  'Helena Duarte',  'demo-crm-2026'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'rodrigo@crm-demo.test',  'Rodrigo Moura',   null),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'camila@crm-demo.test',  'Camila Rocha',   null),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'diego@crm-demo.test',   'Diego Fontes',   null),
  ('d0000000-0000-4000-8000-000000000005'::uuid, 'larissa@crm-demo.test', 'Larissa Prado',  null),
  ('d0000000-0000-4000-8000-000000000006'::uuid, 'tiago@crm-demo.test',   'Tiago Mendes',   null),
  ('d0000000-0000-4000-8000-000000000007'::uuid, 'bianca@crm-demo.test',  'Bianca Lopes',   null),
  ('d0000000-0000-4000-8000-000000000008'::uuid, 'otavio@crm-demo.test',  'Otávio Reis',    null)
) as p(id, email, nome, senha);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@crm-demo.test';

update public.profiles p
   set role = v.papel::public.app_role, active = true, job_title = v.cargo, initials = v.iniciais
  from (values
    ('d0000000-0000-4000-8000-000000000001'::uuid, 'owner',   'Sócia e diretora',     'HD'),
    ('d0000000-0000-4000-8000-000000000002'::uuid, 'owner',   'Sócio comercial',      'RM'),
    ('d0000000-0000-4000-8000-000000000003'::uuid, 'manager', 'Gestora de contas',    'CR'),
    ('d0000000-0000-4000-8000-000000000004'::uuid, 'manager', 'Líder de Sistemas',    'DF'),
    ('d0000000-0000-4000-8000-000000000005'::uuid, 'member',  'SDR',                  'LP'),
    ('d0000000-0000-4000-8000-000000000006'::uuid, 'member',  'Gestor de tráfego',    'TM'),
    ('d0000000-0000-4000-8000-000000000007'::uuid, 'member',  'Designer',             'BL'),
    ('d0000000-0000-4000-8000-000000000008'::uuid, 'member',  'Desenvolvedor',        'OR')
  ) as v(id, papel, cargo, iniciais)
 where p.id = v.id;

insert into public.acesso_a_folha (profile_id)
values ('d0000000-0000-4000-8000-000000000001')
on conflict do nothing;

update public.role_assignments r
   set profile_id = v.pessoa
  from (values
    ('AM',      'd0000000-0000-4000-8000-000000000003'::uuid),
    ('Design',  'd0000000-0000-4000-8000-000000000007'::uuid),
    ('Copy',    'd0000000-0000-4000-8000-000000000007'::uuid),
    ('Closer',  'd0000000-0000-4000-8000-000000000002'::uuid),
    ('Tráfego', 'd0000000-0000-4000-8000-000000000006'::uuid)
  ) as v(papel, pessoa)
 where r.role_key = v.papel;

insert into public.clients
  (id, name, segment, nicho, status, owner_id, contact_name, contact_email, contact_phone,
   signed_at, paused_at, churned_at, created_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'Padaria Grão Dourado', 'Alimentação', 'Panificadora', 'active',
   'd0000000-0000-4000-8000-000000000003', 'Sandra', 'sandra@graodourado.test', '(11) 90000-0101',
   pg_temp.mes(-14) + 4, null, null, pg_temp.mes(-14)),
  ('a1000000-0000-4000-8000-000000000002', 'Clínica Sorriso Pleno', 'Saúde', 'Clínica odontológica', 'active',
   'd0000000-0000-4000-8000-000000000003', 'Dr. Paulo', 'paulo@sorrisopleno.test', '(11) 90000-0102',
   pg_temp.mes(-11) + 2, null, null, pg_temp.mes(-11)),
  ('a1000000-0000-4000-8000-000000000003', 'Ótica Visão Clara', 'Varejo', 'Óptica', 'active',
   'd0000000-0000-4000-8000-000000000003', 'Renata', 'renata@visaoclara.test', '(11) 90000-0103',
   pg_temp.mes(-9) + 9, null, null, pg_temp.mes(-9)),
  ('a1000000-0000-4000-8000-000000000004', 'Academia Movimento Livre', 'Fitness', 'Academia', 'paused',
   'd0000000-0000-4000-8000-000000000003', 'Marcos', 'marcos@movimentolivre.test', '(11) 90000-0104',
   pg_temp.mes(-8) + 1, pg_temp.mes(-1) + 5, null, pg_temp.mes(-8)),
  ('a1000000-0000-4000-8000-000000000005', 'Imobiliária Porto Firme', 'Imobiliário', 'Imobiliária', 'active',
   'd0000000-0000-4000-8000-000000000004', 'Cláudia', 'claudia@portofirme.test', '(11) 90000-0105',
   pg_temp.mes(-7) + 3, null, null, pg_temp.mes(-7)),
  ('a1000000-0000-4000-8000-000000000006', 'Construtora Alicerce Norte', 'Construção', 'Construtora', 'active',
   'd0000000-0000-4000-8000-000000000004', 'Eng. Débora', 'debora@alicercenorte.test', '(11) 90000-0106',
   pg_temp.mes(-5) + 6, null, null, pg_temp.mes(-5)),
  ('a1000000-0000-4000-8000-000000000007', 'Escola de Idiomas Ponte Aberta', 'Educação', 'Escola de idiomas', 'active',
   'd0000000-0000-4000-8000-000000000003', 'Júlia', 'julia@ponteaberta.test', '(11) 90000-0107',
   pg_temp.mes(-6) + 2, null, null, pg_temp.mes(-6)),
  ('a1000000-0000-4000-8000-000000000008', 'Pet Center Quatro Patas', 'Pet', 'Pet shop', 'churned',
   'd0000000-0000-4000-8000-000000000003', 'Fábio', 'fabio@quatropatas.test', '(11) 90000-0108',
   pg_temp.mes(-12) + 3, null, pg_temp.mes(-2) + 10, pg_temp.mes(-12)),
  ('a1000000-0000-4000-8000-000000000009', 'Escritório Norma Jurídica', 'Jurídico', 'Advocacia', 'active',
   'd0000000-0000-4000-8000-000000000002', 'Dra. Beatriz', 'beatriz@normajuridica.test', '(11) 90000-0109',
   pg_temp.mes(-4) + 7, null, null, pg_temp.mes(-4)),
  ('a1000000-0000-4000-8000-000000000010', 'Distribuidora Rota Sul', 'Atacado', 'Distribuidora', 'active',
   'd0000000-0000-4000-8000-000000000004', 'Ronaldo', 'ronaldo@rotasul.test', '(11) 90000-0110',
   pg_temp.mes(-10) + 1, null, null, pg_temp.mes(-10)),
  ('a1000000-0000-4000-8000-000000000011', 'Café Tertúlia', 'Alimentação', 'Cafeteria', 'onboarding',
   'd0000000-0000-4000-8000-000000000003', 'Lívia', 'livia@cafetertulia.test', '(11) 90000-0111',
   pg_temp.dia(-10), null, null, pg_temp.dia(-12)),
  ('a1000000-0000-4000-8000-000000000012', 'Studio Pilates Equilíbrio', 'Saúde', 'Estúdio de pilates', 'onboarding',
   'd0000000-0000-4000-8000-000000000003', 'Carla', 'carla@pilatesequilibrio.test', '(11) 90000-0112',
   pg_temp.dia(-20), null, null, pg_temp.dia(-22));

insert into public.opportunities
  (id, name, segment, nicho, stage, owner_id, contact_name, contact_email, contact_phone,
   channel, business_unit, expected_fronts, estimated_value, next_followup_at,
   created_at, stage_changed_at, r1_agendada_em, notes)
values
  ('b1000000-0000-4000-8000-000000000001', 'Hamburgueria Brasa Viva', 'Alimentação', 'Hamburgueria', 'prospeccao',
   'd0000000-0000-4000-8000-000000000005', 'Gilberto', 'gilberto@brasaviva.test', '(11) 90000-0201',
   'outbound', 'demanda', '{trafego,comercial}', 3500, pg_temp.dia(1), pg_temp.dia(-6), pg_temp.dia(-6), null, null),
  ('b1000000-0000-4000-8000-000000000002', 'Auto Peças Pistão', 'Automotivo', 'Autopeças', 'prospeccao',
   'd0000000-0000-4000-8000-000000000005', 'Sérgio', 'sergio@pistao.test', '(11) 90000-0202',
   'outbound', 'demanda', '{trafego}', 2800, pg_temp.dia(2), pg_temp.dia(-4), pg_temp.dia(-4), null, null),
  ('b1000000-0000-4000-8000-000000000003', 'Floricultura Jardim Secreto', 'Varejo', 'Floricultura', 'prospeccao',
   'd0000000-0000-4000-8000-000000000005', 'Aline', 'aline@jardimsecreto.test', '(11) 90000-0203',
   'inbound', 'demanda', '{posicionamento,trafego}', 2100, pg_temp.dia(0), pg_temp.dia(-2), pg_temp.dia(-2), null, null),
  ('b1000000-0000-4000-8000-000000000004', 'Hotel Serra Verde', 'Turismo', 'Hotel', 'prospeccao',
   'd0000000-0000-4000-8000-000000000002', 'Henrique', 'henrique@serraverde.test', '(11) 90000-0204',
   'indicacao', 'sistemas', '{sistemas}', 45000, pg_temp.dia(3), pg_temp.dia(-3), pg_temp.dia(-3), null,
   'Quer reservas e check-in num sistema só. Indicação da Imobiliária Porto Firme.'),
  ('b1000000-0000-4000-8000-000000000005', 'Lavanderia Bolha Azul', 'Serviços', 'Lavanderia', 'prospeccao',
   'd0000000-0000-4000-8000-000000000005', 'Priscila', 'priscila@bolhaazul.test', '(11) 90000-0205',
   'pago', 'demanda', '{trafego}', 1800, pg_temp.dia(-1), pg_temp.dia(-9), pg_temp.dia(-9), null, null),
  ('b1000000-0000-4000-8000-000000000006', 'Colégio Horizonte Azul', 'Educação', 'Escola particular', 'abordagem',
   'd0000000-0000-4000-8000-000000000005', 'Diretora Ana', 'ana@horizonteazul.test', '(11) 90000-0206',
   'inbound', 'demanda', '{posicionamento,trafego,comercial}', 5200, pg_temp.dia(1), pg_temp.dia(-15), pg_temp.dia(-5), null, null),
  ('b1000000-0000-4000-8000-000000000007', 'Barbearia Navalha Fina', 'Beleza', 'Barbearia', 'abordagem',
   'd0000000-0000-4000-8000-000000000005', 'Leandro', 'leandro@navalhafina.test', '(11) 90000-0207',
   'outbound', 'demanda', '{trafego}', 1900, pg_temp.dia(-2), pg_temp.dia(-18), pg_temp.dia(-11), null, null),
  ('b1000000-0000-4000-8000-000000000008', 'Marcenaria Veio Nobre', 'Indústria', 'Marcenaria', 'abordagem',
   'd0000000-0000-4000-8000-000000000002', 'Wagner', 'wagner@veionobre.test', '(11) 90000-0208',
   'indicacao', 'sistemas', '{sistemas}', 32000, pg_temp.dia(4), pg_temp.dia(-12), pg_temp.dia(-6), null,
   'Orçamento de móvel planejado ainda é feito em planilha.'),
  ('b1000000-0000-4000-8000-000000000009', 'Cervejaria Lúpulo Bravo', 'Bebidas', 'Cervejaria artesanal', 'abordagem',
   'd0000000-0000-4000-8000-000000000005', 'Igor', 'igor@lupulobravo.test', '(11) 90000-0209',
   'pago', 'demanda', '{posicionamento,trafego}', 3300, pg_temp.dia(2), pg_temp.dia(-10), pg_temp.dia(-3), null, null),
  ('b1000000-0000-4000-8000-000000000010', 'Clínica Vet Bem-Estar', 'Pet', 'Clínica veterinária', 'qualificacao',
   'd0000000-0000-4000-8000-000000000005', 'Dra. Tânia', 'tania@vetbemestar.test', '(11) 90000-0210',
   'inbound', 'demanda', '{trafego,comercial}', 3600, pg_temp.dia(1), pg_temp.dia(-20), pg_temp.dia(-4), null, null),
  ('b1000000-0000-4000-8000-000000000011', 'Escritório Contábil Balanço Certo', 'Contabilidade', 'Contabilidade', 'qualificacao',
   'd0000000-0000-4000-8000-000000000002', 'Edson', 'edson@balancocerto.test', '(11) 90000-0211',
   'outbound', 'sistemas', '{sistemas}', 38000, pg_temp.dia(2), pg_temp.dia(-25), pg_temp.dia(-7), null,
   'Portal do cliente para envio de documentos e automação de lembretes.'),
  ('b1000000-0000-4000-8000-000000000012', 'Loja Trama Fina', 'Moda', 'Loja de roupas', 'qualificacao',
   'd0000000-0000-4000-8000-000000000005', 'Valéria', 'valeria@tramafina.test', '(11) 90000-0212',
   'pago', 'demanda', '{trafego}', 2700, pg_temp.dia(0), pg_temp.dia(-14), pg_temp.dia(-2), null, null),
  ('b1000000-0000-4000-8000-000000000013', 'Restaurante Sabor da Terra', 'Alimentação', 'Restaurante', 'r1',
   'd0000000-0000-4000-8000-000000000002', 'Rogério', 'rogerio@sabordaterra.test', '(11) 90000-0213',
   'indicacao', 'demanda', '{posicionamento,trafego,comercial}', 4400, pg_temp.dia(2), pg_temp.dia(-21), pg_temp.dia(-3),
   pg_temp.hora(2, '10:00'), null),
  ('b1000000-0000-4000-8000-000000000014', 'Agência de Viagens Rota Livre', 'Turismo', 'Agência de viagens', 'r1',
   'd0000000-0000-4000-8000-000000000002', 'Mônica', 'monica@rotalivre.test', '(11) 90000-0214',
   'inbound', 'demanda', '{trafego,comercial}', 3900, pg_temp.dia(3), pg_temp.dia(-17), pg_temp.dia(-1),
   pg_temp.hora(3, '15:00'), null),
  ('b1000000-0000-4000-8000-000000000015', 'Laboratório Análise Viva', 'Saúde', 'Laboratório', 'r1',
   'd0000000-0000-4000-8000-000000000002', 'Dr. Caio', 'caio@analiseviva.test', '(11) 90000-0215',
   'outbound', 'sistemas', '{sistemas}', 65000, pg_temp.dia(1), pg_temp.dia(-30), pg_temp.dia(-6),
   pg_temp.hora(1, '11:00'), 'Resultados de exame por portal, com integração ao equipamento.'),
  ('b1000000-0000-4000-8000-000000000016', 'Rede de Farmácias Bem Viver', 'Saúde', 'Farmácia', 'r2',
   'd0000000-0000-4000-8000-000000000002', 'Adriana', 'adriana@bemviver.test', '(11) 90000-0216',
   'indicacao', 'demanda', '{posicionamento,trafego,comercial}', 7600, pg_temp.dia(2), pg_temp.dia(-34), pg_temp.dia(-5), null, null),
  ('b1000000-0000-4000-8000-000000000017', 'Transportadora Via Expressa', 'Logística', 'Transportadora', 'r2',
   'd0000000-0000-4000-8000-000000000002', 'Nelson', 'nelson@viaexpressa.test', '(11) 90000-0217',
   'outbound', 'sistemas', '{sistemas}', 88000, pg_temp.dia(1), pg_temp.dia(-40), pg_temp.dia(-4), null,
   'Rastreio de entrega e app do motorista. Decisão com a diretoria na próxima semana.'),
  ('b1000000-0000-4000-8000-000000000018', 'Odonto Vida Leve', 'Saúde', 'Clínica odontológica', 'r2',
   'd0000000-0000-4000-8000-000000000002', 'Dr. Mauro', 'mauro@vidaleve.test', '(11) 90000-0218',
   'inbound', 'demanda', '{trafego,comercial}', 4800, pg_temp.dia(0), pg_temp.dia(-26), pg_temp.dia(-2), null, null),
  ('b1000000-0000-4000-8000-000000000019', 'Café Tertúlia', 'Alimentação', 'Cafeteria', 'fechado',
   'd0000000-0000-4000-8000-000000000002', 'Lívia', 'livia@cafetertulia.test', '(11) 90000-0111',
   'indicacao', 'demanda', '{posicionamento,trafego,comercial}', 5200, null, pg_temp.dia(-45), pg_temp.dia(-12), null, null),
  ('b1000000-0000-4000-8000-000000000020', 'Studio Pilates Equilíbrio', 'Saúde', 'Estúdio de pilates', 'fechado',
   'd0000000-0000-4000-8000-000000000002', 'Carla', 'carla@pilatesequilibrio.test', '(11) 90000-0112',
   'inbound', 'demanda', '{posicionamento,comercial}', 3900, null, pg_temp.dia(-50), pg_temp.dia(-22), null, null),
  ('b1000000-0000-4000-8000-000000000021', 'Escritório Norma Jurídica', 'Jurídico', 'Advocacia', 'fechado',
   'd0000000-0000-4000-8000-000000000002', 'Dra. Beatriz', 'beatriz@normajuridica.test', '(11) 90000-0109',
   'outbound', 'demanda', '{posicionamento,comercial}', 24000, null, pg_temp.mes(-5), pg_temp.mes(-4) + 7, null, null);

insert into public.opportunities
  (id, name, segment, stage, owner_id, contact_name, channel, business_unit, estimated_value,
   motivo_id, motivo_obs, created_at, stage_changed_at)
select v.id::uuid, v.nome, v.segmento, v.estagio::public.opportunity_stage, v.dono::uuid, v.contato,
       v.canal::public.acquisition_channel, 'demanda', v.valor,
       (select m.id from public.motivos_de_saida m
         where m.pipeline_id = '10000000-0000-4000-8000-000000000001' and m.rotulo = v.motivo),
       v.obs, pg_temp.dia(v.criada), pg_temp.dia(v.saiu)
from (values
  ('b1000000-0000-4000-8000-000000000022', 'Pizzaria Forno de Pedra', 'Alimentação', 'perdido',
   'd0000000-0000-4000-8000-000000000002', 'Anselmo', 'inbound', 3000, 'Preço', 'Achou o combo acima do orçamento deste semestre.', -60, -18),
  ('b1000000-0000-4000-8000-000000000023', 'Loja de Móveis Casa Clara', 'Varejo', 'perdido',
   'd0000000-0000-4000-8000-000000000002', 'Simone', 'outbound', 4200, 'Escolheu concorrente', null, -70, -25),
  ('b1000000-0000-4000-8000-000000000024', 'Doceria Açúcar Mascavo', 'Alimentação', 'perdido',
   'd0000000-0000-4000-8000-000000000005', 'Elaine', 'pago', 1900, 'Sumiu depois da proposta', null, -45, -9),
  ('b1000000-0000-4000-8000-000000000025', 'Sorveteria Gelato Mio', 'Alimentação', 'descartado',
   'd0000000-0000-4000-8000-000000000005', 'Bruno', 'pago', 1500, 'Sem verba', null, -30, -27),
  ('b1000000-0000-4000-8000-000000000026', 'Mercadinho da Esquina', 'Varejo', 'descartado',
   'd0000000-0000-4000-8000-000000000005', 'Fernando', 'outbound', 1200, 'Nunca respondeu', null, -40, -20)
) as v(id, nome, segmento, estagio, dono, contato, canal, valor, motivo, obs, criada, saiu);

insert into public.contracts
  (id, client_id, opportunity_id, name, contract_type, business_unit, monthly_value, total_value,
   billing_months, start_date, delivery_deadline, delivered_at, payment_method, installments,
   status, billing_active, billing_paused_at, pause_reason, end_date, finished_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', null,
   'Tráfego e comercial', 'mrr', 'demanda', 4200.00, null, null, pg_temp.mes(-14) + 4, null, null,
   'pix', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', null,
   'Combo 3 frentes', 'mrr', 'demanda', 6400.00, null, null, pg_temp.mes(-11) + 2, null, null,
   'transferencia', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', null,
   'Tráfego mensal', 'mrr', 'demanda', 3400.00, null, null, pg_temp.mes(-9) + 9, null, null,
   'pix', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', null,
   'Posicionamento e tráfego', 'mrr', 'demanda', 3600.00, null, null, pg_temp.mes(-8) + 1, null, null,
   'credito', null, 'paused', false, pg_temp.mes(-1) + 5, 'Reforma da unidade, volta em dois meses.', null, null),
  ('c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000007', null,
   'Posicionamento', 'mrr', 'demanda', 3200.00, null, null, pg_temp.mes(-6) + 2, null, null,
   'pix', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000008', null,
   'Tráfego mensal', 'mrr', 'demanda', 2800.00, null, null, pg_temp.mes(-12) + 3, null, null,
   'pix', null, 'cancelled', false, null, null, pg_temp.mes(-2) + 10, null),
  ('c1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000011', 'b1000000-0000-4000-8000-000000000019',
   'Combo 3 frentes', 'mrr', 'demanda', 5200.00, null, null, pg_temp.dia(-10), null, null,
   'transferencia', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000012', 'b1000000-0000-4000-8000-000000000020',
   'Posicionamento e comercial', 'mrr', 'demanda', 3900.00, null, null, pg_temp.dia(-20), null, null,
   'pix', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000005', null,
   'Plataforma mensal', 'mrr', 'sistemas', 2400.00, null, null, pg_temp.mes(-3), null, null,
   'transferencia', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000010', null,
   'Sustentação e automações', 'mrr', 'sistemas', 3600.00, null, null, pg_temp.mes(-7), null, null,
   'transferencia', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000005', null,
   'CRM sob medida', 'tcv', 'sistemas', null, 80000.00, 8, pg_temp.mes(-7) + 3, pg_temp.mes(-3), pg_temp.mes(-3) + 12,
   'transferencia', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-000000000006', null,
   'Sistema de gestão de obras', 'tcv', 'sistemas', null, 144000.00, 12, pg_temp.mes(-5) + 6, pg_temp.mes(2), null,
   'transferencia', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000013', 'a1000000-0000-4000-8000-000000000010', null,
   'Automação de pedidos com IA', 'tcv', 'sistemas', null, 18000.00, 3, pg_temp.mes(-10) + 1, pg_temp.mes(-8), pg_temp.mes(-8) + 20,
   'pix', null, 'finished', false, null, null, null, pg_temp.mes(-7) + 1),
  ('c1000000-0000-4000-8000-000000000014', 'a1000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000021',
   'Reposicionamento de marca', 'tcv', 'demanda', null, 24000.00, 6, pg_temp.mes(-4) + 7, pg_temp.mes(-1), pg_temp.mes(-1) + 3,
   'transferencia', null, 'active', true, null, null, null, null),
  ('c1000000-0000-4000-8000-000000000015', 'a1000000-0000-4000-8000-000000000002', null,
   'Landing pages e campanha de lançamento', 'tcv', 'demanda', null, 12000.00, 4, pg_temp.mes(-2) + 1, pg_temp.mes(0) + 15, null,
   'credito', 4, 'active', true, null, null, null, null);

insert into public.contract_items (contract_id, front, value)
values
  ('c1000000-0000-4000-8000-000000000001', 'trafego',        2400.00),
  ('c1000000-0000-4000-8000-000000000001', 'comercial',      1800.00),
  ('c1000000-0000-4000-8000-000000000002', 'posicionamento', 2200.00),
  ('c1000000-0000-4000-8000-000000000002', 'trafego',        2200.00),
  ('c1000000-0000-4000-8000-000000000002', 'comercial',      2000.00),
  ('c1000000-0000-4000-8000-000000000003', 'trafego',        3400.00),
  ('c1000000-0000-4000-8000-000000000004', 'posicionamento', 1800.00),
  ('c1000000-0000-4000-8000-000000000004', 'trafego',        1800.00),
  ('c1000000-0000-4000-8000-000000000005', 'posicionamento', 3200.00),
  ('c1000000-0000-4000-8000-000000000006', 'trafego',        2800.00),
  ('c1000000-0000-4000-8000-000000000007', 'posicionamento', 1800.00),
  ('c1000000-0000-4000-8000-000000000007', 'trafego',        1800.00),
  ('c1000000-0000-4000-8000-000000000007', 'comercial',      1600.00),
  ('c1000000-0000-4000-8000-000000000008', 'posicionamento', 2100.00),
  ('c1000000-0000-4000-8000-000000000008', 'comercial',      1800.00),
  ('c1000000-0000-4000-8000-000000000009', 'sistemas',       2400.00),
  ('c1000000-0000-4000-8000-000000000010', 'sistemas',       3600.00),
  ('c1000000-0000-4000-8000-000000000011', 'sistemas',      80000.00),
  ('c1000000-0000-4000-8000-000000000012', 'sistemas',     144000.00),
  ('c1000000-0000-4000-8000-000000000013', 'sistemas',      18000.00),
  ('c1000000-0000-4000-8000-000000000014', 'posicionamento',16000.00),
  ('c1000000-0000-4000-8000-000000000014', 'comercial',      8000.00),
  ('c1000000-0000-4000-8000-000000000015', 'posicionamento', 6000.00),
  ('c1000000-0000-4000-8000-000000000015', 'trafego',        6000.00);

insert into public.contract_shares (contract_id, profile_id, kind, share_pct)
values
  ('c1000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000002', 'venda', 8),
  ('c1000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000002', 'venda', 8);

insert into public.expenses
  (description, amount, category, business_unit, recurrence, installments_total, installments_paid,
   start_date, vendor, created_by)
values
  ('Aluguel do escritório',          3500.00, 'estrutural',  'compartilhado', 'mensal',    null, 0, pg_temp.mes(-15), 'Imobiliária (exemplo)', 'd0000000-0000-4000-8000-000000000001'),
  ('Contabilidade',                   900.00, 'estrutural',  'compartilhado', 'mensal',    null, 0, pg_temp.mes(-15), 'Escritório contábil (exemplo)', 'd0000000-0000-4000-8000-000000000001'),
  ('Internet e telefonia',            320.00, 'estrutural',  'compartilhado', 'mensal',    null, 0, pg_temp.mes(-15), null, 'd0000000-0000-4000-8000-000000000001'),
  ('Softwares e assinaturas',        1100.00, 'operacional', 'compartilhado', 'mensal',    null, 0, pg_temp.mes(-15), null, 'd0000000-0000-4000-8000-000000000001'),
  ('Ferramentas de anúncio e relatório', 480.00, 'operacional', 'demanda',   'mensal',    null, 0, pg_temp.mes(-12), null, 'd0000000-0000-4000-8000-000000000001'),
  ('Servidores e banco de dados',     390.00, 'operacional', 'sistemas',      'mensal',    null, 0, pg_temp.mes(-10), null, 'd0000000-0000-4000-8000-000000000001'),
  ('Notebooks da equipe',             620.00, 'divida',      'compartilhado', 'parcelado', 10,   4, pg_temp.mes(-4),  null, 'd0000000-0000-4000-8000-000000000001');

insert into public.payroll
  (profile_id, person_name, job_title, work_kind, monthly_cost, benefits, commission_pct, business_unit, start_date)
values
  ('d0000000-0000-4000-8000-000000000001', 'Helena Duarte', 'Sócia e diretora',  'socio', 6000.00,   0.00, null, 'compartilhado', pg_temp.mes(-15)),
  ('d0000000-0000-4000-8000-000000000002', 'Rodrigo Moura',  'Sócio comercial',   'socio', 5500.00,   0.00, null, 'demanda',       pg_temp.mes(-15)),
  ('d0000000-0000-4000-8000-000000000003', 'Camila Rocha',  'Gestora de contas', 'clt',   4200.00, 600.00, null, 'demanda',       pg_temp.mes(-15)),
  ('d0000000-0000-4000-8000-000000000004', 'Diego Fontes',  'Líder de Sistemas', 'pj',    6000.00,   0.00, null, 'sistemas',      pg_temp.mes(-11)),
  ('d0000000-0000-4000-8000-000000000005', 'Larissa Prado', 'SDR',               'clt',   2200.00, 450.00, 5,    'demanda',       pg_temp.mes(-9)),
  ('d0000000-0000-4000-8000-000000000006', 'Tiago Mendes',  'Gestor de tráfego', 'pj',    3500.00,   0.00, null, 'demanda',       pg_temp.mes(-14)),
  ('d0000000-0000-4000-8000-000000000007', 'Bianca Lopes',  'Designer',          'pj',    3000.00,   0.00, null, 'demanda',       pg_temp.mes(-13)),
  ('d0000000-0000-4000-8000-000000000008', 'Otávio Reis',   'Desenvolvedor',     'pj',    4500.00,   0.00, null, 'sistemas',      pg_temp.mes(-7));

insert into public.internal_tasks
  (title, category, task_type, col, priority, assignee_id, client_id, opportunity_id, due_date, created_by)
values
  ('Relatório de performance de outubro', 'Tráfego · performance', 'Relatório de performance', 'todo', 'alta',
   'd0000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000001', null, pg_temp.dia(2), 'd0000000-0000-4000-8000-000000000003'),
  ('Teste A/B dos criativos de inverno', 'Tráfego · performance', 'Teste A/B de criativo', 'doing', 'media',
   'd0000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000003', null, pg_temp.dia(4), 'd0000000-0000-4000-8000-000000000003'),
  ('Cronograma editorial de novembro', 'Posicionamento · conteúdo', 'Cronograma editorial do mês', 'doing', 'alta',
   'd0000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000002', null, pg_temp.dia(1), 'd0000000-0000-4000-8000-000000000003'),
  ('Carrossel: 5 cuidados depois do clareamento', 'Posicionamento · conteúdo', 'Carrossel', 'review', 'media',
   'd0000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000002', null, pg_temp.dia(0), 'd0000000-0000-4000-8000-000000000003'),
  ('Fazer follow-up da proposta', 'Comercial · vendas', 'Fazer follow-up', 'todo', 'urgente',
   'd0000000-0000-4000-8000-000000000002', null, 'b1000000-0000-4000-8000-000000000016', pg_temp.dia(-1), 'd0000000-0000-4000-8000-000000000002'),
  ('Preparar pauta da R1', 'Comercial · vendas', 'Preparar pauta de R1', 'todo', 'alta',
   'd0000000-0000-4000-8000-000000000002', null, 'b1000000-0000-4000-8000-000000000013', pg_temp.dia(1), 'd0000000-0000-4000-8000-000000000002'),
  ('Montar lista de prospecção: clínicas da zona sul', 'Comercial · vendas', 'Montar lista de prospecção', 'doing', 'media',
   'd0000000-0000-4000-8000-000000000005', null, null, pg_temp.dia(3), 'd0000000-0000-4000-8000-000000000002'),
  ('Elaborar proposta do app do motorista', 'Comercial · vendas', 'Elaborar proposta', 'review', 'alta',
   'd0000000-0000-4000-8000-000000000004', null, 'b1000000-0000-4000-8000-000000000017', pg_temp.dia(1), 'd0000000-0000-4000-8000-000000000002'),
  ('Tela de medições da obra', 'Sistemas & IA · software', 'Desenvolver tela / componente', 'doing', 'alta',
   'd0000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000006', null, pg_temp.dia(5), 'd0000000-0000-4000-8000-000000000004'),
  ('Revisão de RLS do módulo financeiro', 'Sistemas & IA · software', 'Revisão de RLS e segurança', 'todo', 'urgente',
   'd0000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000006', null, pg_temp.dia(2), 'd0000000-0000-4000-8000-000000000004'),
  ('Integração com o ERP da distribuidora', 'Sistemas & IA · software', 'Integração / API', 'todo', 'media',
   'd0000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000010', null, pg_temp.dia(9), 'd0000000-0000-4000-8000-000000000004'),
  ('Corrigir filtro de imóveis por bairro', 'Sistemas & IA · software', 'Correção de bug', 'done', 'alta',
   'd0000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000005', null, pg_temp.dia(-3), 'd0000000-0000-4000-8000-000000000004'),
  ('Consolidar números do mês', 'Gestão · operação', 'Consolidar números do mês', 'todo', 'alta',
   'd0000000-0000-4000-8000-000000000001', null, null, pg_temp.dia(6), 'd0000000-0000-4000-8000-000000000001'),
  ('Relatório mensal da escola', 'Gestão · operação', 'Relatório mensal do cliente', 'todo', 'media',
   'd0000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000007', null, pg_temp.dia(-2), 'd0000000-0000-4000-8000-000000000003'),
  ('Documentar o processo de aprovação de post', 'Gestão · operação', 'Documentar processo', 'done', 'baixa',
   'd0000000-0000-4000-8000-000000000003', null, null, pg_temp.dia(-5), 'd0000000-0000-4000-8000-000000000001'),
  ('Estudar automação de relatórios', 'Gestão · operação', 'Estudo / pesquisa', 'todo', 'baixa',
   null, null, null, null, 'd0000000-0000-4000-8000-000000000001');

insert into public.meetings
  (id, titulo, tipo, starts_at, duration_minutes, client_id, opportunity_id, organizer_id, local, notas)
values
  ('e1000000-0000-4000-8000-000000000001', 'Kick-off Café Tertúlia', 'kickoff_cliente', pg_temp.hora(-8, '10:00'), 60,
   'a1000000-0000-4000-8000-000000000011', null, 'd0000000-0000-4000-8000-000000000003', 'Online',
   'Briefing revisado item por item. Meta dos 30 dias: 40 pedidos pelo Instagram. Acessos do gerenciador de anúncios pendentes.'),
  ('e1000000-0000-4000-8000-000000000002', 'Alinhamento do cronograma da obra', 'alinhamento_cliente', pg_temp.hora(-2, '14:00'), 45,
   'a1000000-0000-4000-8000-000000000006', null, 'd0000000-0000-4000-8000-000000000004', 'Escritório do cliente',
   'Tela de medições entra na próxima entrega. Cliente pediu relatório semanal em PDF.'),
  ('e1000000-0000-4000-8000-000000000003', 'Planejamento do mês', 'planejamento', pg_temp.hora(-5, '09:00'), 90,
   null, null, 'd0000000-0000-4000-8000-000000000001', 'Sala de reunião', null),
  ('e1000000-0000-4000-8000-000000000004', 'Resultados do trimestre', 'apresentacao_de_resultados', pg_temp.hora(3, '11:00'), 60,
   'a1000000-0000-4000-8000-000000000001', null, 'd0000000-0000-4000-8000-000000000003', 'Online', null),
  ('e1000000-0000-4000-8000-000000000005', 'Proposta do app do motorista', 'proposta_para_prospect', pg_temp.hora(1, '16:00'), 60,
   null, 'b1000000-0000-4000-8000-000000000017', 'd0000000-0000-4000-8000-000000000002', 'Online', null),
  ('e1000000-0000-4000-8000-000000000006', 'Semanal do time', 'semanal_de_time', pg_temp.hora(4, '09:00'), 45,
   null, null, 'd0000000-0000-4000-8000-000000000001', 'Sala de reunião', null),
  ('e1000000-0000-4000-8000-000000000007', 'Um a um: Larissa', 'um_a_um', pg_temp.hora(2, '17:00'), 30,
   null, null, 'd0000000-0000-4000-8000-000000000001', 'Online', null);

insert into public.meeting_attendees (meeting_id, profile_id)
values
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003'),
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006'),
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000007'),
  ('e1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000008'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003'),
  ('e1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000006'),
  ('e1000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001'),
  ('e1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000003'),
  ('e1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000005'),
  ('e1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006'),
  ('e1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000007'),
  ('e1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000008'),
  ('e1000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001'),
  ('e1000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000005');

update public.products p
   set price = v.preco
  from (values
    ('Frente 01 · Posicionamento',              1800.00),
    ('Frente 02 · Tráfego',                     1600.00),
    ('Frente 03 · Comercial',                   1500.00),
    ('Combo 3 frentes · semestral',             4400.00),
    ('Frente 04 · Sistemas (plataforma mensal)', 1900.00),
    ('Sistema sob medida',                     60000.00),
    ('Automação com IA',                       18000.00)
  ) as v(nome, preco)
 where lower(p.name) = lower(v.nome);

update public.app_settings
   set value = '{"tcv_alvo": 90000, "r1_semana": 8, "mrr_mensal": 30000, "_confirmado": true, "toques_semana": 120}'::jsonb
 where key = 'metas';

update public.fiscal_settings set tax_pct = 6.00, source = 'Simples Nacional (valor de exemplo)', is_provisional = false;
update public.gateway_fees set fee_pct = round(2.50 + installments * 0.80, 2);
update public.payment_method_fees set variable_pct = 3.50 where method = 'credito';

insert into public.proposals
  (id, opportunity_id, status, valida_ate, escopo, prazo_entrega_dias, forma_pagamento,
   parcelas_projeto, fidelidade_meses, enviada_em, enviada_por)
values
  ('f1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000016', 'enviada', pg_temp.dia(9),
   'Posicionamento da marca nas 6 lojas, campanhas de tráfego por bairro e estruturação do comercial pelo WhatsApp.',
   null, 'transferencia', null, 6, pg_temp.hora(-5, '18:00'), 'd0000000-0000-4000-8000-000000000002'),
  ('f1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000017', 'enviada', pg_temp.dia(12),
   'Painel de rastreio de entregas, app do motorista com comprovante por foto e integração com o sistema de notas.',
   120, 'transferencia', 10, null, pg_temp.hora(-3, '11:30'), 'd0000000-0000-4000-8000-000000000002'),
  ('f1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000018', 'rascunho', pg_temp.dia(15),
   'Tráfego para implante e ortodontia, com roteiro de atendimento para a recepção.',
   null, 'pix', null, 3, null, null);

insert into public.proposal_items
  (proposal_id, product_id, nome, descricao, front, combo_fronts, business_unit, contract_type,
   preco_catalogo, valor, ordem)
select v.proposta::uuid, p.id, p.name, p.description, p.front, p.combo_fronts, p.business_unit,
       p.contract_type, p.price, v.valor, v.ordem
  from (values
    ('f1000000-0000-4000-8000-000000000001', 'Combo 3 frentes · semestral', 7200.00, 1),
    ('f1000000-0000-4000-8000-000000000002', 'Sistema sob medida',         84000.00, 1),
    ('f1000000-0000-4000-8000-000000000002', 'Frente 04 · Sistemas (plataforma mensal)', 2400.00, 2),
    ('f1000000-0000-4000-8000-000000000003', 'Frente 02 · Tráfego',         1600.00, 1),
    ('f1000000-0000-4000-8000-000000000003', 'Frente 03 · Comercial',       1500.00, 2)
  ) as v(proposta, produto, valor, ordem)
  join public.products p on lower(p.name) = lower(v.produto);

select set_config('request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.iniciar_jornada('a1000000-0000-4000-8000-000000000011');
select public.iniciar_jornada('a1000000-0000-4000-8000-000000000012');

set role authenticated;
do $$
declare r record;
begin
  perform public.liberar_etapa(p.id, false)
     from public.onboarding_phases p join public.onboarding_journeys j on j.id = p.journey_id
    where p.ordem = 0
      and j.client_id in ('a1000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000012');
  for r in
    select t.id from public.onboarding_tasks t
      join public.onboarding_phases p on p.id = t.phase_id
      join public.onboarding_journeys j on j.id = p.journey_id
     where (j.client_id = 'a1000000-0000-4000-8000-000000000012' and (p.ordem = 0 or (p.ordem = 1 and t.ordem <= 3)))
        or (j.client_id = 'a1000000-0000-4000-8000-000000000011' and p.ordem = 0 and t.ordem <= 3)
     order by j.client_id, p.ordem, t.ordem
  loop
    update public.onboarding_tasks set concluida_em = now() where id = r.id;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claims', '', false);

select private.fn_gravar_snapshot(pg_temp.mes(m)) from generate_series(-6, -1) as m;
