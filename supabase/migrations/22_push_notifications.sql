create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_type text not null check (user_type in ('siswa','guru','admin')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  user_agent text,
  platform text,
  standalone boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_type, user_id, active);

alter table public.push_subscriptions enable row level security;

comment on table public.push_subscriptions is
  'Web Push subscriptions. Accessed only by the Legacy Cloudflare Worker using the Supabase service role.';
