-- Soddy AI question counter used by the "soddy-proxy" edge function. Safe to re-run.
alter table public.users add column if not exists soddy_uses integer not null default 0;
