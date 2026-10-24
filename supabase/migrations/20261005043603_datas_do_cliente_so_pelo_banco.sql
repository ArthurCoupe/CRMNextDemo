revoke insert, update on table public.clients from authenticated;

grant insert (id, name, segment, nicho, status, contact_name, contact_email, contact_phone,
              owner_id, opportunity_id, drive_folder_id, signed_at,
              confidencial, confidencial_nota)
  on table public.clients to authenticated;

grant update (name, segment, nicho, status, contact_name, contact_email, contact_phone,
              owner_id, opportunity_id, drive_folder_id, signed_at, created_at,
              confidencial, confidencial_nota)
  on table public.clients to authenticated;
