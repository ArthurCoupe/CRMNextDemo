drop event trigger trg_recusa_v_commission_cost;

create or replace function private.recusa_v_commission_cost()
returns event_trigger language plpgsql set search_path = public as $$
declare
  r record;
begin
  for r in select * from pg_event_trigger_ddl_commands() loop
    if r.object_identity ~ '(^|\.)v_commission_cost$' then
      raise exception
        'v_commission_cost foi APAGADA pelo addendum D1 e nao deve voltar. Ela duplica pagamento com dois participantes na mesma BU, ignora MRR ao filtrar contract_type = tcv, e REESCREVE O PASSADO porque o percentual mora em payroll. A participacao vive em contract_shares, por contrato, e o custo sai de private.v_share_cost.'
        using errcode = '42501';
    end if;
  end loop;
end $$;

create event trigger trg_recusa_v_commission_cost
  on ddl_command_end
  when tag in (
    'CREATE VIEW', 'CREATE MATERIALIZED VIEW', 'CREATE TABLE', 'CREATE FUNCTION',
    'ALTER VIEW', 'ALTER MATERIALIZED VIEW', 'ALTER TABLE', 'ALTER FUNCTION'
  )
  execute function private.recusa_v_commission_cost();
