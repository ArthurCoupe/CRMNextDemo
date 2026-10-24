insert into storage.buckets (id, name, public)
values ('crm-files', 'crm-files', false)
on conflict (id) do update set public = false;

create or replace function private.storage_caminho_de_cliente(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (storage.foldername(p_name))[1] = 'clients'
    and exists (
      select 1
      from public.clients c
      where c.id::text = (storage.foldername(p_name))[2]
    ),
    false)
$$;

drop policy if exists "crm-files: staff le" on storage.objects;
drop policy if exists "crm-files: owner e manager gravam" on storage.objects;
drop policy if exists "crm-files: owner e manager atualizam" on storage.objects;
drop policy if exists "crm-files: owner e manager apagam" on storage.objects;

create policy "crm-files: staff le"
  on storage.objects for select
  using (bucket_id = 'crm-files' and public.is_staff());

create policy "crm-files: owner e manager gravam"
  on storage.objects for insert
  with check (
    bucket_id = 'crm-files'
    and public.current_app_role() in ('owner', 'manager')
    and private.storage_caminho_de_cliente(name)
  );

create policy "crm-files: owner e manager atualizam"
  on storage.objects for update
  using (
    bucket_id = 'crm-files'
    and public.current_app_role() in ('owner', 'manager')
  )
  with check (
    bucket_id = 'crm-files'
    and public.current_app_role() in ('owner', 'manager')
    and private.storage_caminho_de_cliente(name)
  );

create policy "crm-files: owner e manager apagam"
  on storage.objects for delete
  using (
    bucket_id = 'crm-files'
    and public.current_app_role() in ('owner', 'manager')
  );

