create or replace function private.fn_teto_de_links_da_tarefa()
returns trigger
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.pode_editar_tarefa(new.task_id) then
    raise exception 'Você não pode mexer nos links desta tarefa: só owner, manager, o responsável e os participantes mexem.'
      using errcode = '42501';
  end if;
  perform 1 from public.internal_tasks where id = new.task_id for update;
  if (select count(*) from public.internal_task_links where task_id = new.task_id) >= 20 then
    raise exception 'A tarefa já tem 20 links. Remova um antes de incluir outro.'
      using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.pode_gerir_participantes(p_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    return false;
  end if;
  return public.pode_editar_tarefa(p_task_id)
    or (
      public.pode_apagar_cartao(p_task_id)
      and public.tarefa_sem_evento_de_conteudo(p_task_id)
      and exists (
        select 1 from public.internal_tasks t
         where t.id = p_task_id and t.created_by = auth.uid()
      )
    );
end $$;

