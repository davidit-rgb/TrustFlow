-- Campos de ingesta, vigencia y huellas anti-duplicado.
alter table public.agent_decisions
  add column if not exists issue_date date,
  add column if not exists due_date date,
  add column if not exists concept text,
  add column if not exists has_source_folio boolean not null default true,
  add column if not exists beneficiary_normalized text,
  add column if not exists accounting_period text,
  add column if not exists period_fingerprint text,
  add column if not exists exact_date_fingerprint text;

create index if not exists agent_decisions_period_fingerprint_idx
  on public.agent_decisions (company_id, period_fingerprint);

create index if not exists agent_decisions_exact_date_fingerprint_idx
  on public.agent_decisions (company_id, exact_date_fingerprint);
