create policy "quem edita a tarefa altera"
  on public.internal_task_links for update to authenticated
  using (public.is_staff() and public.pode_editar_tarefa(task_id))
  with check (public.is_staff() and public.pode_editar_tarefa(task_id));

grant update (label, url) on table public.internal_task_links to authenticated;

create or replace function public.editar_item_da_jornada(
  p_item_id uuid,
  p_titulo text,
  p_prazo_em_dias integer,
  p_papel text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fase         uuid;
  v_jornada      uuid;
  v_ancora       date;
  v_titulo       text := btrim(p_titulo);
  v_papel        text := btrim(p_papel);
  v_cartao       uuid;
  v_titulo_antes text;
  v_prazo_antes  smallint;
  v_concluida_em timestamptz;
begin
  if not coalesce(public.current_app_role() in ('owner', 'manager'), false) then
    perform private.negar('editar_item_da_jornada');
  end if;

  select o.phase_id into v_fase from public.onboarding_tasks o where o.id = p_item_id;
  if v_fase is null then
    raise exception 'Item não encontrado. Recarregue a jornada.' using errcode = 'P0002';
  end if;

  perform 1
    from public.onboarding_journeys j
   where j.id = (select f.journey_id from public.onboarding_phases f where f.id = v_fase)
     for update;

  select f.journey_id,
         coalesce(j.dia_zero, (j.iniciada_em at time zone 'America/Sao_Paulo')::date)
    into v_jornada, v_ancora
    from public.onboarding_phases f
    join public.onboarding_journeys j on j.id = f.journey_id
   where f.id = v_fase
     for update of f;

  if v_jornada is null then
    raise exception 'Item não encontrado. Recarregue a jornada.' using errcode = 'P0002';
  end if;

  if not coalesce(private.pode_mexer_na_jornada(v_jornada), false) then
    perform private.negar('editar_item_da_jornada');
  end if;

  if v_titulo is null or v_titulo !~ '\S' or char_length(v_titulo) > 200 then
    raise exception 'O título do item precisa ter de 1 a 200 caracteres.'
      using errcode = '22023';
  end if;

  if p_prazo_em_dias is null or p_prazo_em_dias not between 0 and 365 then
    raise exception 'O prazo do item é um número inteiro de dias, de 0 a 365.'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.role_assignments ra where ra.role_key = v_papel) then
    raise exception 'O papel "%" não existe. Escolha um dos papéis da lista.', coalesce(v_papel, '')
      using errcode = '22023';
  end if;

  select o.internal_task_id into v_cartao from public.onboarding_tasks o where o.id = p_item_id;
  if v_cartao is not null then
    perform 1 from public.internal_tasks t where t.id = v_cartao for update;
  end if;

  select o.titulo, o.deadline_days, o.concluida_em
    into v_titulo_antes, v_prazo_antes, v_concluida_em
    from public.onboarding_tasks o
   where o.id = p_item_id
     for update;

  update public.onboarding_tasks
     set titulo = v_titulo,
         deadline_days = p_prazo_em_dias,
         papel = v_papel
   where id = p_item_id;

  if v_cartao is not null and v_concluida_em is null then
    update public.internal_tasks
       set title = v_titulo
     where id = v_cartao
       and title = v_titulo_antes;

    update public.internal_tasks
       set due_date = v_ancora + p_prazo_em_dias
     where id = v_cartao
       and due_date is not distinct from v_ancora + v_prazo_antes;
  end if;
end;
$$;

revoke all on function public.editar_item_da_jornada(uuid, text, integer, text) from public, anon;
grant execute on function public.editar_item_da_jornada(uuid, text, integer, text) to authenticated;

create or replace function public.editar_etapa_da_jornada(
  p_phase_id uuid,
  p_descricao text,
  p_responsavel text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jornada     uuid;
  v_descricao   text := btrim(p_descricao);
  v_responsavel text := btrim(p_responsavel);
begin
  if not coalesce(public.current_app_role() in ('owner', 'manager'), false) then
    perform private.negar('editar_etapa_da_jornada');
  end if;

  select f.journey_id into v_jornada
    from public.onboarding_phases f
   where f.id = p_phase_id
     for update;
  if v_jornada is null then
    raise exception 'Etapa não encontrada. Recarregue a jornada.' using errcode = 'P0002';
  end if;

  if not coalesce(private.pode_mexer_na_jornada(v_jornada), false) then
    perform private.negar('editar_etapa_da_jornada');
  end if;

  if v_descricao is null or v_descricao !~ '\S' or char_length(v_descricao) > 2000 then
    raise exception 'A descrição da etapa precisa ter de 1 a 2.000 caracteres.'
      using errcode = '22023';
  end if;

  if v_responsavel is null or v_responsavel !~ '\S' or char_length(v_responsavel) > 200 then
    raise exception 'O responsável da etapa precisa ter de 1 a 200 caracteres.'
      using errcode = '22023';
  end if;

  update public.onboarding_phases
     set descricao = v_descricao,
         responsavel = v_responsavel
   where id = p_phase_id;
end;
$$;

revoke all on function public.editar_etapa_da_jornada(uuid, text, text) from public, anon;
grant execute on function public.editar_etapa_da_jornada(uuid, text, text) to authenticated;

