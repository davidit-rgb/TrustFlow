const CURRENCY_RATES_TO_USD = { USD: 1, MXN: 0.05, COP: 0.00025 }

function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount
  const amountInUsd = amount * (CURRENCY_RATES_TO_USD[fromCurrency] || 1)
  return amountInUsd / (CURRENCY_RATES_TO_USD[toCurrency] || 1)
}

function normalizeVendorName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?\s*a\.?\s*de\s*c\.?\s*v\.?|s\.?\s*a\.?|ltd\.?|inc\.?)\b/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function parseDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const text = String(value).trim()
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])))
  const spanishMatch = text.toLowerCase().match(/^(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})$/)
  if (spanishMatch) {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const month = months.indexOf(spanishMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    if (month >= 0) return new Date(Date.UTC(Number(spanishMatch[3]), month, Number(spanishMatch[1])))
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function dateValue(date) {
  return date ? date.toISOString().slice(0, 10) : null
}

export function validateInvoiceDates(issueDate, dueDate, now = new Date()) {
  const issue = parseDate(issueDate)
  const due = parseDate(dueDate)
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const twoDaysAhead = new Date(today)
  twoDaysAhead.setUTCDate(twoDaysAhead.getUTCDate() + 2)
  if (issue && due && due < issue) {
    return {
      decision: 'FRENADO',
      ruleTriggered: 'INVALID_DATE_ORDER',
      explanation: `Alerta anti-fraude: incoherencia cronológica detectada. La fecha de vencimiento (${dateValue(due)}) es anterior a la fecha de emisión (${dateValue(issue)}).`,
    }
  }
  if (issue && issue > twoDaysAhead) {
    return {
      decision: 'FRENADO',
      ruleTriggered: 'FUTURE_ISSUE_DATE',
      explanation: `Alerta anti-fraude: factura post-fechada con fecha de emisión futura (${dateValue(issue)}). No se permiten cobros adelantados fuera de fecha.`,
    }
  }
  const ageInDays = issue ? (today - issue) / 86400000 : 0
  if ((due && due < today) || ageInDays > 60) {
    return {
      decision: 'ESCALADO',
      ruleTriggered: 'INVOICE_EXPIRY_REVIEW',
      explanation: `Revisión requerida por vigencia: la factura presenta fecha de vencimiento expirada (${dateValue(due) || 'no indicada'}) o emisión fuera del periodo activo (${dateValue(issue) || 'no indicada'}).`,
    }
  }
  return null
}

function nextInternalFolio(decisions, now = new Date()) {
  const year = now.getUTCFullYear()
  const numbers = decisions
    .map((item) => String(item.invoice_number || '').match(new RegExp(`^MSG-${year}-(\\d+)$`))?.[1])
    .filter(Boolean)
    .map(Number)
  const next = numbers.length ? Math.max(...numbers) + 1 : 1
  return `MSG-${year}-${String(next).padStart(4, '0')}`
}

function periodFromDates(issueDate, dueDate, now = new Date()) {
  const date = issueDate || dueDate
  const parsed = parseDate(date)
  return parsed ? parsed.toISOString().slice(0, 7) : now.toISOString().slice(0, 7)
}

function fingerprints(invoice, normalizedAmount, now) {
  const beneficiary = normalizeVendorName(invoice.vendor_name)
  const period = periodFromDates(invoice.issue_date, invoice.due_date, now)
  const issueDate = dateValue(parseDate(invoice.issue_date))
  const dueDate = dateValue(parseDate(invoice.due_date))
  return {
    beneficiary_normalized: beneficiary,
    accounting_period: period,
    period_fingerprint: `${beneficiary}|${normalizedAmount}|${period}`,
    exact_date_fingerprint: `${beneficiary}|${normalizedAmount}|${issueDate || 'NA'}|${dueDate || 'NA'}`,
  }
}

function historicalFingerprints(item, baseCurrency) {
  const amount = Number(item.normalized_amount || convertCurrency(Number(item.original_amount || 0), item.original_currency, baseCurrency)).toFixed(2)
  return fingerprints(item, amount, new Date(item.created_at || Date.now()))
}

export function evaluatePayment({ invoice, decisions, policy }) {
  const now = new Date()
  const baseCurrency = policy.baseCurrency || 'USD'
  const hasSourceFolio = invoice.has_source_folio ?? Boolean(invoice.invoice_number)
  const invoiceNumber = invoice.invoice_number || nextInternalFolio(decisions, now)
  const originalCurrency = String(invoice.original_currency || 'UNKNOWN').toUpperCase()
  const normalizedAmount = invoice.original_amount > 0 && originalCurrency !== 'UNKNOWN'
    ? Number(convertCurrency(invoice.original_amount, originalCurrency, baseCurrency).toFixed(2))
    : 0
  const current = { ...invoice, invoice_number: invoiceNumber, has_source_folio: hasSourceFolio, original_currency: originalCurrency }
  const security = fingerprints(current, normalizedAmount.toFixed(2), now)
  const byFolio = hasSourceFolio && decisions.find((item) => String(item.invoice_number || '').toLowerCase() === invoiceNumber.toLowerCase())
  const byExactDates = decisions.find((item) => {
    const previous = historicalFingerprints(item, baseCurrency)
    return previous.exact_date_fingerprint === security.exact_date_fingerprint
      && Boolean(parseDate(invoice.issue_date) && parseDate(invoice.due_date))
  })
  const byPeriod = !hasSourceFolio && !invoice.issue_date && !invoice.due_date
    ? decisions.find((item) => historicalFingerprints(item, baseCurrency).period_fingerprint === security.period_fingerprint)
    : null
  let decision = 'FRENADO'
  let ruleTriggered
  let explanation

  const dateValidation = validateInvoiceDates(invoice.issue_date, invoice.due_date, now)
  if (dateValidation) {
    decision = dateValidation.decision
    ruleTriggered = dateValidation.ruleTriggered
    explanation = dateValidation.explanation
  } else if (byFolio) {
    ruleTriggered = 'DUPLICATE_INVOICE'
    explanation = `El folio ${invoiceNumber} ya fue registrado previamente.`
  } else if (byExactDates) {
    ruleTriggered = 'DUPLICATE_EXACT_FINGERPRINT'
    explanation = `Alerta anti-fraude: cobro duplicado con fechas idénticas (Emisión: ${invoice.issue_date || 'NA'}, Vencimiento: ${invoice.due_date || 'NA'}) y mismo monto ($${normalizedAmount.toLocaleString()} ${baseCurrency}) para ${invoice.vendor_name}, previamente registrado en el folio ${byExactDates.invoice_number || 'interno'} vía ${byExactDates.source_channel || 'desconocido'}.`
  } else if (byPeriod) {
    ruleTriggered = 'DUPLICATE_PERIOD_FINGERPRINT'
    explanation = `Posible cobro duplicado multi-canal: coincide en proveedor (${invoice.vendor_name}), monto normalizado ($${normalizedAmount.toLocaleString()} ${baseCurrency}) y periodo (${security.accounting_period}) con un registro previo (Folio: ${byPeriod.invoice_number || 'interno'} vía ${byPeriod.source_channel || 'desconocido'}), aunque se omitieron campos en el envío.`
  } else if (!hasSourceFolio || normalizedAmount <= 0 || !['USD', 'MXN', 'COP'].includes(originalCurrency)) {
    ruleTriggered = 'INVALID_INVOICE_DATA'
    explanation = `Sin folio en documento origen (ID asignado: ${invoiceNumber}), sin monto positivo o moneda soportada.`
  } else if (!invoice.due_date && normalizedAmount > policy.autoPay) {
    decision = 'ESCALADO'
    ruleTriggered = 'MISSING_DUE_DATE'
    explanation = `Revisión requerida: falta la fecha de vencimiento y el monto supera el límite automático de $${policy.autoPay.toLocaleString()} ${baseCurrency}.`
  } else if (!invoice.vendor) {
    ruleTriggered = 'UNLISTED_VENDOR'
    explanation = `Beneficiario '${invoice.vendor_name}' no existe en la whitelist activa.`
  } else if (invoice.original_amount > convertCurrency(invoice.vendor.maxAgreed, invoice.vendor.currency, originalCurrency)) {
    ruleTriggered = 'CONTRACT_MISMATCH'
    const limit = convertCurrency(invoice.vendor.maxAgreed, invoice.vendor.currency, originalCurrency)
    explanation = `El contrato permite hasta ${limit.toLocaleString()} ${originalCurrency} (límite registrado: ${invoice.vendor.maxAgreed.toLocaleString()} ${invoice.vendor.currency}).`
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

  return {
    ...current,
    ...security,
    tiene_folio_origen: hasSourceFolio,
    monto_base_normalizado: normalizedAmount,
    periodo_contable: security.accounting_period,
    huella_periodo: security.period_fingerprint,
    huella_fechas_exactas: security.exact_date_fingerprint,
    normalized_amount: normalizedAmount,
    decision,
    rule_triggered: ruleTriggered,
    explanation,
    id: crypto.randomUUID(),
    created_at: now.toISOString(),
    reviewer_status: decision === 'ESCALADO' ? 'PENDING' : null,
  }
}
