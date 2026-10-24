create or replace function private.fn_cliente_sem_dependencia_antes_de_apagar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_contratos int;
  n_jornadas  int;
begin
  select count(*) into n_contratos from public.contracts where client_id = old.id;
  select count(*) into n_jornadas  from public.onboarding_journeys where client_id = old.id;

  if n_contratos > 0 then
    raise exception
      'Cliente % tem % contrato(s) e nao pode ser apagado: apagar levaria os contratos, itens e participacoes junto. Use status = churned para encerrar.',
      old.name, n_contratos
      using errcode = '23503';
  end if;

  if n_jornadas > 0 then
    raise exception
      'Cliente % tem % jornada(s) de onboarding e nao pode ser apagado.',
      old.name, n_jornadas
      using errcode = '23503';
  end if;

  return old;
end;
$$;

revoke all on function private.fn_cliente_sem_dependencia_antes_de_apagar() from public, anon, authenticated;

drop trigger if exists trg_cliente_sem_dependencia on public.clients;
create trigger trg_cliente_sem_dependencia
  before delete on public.clients
  for each row execute function private.fn_cliente_sem_dependencia_antes_de_apagar();

