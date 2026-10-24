revoke insert (col) on table public.internal_tasks from authenticated;

create trigger trg_internal_tasks_conclusao_insert
  before insert on public.internal_tasks
  for each row
  when (new.col = 'done')
  execute function private.fn_carimba_conclusao();

