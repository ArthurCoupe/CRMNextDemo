revoke insert (created_at, stage_changed_at, updated_at)
  on table public.opportunities from authenticated;

revoke update (id, created_at, stage_changed_at, updated_at)
  on table public.opportunities from authenticated;
