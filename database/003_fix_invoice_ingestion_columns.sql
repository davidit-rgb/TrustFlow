-- TrustFlow: complemento para el esquema de ingesta ya existente.
-- Las columnas issue_date, due_date, concept, has_source_folio,
-- beneficiary_normalized, accounting_period, period_fingerprint y
-- exact_date_fingerprint ya están creadas por la migración existente.

alter table public.agent_decisions
  add column if not exists tiene_folio_origen boolean not null default true;

create index if not exists agent_decisions_period_fingerprint_idx
  on public.agent_decisions (company_id, period_fingerprint);

create index if not exists agent_decisions_exact_date_fingerprint_idx
  on public.agent_decisions (company_id, exact_date_fingerprint);

-- Las fechas no detectadas deben ser NULL, no texto.
update public.agent_decisions
set issue_date = null
where issue_date is not null
  and issue_date::text in ('No detectada', 'No detectado', 'UNKNOWN', 'N/A');

update public.agent_decisions
set due_date = null
where due_date is not null
  and due_date::text in ('No detectada', 'No detectado', 'UNKNOWN', 'N/A');

-- Mantiene ambos nombres sincronizados para registros existentes.
update public.agent_decisions
set tiene_folio_origen = has_source_folio
where tiene_folio_origen is distinct from has_source_folio;
