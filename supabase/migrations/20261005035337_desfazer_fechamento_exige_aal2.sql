create or replace function public.desfazer_fechamento(p_client_id uuid, p_motivo text)
returns table (contratos_apagados int, estagio_restaurado text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_owner() and public.aal_suficiente()) then
    perform private.negar('desfazer_fechamento');
  end if;
  return query select * from private.fn_desfazer_fechamento(p_client_id, p_motivo, auth.uid());
end $$;

revoke all on function public.desfazer_fechamento(uuid, text) from public, anon;
grant execute on function public.desfazer_fechamento(uuid, text) to authenticated;

