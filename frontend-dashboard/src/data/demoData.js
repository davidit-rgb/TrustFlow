export const companyTemplates = {
  default: { label: 'Scaleup LATAM', budget: 5000, remaining: 3500, autoPay: 2000 },
  startup: { label: 'Startup conservadora', budget: 2000, remaining: 1500, autoPay: 500 },
  enterprise: { label: 'Corporativo global', budget: 50000, remaining: 42000, autoPay: 10000 },
}

export const demoVendors = [
  { id: 'demo-aws', vendor_name: 'Amazon Web Services', currency: 'USD', maxAgreed: 2000, country: 'US', is_active: true },
  { id: 'demo-devstudio', vendor_name: 'DevStudio MX', currency: 'MXN', maxAgreed: 30000, country: 'MX', is_active: true },
  { id: 'demo-latam-talent', vendor_name: 'Latam Talent Agency', currency: 'USD', maxAgreed: 4000, country: 'US', is_active: true },
]

export const demoDecisions = [
  { id: 'demo-1', invoice_number: 'DSM-99', source_channel: 'Chat', vendor_name: 'DevStudio MX', original_amount: 25000, original_currency: 'MXN', normalized_amount: 1250, decision: 'ESCALADO', rule_triggered: 'AUTO_PAY_LIMIT', reviewer_status: 'PENDING', explanation: 'Excede límite automático o requiere revisión de contrato inicial.', created_at: '2026-10-17T11:42:00Z' },
  { id: 'demo-2', invoice_number: 'AWS-789', source_channel: 'PDF', vendor_name: 'Amazon Web Services', original_amount: 1800, original_currency: 'USD', normalized_amount: 1800, decision: 'PAGADO', rule_triggered: 'WITHIN_POLICY', explanation: 'Dentro de límites de contrato y whitelist.', created_at: '2026-10-17T10:18:00Z' },
  { id: 'demo-3', invoice_number: 'DS-456', source_channel: 'Imagen', vendor_name: 'DevStudio MX', original_amount: 50000, original_currency: 'MXN', normalized_amount: 2500, decision: 'FRENADO', rule_triggered: 'CONTRACT_MISMATCH', explanation: 'Inconsistencia de contrato detectable.', created_at: '2026-10-16T16:05:00Z' },
]

export const presetCases = [
  'Hola equipo, soy de DevStudio MX, les paso el cobro de este mes por $25,000 MXN, folio DSM-99',
  'Factura de Amazon Web Services por $1,800 USD, folio AWS-890',
  'Cobro de Proveedor Desconocido por $700 USD, folio UNKNOWN-12',
  'DevStudio MX solicita $50,000 MXN, folio DS-457',
  'Factura de Amazon Web Services por $1,800 USD, folio AWS-789',
]
