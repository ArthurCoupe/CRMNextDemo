drop policy if exists "ai_conversations: cada um so a sua" on public.ai_conversations;
create policy "ai_conversations: cada um so a sua"
  on public.ai_conversations for all
  using (public.is_staff() and profile_id = auth.uid())
  with check (public.is_staff() and profile_id = auth.uid());

drop policy if exists "ai_messages: le quem e dono da conversa" on public.ai_messages;
create policy "ai_messages: le quem e dono da conversa"
  on public.ai_messages for select
  using (
    public.is_staff()
    and exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.profile_id = auth.uid()
    )
  );

drop policy if exists "ai_messages: grava quem e dono da conversa" on public.ai_messages;
create policy "ai_messages: grava quem e dono da conversa"
  on public.ai_messages for insert
  with check (
    public.is_staff()
    and exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.profile_id = auth.uid()
    )
  );

revoke update on public.profiles from authenticated;
grant update (full_name, role, job_title, avatar_url, initials, active)
  on public.profiles to authenticated;

create or replace function public.save_client_and_contract(
  p_opportunity_id    uuid,
  p_client_name       text,
  p_client_owner_id   uuid,
  p_contract_name     text,
  p_type              contract_type,
  p_bu                business_unit,
  p_items             jsonb,
  p_start_date        date,
  p_client_segment    text           default null,
  p_client_nicho      text           default null,
  p_contact_name      text           default null,
  p_contact_email     text           default null,
  p_contact_phone     text           default null,
  p_client_status     client_status  default 'onboarding',
  p_monthly           numeric        default null,
  p_total             numeric        default null,
  p_billing_months    integer        default null,
  p_duration_months   integer        default null,
  p_commitment_months integer        default null,
  p_is_firm           boolean        default true,
  p_end_date          date           default null,
  p_delivery_deadline date           default null,
  p_payment_method    payment_method default 'transferencia',
  p_installments      integer        default null,
  p_is_commissionable boolean        default true,
  p_notes             text           default null,
  p_shares            jsonb          default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_client_id   uuid;
  v_contract_id uuid;
  v_share       jsonb;
  v_pct         numeric;
  v_duplicadas  int;
  v_stage       opportunity_stage;
begin
  if not public.is_owner() then
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

create or replace function public.pode_apagar_cartao(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
      from public.onboarding_tasks o
      join public.onboarding_phases f on f.id = o.phase_id
     where o.internal_task_id = p_task_id
       and not private.pode_mexer_na_jornada(f.journey_id)
  );
$$;

revoke execute on function public.pode_apagar_cartao(uuid) from public, anon;
grant execute on function public.pode_apagar_cartao(uuid) to authenticated;

drop policy if exists "owner e manager apagam" on public.internal_tasks;
create policy "owner e manager apagam"
  on public.internal_tasks for delete
  using (
    public.is_staff()
    and (
      public.is_owner()
      or (
        public.current_app_role() = 'manager'
        and public.pode_apagar_cartao(id)
      )
    )
  );

revoke execute on function private.toca_conversa_da_mensagem()        from public, anon;
revoke execute on function private.scripts_carimba_autor()            from public, anon;
revoke execute on function private.playbook_sections_carimba_editor() from public, anon;
revoke execute on function private.script_usage_log_carimba_autor()   from public, anon;
revoke execute on function private.meetings_carimba_organizador()     from public, anon;
revoke execute on function private.recusa_participante_client()       from public, anon;
