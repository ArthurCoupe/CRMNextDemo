create table public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  description text,
  owner_only  boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create trigger trg_app_settings_updated
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create policy "settings: staff lê o que não é restrito"
  on public.app_settings for select
  using (public.is_staff() and not owner_only);

create policy "settings: owner lê tudo"
  on public.app_settings for select
  using (public.is_owner());

create policy "settings: só owner escreve"
  on public.app_settings for all
  using (public.is_owner()) with check (public.is_owner());

insert into public.app_settings (key, value, description, owner_only) values
  ('metas',
   '{"mrr_mensal": 30000, "tcv_alvo": 90000, "toques_semana": 120, "r1_semana": 8, "_confirmado": false}'::jsonb,
   'Metas da operação. Alimentam as barras de progresso e o break-even.', true),

  ('share_warning_pct',
   '{"pct": 60, "_confirmado": false}'::jsonb,
   'A partir de qual soma de participações o sistema alerta o owner.', true);

insert into public.app_settings (key, value, description, owner_only) values
  ('qualification_questions',
   '{
      "version": 1,
      "tiers": {"A": 6, "B": 4},
      "questions": [
        {"key": "investimento", "label": "Q1 · Orçamento",
         "prompt": "Existe orçamento reservado para este projeto? Em que faixa?",
         "options": [
           {"points": 0, "label": "Sem orçamento previsto", "ko": true},
           {"points": 1, "label": "Até R$ 2.000/mês"},
           {"points": 2, "label": "R$ 2.000 a 5.000/mês"},
           {"points": 2, "label": "Acima de R$ 5.000/mês"}
         ]},
        {"key": "decisor", "label": "Q2 · Decisão",
         "prompt": "Quem aprova a contratação na empresa?",
         "options": [
           {"points": 0, "label": "Não sabe quem aprova", "ko": true},
           {"points": 1, "label": "Diretoria ou comitê"},
           {"points": 1, "label": "Aprova junto com um sócio"},
           {"points": 2, "label": "Aprova sozinho"}
         ]},
        {"key": "dor", "label": "Q3 · Necessidade",
         "prompt": "Qual problema vocês querem resolver primeiro?",
         "options": [
           {"points": 0, "label": "Nenhum problema claro", "ko": true},
           {"points": 1, "label": "Concorda quando o problema é apontado"},
           {"points": 2, "label": "Vendas"},
           {"points": 2, "label": "Operação"},
           {"points": 2, "label": "Atendimento"}
         ]},
        {"key": "prazo", "label": "Q4 · Prazo",
         "prompt": "Para quando vocês precisam do resultado?",
         "options": [
           {"points": 0, "label": "Sem data"},
           {"points": 1, "label": "Acima de 90 dias"},
           {"points": 1, "label": "Entre 60 e 90 dias"},
           {"points": 2, "label": "Entre 30 e 60 dias"},
           {"points": 2, "label": "Até 30 dias"}
         ]}
      ]
    }'::jsonb,
   'Catálogo das perguntas de qualificação. A resposta congela os pontos; mudar aqui não reescreve o passado.',
   false);
