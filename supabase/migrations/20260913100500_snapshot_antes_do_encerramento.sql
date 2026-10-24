select cron.unschedule('f15-snapshot-do-mes-anterior');
select cron.schedule(
  'f15-snapshot-do-mes-anterior',
  '50 8 1 * *',
  $job$
    select private.fn_gravar_snapshot(
      (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month')::date
    );
  $job$
);
