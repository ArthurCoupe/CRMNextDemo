alter table public.cancelamentos_desfeitos
  alter column meeting_id drop not null,
  drop constraint cancelamentos_desfeitos_meeting_id_fkey,
  add constraint cancelamentos_desfeitos_meeting_id_fkey
    foreign key (meeting_id) references public.meetings(id) on delete set null;

drop policy "cancelamentos_desfeitos: quem vê a reunião lê" on public.cancelamentos_desfeitos;
create policy "cancelamentos_desfeitos: quem vê a reunião lê; sem reunião, o owner" on public.cancelamentos_desfeitos
  for select to authenticated
  using (
    exists (select 1 from public.meetings m where m.id = cancelamentos_desfeitos.meeting_id)
    or (meeting_id is null and public.is_owner())
  );

