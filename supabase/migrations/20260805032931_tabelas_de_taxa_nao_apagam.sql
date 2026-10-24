create or replace function private.taxa_nao_apaga()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception
    'As tabelas de taxa nao aceitam DELETE: private.v_net_revenue depende delas. Apagar uma linha de gateway_fees faz a taxa daquele parcelamento virar ZERO e o liquido aparecer MAIOR do que e; apagar uma de payment_method_fees faz o contrato sumir do painel. Para mudar uma taxa, use UPDATE.'
    using errcode = '23514';
end $$;

revoke all on function private.taxa_nao_apaga() from public, anon, authenticated;

create trigger trg_gateway_fees_nao_apaga
  before delete on public.gateway_fees
  for each row execute function private.taxa_nao_apaga();

create trigger trg_payment_method_fees_nao_apaga
  before delete on public.payment_method_fees
  for each row execute function private.taxa_nao_apaga();
