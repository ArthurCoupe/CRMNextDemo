revoke truncate on all tables in schema public from anon, authenticated;

revoke all on public.opportunities from anon;

revoke insert, update on table public.opportunities from authenticated;

grant insert (
  attribution_id, business_unit, channel, contact_email, contact_name,
  contact_phone, created_at, estimated_value, expected_fronts, id,
  landing_url, lead_source, name, next_followup_at, nicho, notes,
  owner_id, referred_by, segment, stage, stage_changed_at, updated_at,
  utm_campaign, utm_content, utm_medium, utm_source, utm_term
) on public.opportunities to authenticated;

grant update (
  attribution_id, business_unit, channel, contact_email, contact_name,
  contact_phone, created_at, estimated_value, expected_fronts, id,
  landing_url, lead_source, name, next_followup_at, nicho, notes,
  owner_id, referred_by, segment, stage, stage_changed_at, updated_at,
  utm_campaign, utm_content, utm_medium, utm_source, utm_term
) on public.opportunities to authenticated;

create or replace function private.storage_cliente_visivel(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_owner() then true
    when public.current_app_role() = 'manager' then exists (
      select 1 from public.clients c
       where c.id::text = (storage.foldername(p_name))[2]
         and c.owner_id = auth.uid()
    )
    else false
  end
$$;

revoke all on function private.storage_cliente_visivel(text) from public, anon, authenticated;

drop policy if exists "crm-files: staff le" on storage.objects;

create policy "crm-files: le quem responde pelo cliente"
  on storage.objects for select
  using (
    bucket_id = 'crm-files'
    and public.is_staff()
    and private.storage_cliente_visivel(name)
  );

revoke all on all functions in schema private from public, anon, authenticated;

alter default privileges in schema private
  revoke execute on functions from public;

revoke insert, delete on public.lead_touches from anon, authenticated;
revoke insert, update, delete on public.monthly_snapshot_rewrites from anon, authenticated;
