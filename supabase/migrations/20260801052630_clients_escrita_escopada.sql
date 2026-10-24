drop policy if exists "clients: owner e manager escrevem" on public.clients;

create policy "clients: owner escreve"
  on public.clients for all
  using (public.is_owner())
  with check (public.is_owner());

create policy "clients: manager edita os clientes dele"
  on public.clients for update
  using (
    public.current_app_role() = 'manager'
    and owner_id = auth.uid()
  )
  with check (
    public.current_app_role() = 'manager'
  );

