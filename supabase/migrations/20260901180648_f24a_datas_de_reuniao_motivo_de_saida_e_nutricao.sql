alter table public.opportunities
  add column r1_agendada_em  timestamptz,
  add column r1_realizada_em timestamptz,
  add column r2_agendada_em  timestamptz,
  add column r2_realizada_em timestamptz;

create type public.motivo_descarte as enum (
  'sem_verba','sem_autoridade','fora_do_icp',
  'nunca_respondeu','curioso_ou_concorrente','dado_invalido'
);

create type public.motivo_perda as enum (
  'preco','escolheu_concorrente','timing_adiou',
  'desengajou','sumiu_pos_proposta','sem_fit_de_solucao'
);

alter table public.opportunities
  add column motivo_descarte public.motivo_descarte,
  add column motivo_perda    public.motivo_perda,
  add column motivo_obs      text;

alter table public.opportunities
  add column em_nutricao boolean not null default false,
  add column nutrir_ate  date;

alter table public.clients
  add column confidencial      boolean not null default false,
  add column confidencial_nota text;

alter table public.opportunities
  add constraint opportunities_motivo_por_estagio check (
    (stage <> 'descartado' or motivo_descarte is not null) and
    (stage <> 'perdido'    or motivo_perda    is not null)
  );

create function private.opportunities_limpa_motivo_por_estagio()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.stage = 'perdido' then
    new.motivo_descarte := null;
  elsif new.stage = 'descartado' then
    new.motivo_perda := null;
  else
    new.motivo_descarte := null;
    new.motivo_perda := null;
    new.motivo_obs := null;
  end if;
  return new;
end;
$$;

create trigger trg_opportunities_limpa_motivo
  before update on public.opportunities
  for each row
  execute function private.opportunities_limpa_motivo_por_estagio();

revoke execute on function private.opportunities_limpa_motivo_por_estagio()
  from public, anon, authenticated;

grant select (
  em_nutricao, motivo_descarte, motivo_obs, motivo_perda, nutrir_ate,
  r1_agendada_em, r1_realizada_em, r2_agendada_em, r2_realizada_em
) on public.opportunities to authenticated;

grant update (
  em_nutricao, motivo_descarte, motivo_obs, motivo_perda, nutrir_ate,
  r1_agendada_em, r1_realizada_em, r2_agendada_em, r2_realizada_em
) on public.opportunities to authenticated;
