create or replace function private.fn_instante_de_conclusao_do_item()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.concluida_em is not null and old.concluida_em is null then
    new.concluida_em := now();
  end if;
  return new;
end $$;

create trigger trg_onboarding_tasks_instante_do_servidor
  before update of concluida_em on public.onboarding_tasks
  for each row
  when (new.concluida_em is distinct from old.concluida_em)
  execute function private.fn_instante_de_conclusao_do_item();

