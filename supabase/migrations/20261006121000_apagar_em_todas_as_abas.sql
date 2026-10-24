create or replace function private.fn_apagar_jornada(p_journey_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cartoes uuid[];
  v_n       int;
begin
  perform 1 from public.onboarding_phases where journey_id = p_journey_id for update;

  select coalesce(array_agg(t.internal_task_id), '{}')
    into v_cartoes
    from public.onboarding_tasks t
    join public.onboarding_phases f on f.id = t.phase_id
   where f.journey_id = p_journey_id
     and t.internal_task_id is not null;

  delete from public.onboarding_journeys where id = p_journey_id;

  delete from public.internal_tasks it
   where it.id = any (v_cartoes)
      or it.raiz_recorrente = any (v_cartoes);
  get diagnostics v_n = row_count;

  return v_n;
end;
$$;

revoke all on function private.fn_apagar_jornada(uuid) from public, anon, authenticated;

create or replace function public.apagar_jornada(p_journey_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    perform private.negar('apagar_jornada');
  end if;

  perform 1 from public.onboarding_journeys where id = p_journey_id for update;
  if not found then
    raise exception 'Jornada não encontrada. Ela pode já ter sido apagada em outra tela.'
      using errcode = 'P0002';
  end if;

  return private.fn_apagar_jornada(p_journey_id);
end;
$$;

revoke all on function public.apagar_jornada(uuid) from public, anon;
grant execute on function public.apagar_jornada(uuid) to authenticated;

create or replace function public.apagar_cliente(p_client_id uuid)
returns table (contratos_apagados int, jornadas_apagadas int, posts_apagados int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contratos int;
  v_jornadas  int := 0;
  v_posts     int;
  r           record;
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('apagar_cliente');
  end if;

  perform 1 from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente não encontrado. Ele pode já ter sido apagado em outra tela.'
      using errcode = 'P0002';
  end if;

  select count(*) into v_posts from public.content_posts where client_id = p_client_id;

  for r in select id from public.onboarding_journeys where client_id = p_client_id loop
    perform private.fn_apagar_jornada(r.id);
    v_jornadas := v_jornadas + 1;
  end loop;

  delete from public.contracts where client_id = p_client_id;
  get diagnostics v_contratos = row_count;

  delete from public.meetings
   where client_id = p_client_id
     and tipo in ('kickoff_cliente', 'semanal_cliente', 'alinhamento_cliente',
                  'apresentacao_de_resultados', 'renovacao_ou_upsell',
                  'entregas_do_cliente', 'alinhamento_interno_sobre_cliente');

  delete from public.clients where id = p_client_id;

  return query select v_contratos, v_jornadas, v_posts;
end;
$$;

revoke all on function public.apagar_cliente(uuid) from public, anon;
grant execute on function public.apagar_cliente(uuid) to authenticated;

create or replace function private.fn_oportunidade_leva_reuniao_de_proposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.meetings
   where opportunity_id = old.id
     and tipo = 'proposta_para_prospect';
  return old;
end;
$$;

revoke all on function private.fn_oportunidade_leva_reuniao_de_proposta() from public, anon, authenticated;

drop trigger if exists trg_opportunities_leva_reuniao_de_proposta on public.opportunities;
create trigger trg_opportunities_leva_reuniao_de_proposta
  before delete on public.opportunities
  for each row execute function private.fn_oportunidade_leva_reuniao_de_proposta();

create or replace function public.apagar_pipeline(p_pipeline_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ativo boolean;
  v_opps  int;
begin
  if not (public.is_staff() and coalesce(public.current_app_role() in ('owner', 'manager'), false)) then
    perform private.negar('apagar_pipeline');
  end if;

  select ativo into v_ativo from public.pipelines where id = p_pipeline_id for update;
  if not found then
    raise exception 'Pipeline não encontrado. Ele pode já ter sido apagado em outra tela.'
      using errcode = 'P0002';
  end if;

  if p_pipeline_id = '10000000-0000-4000-8000-000000000001' then
    raise exception 'O pipeline padrão não pode ser apagado: oportunidade nova entra nele quando ninguém escolhe outro. Arquive-o se não for mais usado.'
      using errcode = '23514';
  end if;

  select count(*) into v_opps from public.opportunities where pipeline_id = p_pipeline_id;
  if v_opps > 0 then
    raise exception 'Este pipeline tem % oportunidade(s). Apague-as antes de apagar o pipeline, ou arquive o pipeline.', v_opps
      using errcode = '23503';
  end if;

  if v_ativo and not exists (
    select 1 from public.pipelines where ativo and id <> p_pipeline_id
  ) then
    raise exception 'Este é o único pipeline ativo. Reative outro antes de apagar este.'
      using errcode = '23514';
  end if;

  delete from public.motivos_de_saida where pipeline_id = p_pipeline_id;
  delete from public.pipeline_campos  where pipeline_id = p_pipeline_id;
  delete from public.pipeline_stages  where pipeline_id = p_pipeline_id;
  delete from public.pipelines        where id = p_pipeline_id;
end;
$$;

revoke all on function public.apagar_pipeline(uuid) from public, anon;
grant execute on function public.apagar_pipeline(uuid) to authenticated;

