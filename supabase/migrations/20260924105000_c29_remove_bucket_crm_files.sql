drop policy if exists "crm-files: le quem responde pelo cliente" on storage.objects;
drop policy if exists "crm-files: staff le" on storage.objects;
drop policy if exists "crm-files: owner e manager gravam" on storage.objects;
drop policy if exists "crm-files: owner e manager atualizam" on storage.objects;
drop policy if exists "crm-files: owner e manager apagam" on storage.objects;

drop function if exists private.storage_cliente_visivel(text);
drop function if exists private.storage_caminho_de_cliente(text);

update storage.buckets
   set public = false,
       file_size_limit = 1,
       allowed_mime_types = array['application/x-crm-files-desativado']
 where id = 'crm-files';
