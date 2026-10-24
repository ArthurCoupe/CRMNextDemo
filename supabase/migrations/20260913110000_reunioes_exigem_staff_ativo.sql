create or replace function public.pode_ver_reuniao(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_staff()
    and (
      public.current_app_role() in ('owner','manager')
      or exists (
        select 1 from public.meetings m
        where m.id = p_meeting_id and m.organizer_id = auth.uid()
      )
      or exists (
        select 1 from public.meeting_attendees a
        where a.meeting_id = p_meeting_id and a.profile_id = auth.uid()
      )
    );
$$;

revoke execute on function public.pode_ver_reuniao(uuid) from public, anon;
grant execute on function public.pode_ver_reuniao(uuid) to authenticated;

drop policy "reunioes: ve quem participa, e a gestao ve tudo" on public.meetings;
create policy "reunioes: ve quem participa, e a gestao ve tudo"
  on public.meetings for select
  using (
    public.is_staff()
    and (
      organizer_id = auth.uid()
      or public.current_app_role() in ('owner','manager')
      or public.pode_ver_reuniao(id)
    )
  );

drop policy "reunioes: staff cria" on public.meetings;
create policy "reunioes: staff cria"
  on public.meetings for insert
  with check (public.is_staff());

drop policy "reunioes: edita quem organizou, mais owner e manager" on public.meetings;
create policy "reunioes: edita quem organizou, mais owner e manager"
  on public.meetings for update
  using (
    public.is_staff()
    and (organizer_id = auth.uid() or public.current_app_role() in ('owner','manager'))
  )
  with check (
    public.is_staff()
    and (organizer_id = auth.uid() or public.current_app_role() in ('owner','manager'))
  );

drop policy "reunioes: apaga quem organizou, mais owner e manager" on public.meetings;
create policy "reunioes: apaga quem organizou, mais owner e manager"
  on public.meetings for delete
  using (
    public.is_staff()
    and (organizer_id = auth.uid() or public.current_app_role() in ('owner','manager'))
  );

drop policy "participantes: ve quem ve a reuniao" on public.meeting_attendees;
create policy "participantes: ve quem ve a reuniao"
  on public.meeting_attendees for select
  using (public.is_staff() and public.pode_ver_reuniao(meeting_id));

drop policy "participantes: escreve quem edita a reuniao" on public.meeting_attendees;
create policy "participantes: escreve quem edita a reuniao"
  on public.meeting_attendees for all
  using (
    public.is_staff()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.organizer_id = auth.uid()
             or public.current_app_role() in ('owner','manager'))
    )
  )
  with check (
    public.is_staff()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.organizer_id = auth.uid()
             or public.current_app_role() in ('owner','manager'))
    )
  );
