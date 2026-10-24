revoke insert, update on table public.internal_tasks from authenticated;

grant insert (
  title, description, category, task_type, assignee_id, client_id,
  opportunity_id, col, priority, due_date, recurrence
) on table public.internal_tasks to authenticated;

grant update (
  title, description, category, task_type, assignee_id, client_id,
  opportunity_id, col, priority, due_date, recurrence
) on table public.internal_tasks to authenticated;

