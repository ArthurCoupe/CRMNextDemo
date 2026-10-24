create extension if not exists pg_net;

select cron.schedule(
  'f19-avisos-diarios',
  '0 11 * * *',
  $job$
  select net.http_post(
    url := 'http://127.0.0.1:8080/api/public/hooks/notificacoes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET'),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

