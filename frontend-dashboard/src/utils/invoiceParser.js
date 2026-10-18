function normalizeVendorName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function parseInvoiceText(rawInput, vendors) {
  const normalizedInput = rawInput.trim()
  const folioMatch = rawInput.match(/folio\s+([A-Za-z0-9-_]+)/i)
  const amountMatch = rawInput.match(/\$([0-9,]+(?:\.[0-9]{2})?)\s*(MXN|USD)/i)
  const normalizedInputLower = normalizeVendorName(rawInput)
  const vendor = vendors.find((item) => normalizedInputLower.includes(normalizeVendorName(item.vendor_name)))

  return {
    invoice_number: folioMatch ? folioMatch[1].toUpperCase() : `UNREADABLE-${Date.now().toString().slice(-6)}`,
    original_amount: amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0,
    original_currency: amountMatch ? amountMatch[2].toUpperCase() : 'UNKNOWN',
    source_channel: 'Chat',
    vendor,
    vendor_name: vendor?.vendor_name || rawInput.match(/soy de ([^,]+)/i)?.[1]?.trim() || 'Proveedor desconocido',
    raw_input: normalizedInput,
  }
}

export function parseExtractedInvoice(payload, vendors) {
  const extracted = Array.isArray(payload) ? payload[0] : payload
  if (extracted?.error) {
    throw new Error(`n8n no pudo extraer la factura: ${extracted.error}`)
  }

  let source = extracted?.data || extracted?.result || extracted?.output || extracted?.response || extracted || {}
  for (let attempt = 0; attempt < 2 && typeof source === 'string'; attempt += 1) {
    try {
      source = JSON.parse(source)
    } catch {
      source = { text: source }
    }
  }
  if (source?.error) {
    throw new Error(`n8n no pudo extraer la factura: ${source.error}`)
  }

  const rawText = source.raw_text || source.rawText || source.text || source.content || ''
  const parsedText = parseInvoiceText(rawText, vendors)
  const invoiceNumber = source.invoice_number
    || source.invoiceNumber
    || source.invoice_id
    || source.folio
    || source.numero_factura
    || source.numeroFactura
  const amount = source.original_amount
    ?? source.originalAmount
    ?? source.amount
    ?? source.total
    ?? source.monto
  const currency = source.original_currency
    || source.originalCurrency
    || source.currency
    || source.moneda
  const vendorName = source.vendor_name
    || source.vendorName
    || source.vendor
    || source.proveedor
    || parsedText.vendor_name
  const vendor = vendors.find((item) => normalizeVendorName(item.vendor_name) === normalizeVendorName(vendorName))

  return {
    ...parsedText,
    source_channel: 'PDF',
    invoice_number: invoiceNumber ? String(invoiceNumber).toUpperCase() : parsedText.invoice_number,
    original_amount: amount !== undefined && amount !== null ? Number(String(amount).replace(/,/g, '')) : parsedText.original_amount,
    original_currency: currency ? String(currency).toUpperCase() : parsedText.original_currency,
    vendor: vendor || parsedText.vendor,
    vendor_name: vendor?.vendor_name || vendorName || parsedText.vendor_name,
    due_date: source.due_date || source.dueDate || source.fecha_vencimiento || null,
    concept: source.concept || source.description || source.concepto || null,
    raw_input: rawText || JSON.stringify(source),
  }
}
