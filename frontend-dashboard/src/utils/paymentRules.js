const CURRENCY_RATES_TO_USD = { USD: 1, MXN: 0.05 }

function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount
  const amountInUsd = amount * (CURRENCY_RATES_TO_USD[fromCurrency] || 1)
  return amountInUsd / (CURRENCY_RATES_TO_USD[toCurrency] || 1)
}

export function evaluatePayment({ invoice, decisions, policy }) {
  const duplicate = invoice.invoice_number
    ? decisions.some((item) => item.invoice_number.toLowerCase() === invoice.invoice_number.toLowerCase())
    : false
  const baseCurrency = policy.baseCurrency || 'USD'
  const normalizedAmount = invoice.original_amount && invoice.original_currency
    ? Math.round(invoice.original_amount * (invoice.original_currency === baseCurrency
      ? 1
      : baseCurrency === 'USD' ? 0.05 : 20))
    : null
  let decision = 'FRENADO'
  let ruleTriggered
  let explanation

  if (!invoice.invoice_number || !invoice.original_amount || invoice.original_amount <= 0 || !invoice.original_currency) {
    ruleTriggered = 'INVALID_INVOICE_DATA'
    explanation = 'La factura no contiene folio, monto positivo o moneda soportada. No se puede aprobar automáticamente.'
  } else if (!['USD', 'MXN'].includes(invoice.original_currency)) {
    ruleTriggered = 'UNSUPPORTED_CURRENCY'
    explanation = `La moneda ${invoice.original_currency} no está configurada en la política de la empresa.`
  } else if (duplicate) {
    ruleTriggered = 'DUPLICATE_INVOICE'
    explanation = `El folio ${invoice.invoice_number} ya fue registrado previamente.`
  } else if (!invoice.vendor) {
    ruleTriggered = 'UNLISTED_VENDOR'
    explanation = `Beneficiario '${invoice.vendor_name}' no existe en la whitelist activa.`
  } else if (invoice.original_amount > convertCurrency(invoice.vendor.maxAgreed, invoice.vendor.currency, invoice.original_currency)) {
    ruleTriggered = 'CONTRACT_MISMATCH'
    const contractLimitInInvoiceCurrency = convertCurrency(invoice.vendor.maxAgreed, invoice.vendor.currency, invoice.original_currency)
    explanation = `El contrato permite hasta ${contractLimitInInvoiceCurrency.toLocaleString()} ${invoice.original_currency} (límite registrado: ${invoice.vendor.maxAgreed.toLocaleString()} ${invoice.vendor.currency}).`
  } else if (normalizedAmount > policy.remaining) {
    ruleTriggered = 'OVER_BUDGET'
    explanation = `Requiere $${normalizedAmount.toLocaleString()} ${baseCurrency} y quedan $${policy.remaining.toLocaleString()} ${baseCurrency}.`
  } else if (normalizedAmount > policy.autoPay) {
    decision = 'ESCALADO'
    ruleTriggered = 'AUTO_PAY_LIMIT'
    explanation = `Pago detenido: supera el límite automático de $${policy.autoPay.toLocaleString()} ${baseCurrency}. Requiere aprobación humana.`
  } else {
    decision = 'PAGADO'
    ruleTriggered = 'WITHIN_POLICY'
    explanation = 'Aprobado automáticamente: whitelist, contrato y política dentro de límites.'
  }

  return { ...invoice, normalized_amount: normalizedAmount || 0, decision, rule_triggered: ruleTriggered, explanation, id: crypto.randomUUID(), created_at: new Date().toISOString(), reviewer_status: decision === 'ESCALADO' ? 'PENDING' : null }
}
