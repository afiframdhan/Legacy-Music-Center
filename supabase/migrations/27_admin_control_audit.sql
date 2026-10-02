create table if not exists public.audit_logs (
  audit_id uuid primary key default gen_random_uuid(),
  actor_role text not null default '',
  actor_id text,
  actor_name text not null default '',
  action text not null,
  category text not null default 'Sistem',
  entity_type text,
  entity_id text,
  entity_name text,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_role, actor_id);
create index if not exists idx_audit_logs_category on public.audit_logs(category);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
