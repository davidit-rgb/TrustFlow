-- Campos fiscales y evidencia devuelta por el webhook.
-- Las decisiones efectivas siguen siendo calculadas por TrustFlow.

alter table public.agent_decisions
  add column if not exists subtotal numeric(18, 2),
  add column if not exists iva numeric(18, 2),
  add column if not exists total numeric(18, 2),
  add column if not exists decision_final text,
  add column if not exists motivo text;
