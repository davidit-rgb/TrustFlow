const invoiceWebhookUrl = 'https://chapulines-ut.app.n8n.cloud/webhook-test/64502be8-b6d5-41ee-889e-cf4db2c9b91c'

export async function extractInvoiceFromFile(file) {
  try {
    const formData = new FormData()
    formData.append('file', file, file.name)

    const response = await fetch(invoiceWebhookUrl, {
      method: 'POST',
      body: formData,
    })
    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText || 'sin detalle'}`)
    }

    try {
      return JSON.parse(responseText)
    } catch (error) {
      throw new Error(`La respuesta no es JSON: ${responseText || 'cuerpo vacío'}`, { cause: error })
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(
        `No se pudo conectar con el webhook de n8n (${invoiceWebhookUrl}). Posibles causas: workflow inactivo, URL incorrecta, CORS o error de red.`,
        { cause: error },
      )
    }

    if (error instanceof Error && error.message.startsWith('HTTP ')) {
      throw new Error(`n8n rechazó la factura: ${error.message}`, { cause: error })
    }

    if (error instanceof Error && error.message.startsWith('La respuesta no es JSON:')) {
      throw error
    }

    throw new Error(`Falló la preparación o lectura de la respuesta de n8n: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}
