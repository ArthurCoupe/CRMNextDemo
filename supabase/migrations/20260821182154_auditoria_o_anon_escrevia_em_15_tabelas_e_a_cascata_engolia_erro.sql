revoke insert, update, delete on all tables in schema public from anon;

create or replace function private.fn_avanca_quando_etapa_fecha()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_journey  uuid;
  v_ordem    smallint;
  v_prox     uuid;
  v_pendente boolean;
begin
  select f.journey_id, f.ordem into v_journey, v_ordem
    from public.onboarding_phases f
   where f.id = new.phase_id
     for update;

  if v_journey is null then
    return null;
  end if;

  select exists (select 1 from public.onboarding_tasks o
                  where o.phase_id = new.phase_id and o.concluida_em is null)
    into v_pendente;

  if v_pendente then
    begin
      update public.onboarding_journeys
         set concluida_em = null
       where id = v_journey and concluida_em is not null;
    exception when others then
      raise warning 'fn_avanca_quando_etapa_fecha: reabertura da jornada % engolida [%] %',
        v_journey, sqlstate, sqlerrm;
    end;
    return null;
  end if;

  select f.id into v_prox
    from public.onboarding_phases f
   where f.journey_id = v_journey and f.ordem = v_ordem + 1 and f.liberada_em is null;

  if v_prox is null then
    if not exists (
      select 1 from public.onboarding_phases f
       where f.journey_id = v_journey
         and (f.liberada_em is null
              or exists (select 1 from public.onboarding_tasks o
                          where o.phase_id = f.id and o.concluida_em is null))
    ) then
      begin
        update public.onboarding_journeys
           set concluida_em = coalesce(concluida_em, now())
         where id = v_journey;
      exception when others then
        raise warning 'fn_avanca_quando_etapa_fecha: conclusao da jornada % engolida [%] %',
          v_journey, sqlstate, sqlerrm;
      end;
    end if;
    return null;
  end if;

  begin
    perform private.fn_libera_etapa(v_prox, false);
  exception when others then
    raise warning 'fn_avanca_quando_etapa_fecha: liberacao da etapa % engolida [%] %',
      v_prox, sqlstate, sqlerrm;
  end;

  return null;
end $function$;

revoke all on function private.fn_avanca_quando_etapa_fecha() from public, anon, authenticated;

