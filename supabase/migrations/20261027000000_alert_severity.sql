-- How urgent an official alert is, so the app can color it: info (blue), warning (amber), critical (red).
-- Additive and safe: existing rows become 'info'. No policy change; alerts stay public-read and are
-- written only with the service role.
alter table public.official_alerts
  add column severity text not null default 'info'
  check (severity in ('info', 'warning', 'critical'));
