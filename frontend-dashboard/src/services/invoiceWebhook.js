const invoiceWebhookUrl = 'https://david-rgb.app.n8n.cloud/webhook-test/64502be8-b6d5-41ee-889e-cf4db2c9b91c'
//const invoiceWebhookUrl = 'https://david-rgb.app.n8n.cloud/webhook/64502be8-b6d5-41ee-889e-cf4db2c9b91c'

function unwrapWebhookPayload(rawPayload) {
  let payload = rawPayload
  if (Array.isArray(payload)) payload = payload[0]?.json ?? payload[0]
  if (payload?.json) payload = payload.json
  if (payload?.body) payload = typeof payload.body === 'string' ? parseJsonText(payload.body) : payload.body
  return payload
}

function parseJsonText(value) {
  if (typeof value !== 'string') return value
  const cleaned = value.replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  try {
    return JSON.parse(candidate)
  } catch {
    return value
  }
}

function nullableDate(value) {
  if (!value) return null
  const normalized = String(value).trim()
  return /^(no detectad[ao]|unknown|n\/a|null)$/i.test(normalized) ? null : normalized
}

export function normalizeWebhookPayload(rawPayload) {
  let payload = unwrapWebhookPayload(rawPayload)
  if (payload?.content?.parts?.[0]?.text) payload = payload.content.parts[0].text
  payload = parseJsonText(payload)
  if (Array.isArray(payload)) payload = unwrapWebhookPayload(payload)
  if (payload?.body) payload = unwrapWebhookPayload(payload)
  if (payload?.content?.parts?.[0]?.text) payload = parseJsonText(payload.content.parts[0].text)

  const data = payload?.data ?? payload?.result ?? payload?.output ?? payload?.response ?? payload
  if (typeof data === 'string') return normalizeWebhookPayload(parseJsonText(data))
  if (!data || typeof data !== 'object') throw new Error('El webhook devolvió un payload vacío o con formato no compatible.')
  if ('myField' in data) {
    console.error('Respuesta estática detectada en Respond to Webhook de n8n:', data)
    throw new Error('El webhook de n8n devolvió el payload estático por defecto {"myField": "value"}. Verifica el nodo Respond to Webhook.')
  }

  const amount = Number(String(data.original_amount ?? data.monto_total ?? data.monto ?? 0).replace(/[^0-9.-]+/g, '')) || 0
  const rawCurrency = String(data.original_currency ?? data.moneda_original ?? 'UNKNOWN').trim().toUpperCase()
  const currency = rawCurrency === 'UNKNOWN' ? 'UNKNOWN' : rawCurrency.slice(0, 3)
  return {
    invoice_number: data.invoice_number ?? data.folio ?? data.id ?? null,
    vendor_name: data.vendor_name ?? data.beneficiario ?? data.proveedor ?? null,
    original_amount: amount,
    original_currency: currency,
    issue_date: nullableDate(data.issue_date ?? data.fecha_emision),
    due_date: nullableDate(data.due_date ?? data.fecha_vencimiento),
    concept: data.concept ?? data.concepto ?? null,
    raw_text: data.text ?? data.raw_text ?? data.rawText ?? null,
    source_channel: data.source_channel ?? null,
    raw_payload: data,
  }
}

async function postWebhook(body, headers = {}) {
  const response = await fetch(invoiceWebhookUrl, { method: 'POST', body, headers })
  const responseText = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${responseText || 'sin detalle'}`)
  let payload
  try {
    payload = JSON.parse(responseText)
  } catch (error) {
    throw new Error(`La respuesta no es JSON: ${responseText || 'cuerpo vacío'}`, { cause: error })
  }
  return normalizeWebhookPayload(payload)
}

async function requestWebhook(body, headers = {}) {
  try {
    return await postWebhook(body, headers)
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`No se pudo conectar con el webhook de n8n (${invoiceWebhookUrl}). Posibles causas: workflow inactivo, URL incorrecta, CORS o error de red.`, { cause: error })
    }
    if (error instanceof Error && error.message.startsWith('HTTP ')) {
      throw new Error(`n8n rechazó la factura: ${error.message}`, { cause: error })
    }
    throw new Error(`Falló la preparación o lectura de la respuesta de n8n: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

export async function extractInvoiceFromFile(file, sourceChannel) {
  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('source_channel', sourceChannel || (file.type.startsWith('image/') ? 'Imagen' : 'PDF'))
  return requestWebhook(formData)
}

export async function extractInvoiceFromText(text, sourceChannel = 'Chat') {
  const normalizedText = String(text || '').trim()
  if (!normalizedText) throw new Error('Escribe el mensaje de la factura antes de enviarlo al webhook.')
  const minimalPayload = {
    text: normalizedText,
    source_channel: sourceChannel === 'Correo' ? 'Correo' : 'Chat',
  }
  return requestWebhook(JSON.stringify(minimalPayload), { 'Content-Type': 'application/json' })
}
