-- TrustFlow: usuario operativo y auditoría de revisiones humanas.
-- Ejecutar en Supabase después de crear companies, company_vendors y agent_decisions.
-- La política de UPDATE está limitada a la empresa configurada en
-- frontend-dashboard/.env (VITE_TRUSTFLOW_COMPANY_ID).

alter table public.companies enable row level security;

drop policy if exists demo_update_companies on public.companies;
create policy demo_update_companies
  on public.companies
  for update
  to anon
  using (id = 'f534b35f-0b4a-4cab-acf1-f6d322b05fb9')
  with check (id = 'f534b35f-0b4a-4cab-acf1-f6d322b05fb9');

create table if not exists public.trustflow_users (
  id uuid primary key,
  full_name text not null,
  email text not null unique,
  role text not null default 'reviewer'
    check (role in ('admin', 'reviewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.trustflow_users (id, full_name, email, role)
values (
  '00000000-0000-0000-0000-000000000001',
  'David Admin',
  'david.admin@trustflow.local',
  'admin'
)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = true;

alter table public.agent_decisions
  add column if not exists reviewer_status text
    check (reviewer_status in ('PENDING', 'APPROVED', 'REJECTED'));

alter table public.agent_decisions
  add column if not exists reviewed_by uuid
    references public.trustflow_users(id);

alter table public.agent_decisions
  add column if not exists reviewed_at timestamptz;

create index if not exists agent_decisions_company_created_idx
  on public.agent_decisions (company_id, created_at desc);

create index if not exists agent_decisions_pending_review_idx
  on public.agent_decisions (company_id, reviewer_status)
  where reviewer_status = 'PENDING';
