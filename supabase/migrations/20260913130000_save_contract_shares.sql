create or replace function public.save_contract_shares(p_contract_id uuid, p_shares jsonb)
returns setof public.contract_shares
language plpgsql security definer set search_path = public as $$
declare
  v_share      jsonb;
  v_kind       text;
  v_pct        numeric;
  v_ids        uuid[];
  v_duplicadas int;
  v_estranhos  int;
begin
  if not public.is_owner() then
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
end $$;

revoke execute on function public.save_contract_shares(uuid, jsonb) from public, anon;
grant execute on function public.save_contract_shares(uuid, jsonb) to authenticated, service_role;
