CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'notify-processor-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wcfimjkersvbqxwarfqr.supabase.co/functions/v1/notify-processor',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);