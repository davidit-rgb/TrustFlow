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
  const folioMatch = rawInput.match(/(?:folio|factura|invoice)\s*[:#-]?\s*([A-Za-z0-9-_]+)/i)
  const amountMatch = rawInput.match(/\$?\s*([0-9,]+(?:\.[0-9]{2})?)\s*(MXN|USD|COP)/i)
  const normalizedInputLower = normalizeVendorName(rawInput)
  const vendor = vendors.find((item) => normalizedInputLower.includes(normalizeVendorName(item.vendor_name)))

  return {
    invoice_number: folioMatch ? folioMatch[1].toUpperCase() : null,
    has_source_folio: Boolean(folioMatch),
    original_amount: amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0,
    original_currency: amountMatch ? amountMatch[2].toUpperCase() : 'UNKNOWN',
    source_channel: 'Chat',
    vendor,
    vendor_name: vendor?.vendor_name || rawInput.match(/soy de ([^,]+)/i)?.[1]?.trim() || 'Proveedor desconocido',
    raw_input: normalizedInput,
    issue_date: null,
    due_date: null,
    concept: null,
  }
}

export function parseExtractedInvoice(payload, vendors, sourceChannel = 'PDF') {
  if (payload?.error) throw new Error(`n8n no pudo extraer la factura: ${payload.error}`)
  const source = payload
  const extractedText = source.raw_text
  const textInvoice = extractedText ? parseInvoiceText(extractedText, vendors) : {}
  const vendorName = source.vendor_name
  const vendor = vendors.find((item) => normalizeVendorName(item.vendor_name) === normalizeVendorName(vendorName || textInvoice.vendor_name))
  return {
    invoice_number: source.invoice_number ? String(source.invoice_number).toUpperCase() : textInvoice.invoice_number,
    has_source_folio: source.invoice_number ? true : textInvoice.has_source_folio,
    original_amount: source.original_amount || textInvoice.original_amount,
    original_currency: source.original_currency !== 'UNKNOWN' ? source.original_currency : textInvoice.original_currency,
    source_channel: source.source_channel || sourceChannel,
    vendor: vendor || null,
    vendor_name: vendor?.vendor_name || vendorName || textInvoice.vendor_name || 'Proveedor desconocido',
    issue_date: source.issue_date || textInvoice.issue_date,
    due_date: source.due_date || textInvoice.due_date,
    concept: source.concept || textInvoice.concept,
    raw_input: JSON.stringify(source.raw_payload || source),
  }
}
