create or replace function private.fiscal_settings_nao_apaga()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception
    'fiscal_settings tem linha unica e ela nao pode ser apagada: v_net_revenue faz cross join com ela, e sem a linha a receita liquida some da tela sem sintoma. Para mudar a aliquota, use UPDATE.'
    using errcode = '23514';
end $$;

revoke all on function private.fiscal_settings_nao_apaga() from public, anon, authenticated;
