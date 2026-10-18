const decisionReasons = {
  INVALID_DATE_ORDER: {
    title: 'Factura detenida por fechas inconsistentes',
    reason: 'La fecha de vencimiento es anterior a la fecha de emisión.',
    action: 'Revisa ambas fechas en el documento y vuelve a enviarlo corregido.',
    causes: ['La fecha pudo capturarse con el formato incorrecto.', 'El documento puede tener una fecha de vencimiento anterior a su emisión.'],
  },
  FUTURE_ISSUE_DATE: {
    title: 'Factura detenida por fecha futura',
    reason: 'La fecha de emisión todavía no corresponde al periodo actual.',
    action: 'Confirma la fecha de emisión antes de volver a procesar la factura.',
    causes: ['La factura pudo emitirse por adelantado.', 'La fecha del documento puede estar desactualizada.'],
  },
  INVOICE_EXPIRY_REVIEW: {
    title: 'Factura enviada a revisión',
    reason: 'La factura está vencida o corresponde a un periodo anterior al actual.',
    action: 'Una persona deberá validar la vigencia antes de autorizar el pago.',
    causes: ['El pago puede corresponder a un periodo anterior.', 'La fecha de vencimiento pudo quedar fuera del periodo permitido.'],
  },
  INVOICE_TOTALS_MISMATCH: {
    title: 'Factura detenida por importes inconsistentes',
    reason: 'El subtotal, el IVA y el total no coinciden entre sí.',
    action: 'Revisa los importes del documento y vuelve a enviarlo cuando estén corregidos.',
    causes: ['El IVA pudo capturarse de forma incorrecta.', 'El total del documento puede no corresponder a subtotal más impuestos.'],
  },
  DUPLICATE_INVOICE: {
    title: 'Factura detenida para evitar un pago duplicado',
    reason: 'El folio de esta factura ya aparece registrado en TrustFlow.',
    action: 'Verifica el historial antes de volver a intentar el pago.',
    causes: ['La factura pudo enviarse más de una vez.', 'El mismo folio puede haberse recibido por otro canal.'],
  },
  DUPLICATE_EXACT_FINGERPRINT: {
    title: 'Posible factura duplicada',
    reason: 'Encontramos otra factura con el mismo proveedor, monto y fechas.',
    action: 'Confirma que se trate de un cobro distinto antes de solicitar una revisión.',
    causes: ['Puede tratarse del mismo cobro enviado nuevamente.', 'El proveedor pudo generar una factura corregida con las mismas fechas y monto.'],
  },
  DUPLICATE_PERIOD_FINGERPRINT: {
    title: 'Posible cobro duplicado',
    reason: 'El proveedor, el monto y el periodo coinciden con un registro anterior.',
    action: 'Revisa el historial y confirma si el cobro debe procesarse.',
    causes: ['El cobro pudo llegar por Chat y correo.', 'El documento puede no incluir folio o fechas suficientes para distinguirlo.'],
  },
  INVALID_INVOICE_DATA: {
    title: 'Factura detenida por información incompleta',
    reason: 'Falta el folio, el monto o una moneda que TrustFlow pueda reconocer.',
    action: 'Completa esos datos en el documento y vuelve a enviarlo.',
    causes: ['La extracción no encontró el monto o la moneda.', 'El documento puede no incluir un folio visible.'],
  },
  MISSING_DUE_DATE: {
    title: 'Factura enviada a revisión',
    reason: 'No encontramos una fecha de vencimiento y el monto supera el límite de pago automático.',
    action: 'Una persona deberá confirmar el pago antes de continuar.',
    causes: ['El proveedor puede no haber incluido la fecha de vencimiento.', 'El monto requiere una validación adicional por superar el límite automático.'],
  },
  UNLISTED_VENDOR: {
    title: 'Factura detenida por proveedor no registrado',
    reason: 'El proveedor no está incluido en la lista autorizada de la empresa.',
    action: 'Verifica el proveedor o solicita que se agregue a la lista autorizada.',
    causes: ['El nombre puede venir escrito de forma distinta al registrado.', 'El proveedor puede ser nuevo para la empresa.'],
  },
  CONTRACT_MISMATCH: {
    title: 'Factura detenida por límite de contrato',
    reason: 'El monto solicitado supera el límite acordado con el proveedor.',
    action: 'Revisa el contrato o solicita una validación antes de continuar.',
    causes: ['El monto de la factura puede superar el máximo acordado.', 'El contrato registrado puede estar desactualizado.'],
  },
  OVER_BUDGET: {
    title: 'Factura detenida por presupuesto insuficiente',
    reason: 'El presupuesto disponible no alcanza para cubrir este pago.',
    action: 'Revisa el presupuesto restante o solicita una autorización adicional.',
    causes: ['El presupuesto pudo consumirse con pagos anteriores.', 'El monto convertido a la moneda base puede ser mayor al esperado.'],
  },
  AUTO_PAY_LIMIT: {
    title: 'Factura enviada a revisión',
    reason: 'El monto supera el límite configurado para pagos automáticos.',
    action: 'Una persona deberá revisar y aprobar el pago antes de continuar.',
    causes: ['La política limita los pagos automáticos por monto.', 'El pago requiere autorización humana por control interno.'],
  },
}

function cleanErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('original_amount') || message.includes('not-null constraint')) {
    return 'La factura no contiene un monto válido. Revisa el total del documento y vuelve a intentarlo.'
  }
  if (message.includes('Failed to fetch') || message.includes('No se pudo conectar')) {
    return 'No pudimos comunicarnos con el servicio de procesamiento. Verifica tu conexión e inténtalo nuevamente.'
  }
  if (message.includes('HTTP 4')) {
    return 'El servicio rechazó la información recibida. Revisa que la factura tenga los datos necesarios.'
  }
  return message
    .replace(/Supabase rechazó el registro:\s*/i, '')
    .replace(/n8n no pudo extraer la factura:\s*/i, '')
    .replace(/webhook de n8n/gi, 'servicio de procesamiento')
}

export function getDecisionMessage(decision, { file = false, isSupabaseConfigured = false, baseCurrency = 'USD' } = {}) {
  const context = [
    decision.invoice_number ? `Folio: ${decision.invoice_number}` : null,
    decision.vendor_name ? `Proveedor: ${decision.vendor_name}` : null,
    Number(decision.normalized_amount) > 0 ? `Monto validado: $${Number(decision.normalized_amount).toLocaleString()} ${baseCurrency}` : null,
  ].filter(Boolean)
  if (decision.decision === 'PAGADO') {
    return {
      tone: 'success',
      title: 'Pago aprobado',
      message: file ? 'Factura extraída por n8n, aprobada y registrada.' : isSupabaseConfigured ? 'Factura aprobada automáticamente y guardada en Supabase.' : 'Factura aprobada en modo demo.',
      summary: file ? 'La factura fue extraída, validada y registrada correctamente.' : 'La factura cumple con las reglas configuradas y fue registrada correctamente.',
      reason: 'El proveedor, el contrato, el presupuesto y el monto están dentro de los límites permitidos.',
      action: isSupabaseConfigured ? 'El registro quedó guardado en la cuenta de la empresa.' : 'El registro quedó guardado en modo demo.',
      causes: ['La factura incluye la información necesaria.', 'El monto está dentro del límite de pago automático.', 'El proveedor está autorizado y cumple las reglas configuradas.'],
      context,
    }
  }

  const fallback = decisionReasons[decision.rule_triggered] || {
    title: decision.decision === 'ESCALADO' ? 'Factura enviada a revisión' : 'Factura detenida',
    reason: 'La factura necesita una validación adicional antes de continuar.',
    action: 'Revisa la información y sigue las indicaciones del equipo responsable.',
    causes: ['La política de la empresa detectó una condición que requiere atención.', 'La información recibida puede necesitar una validación adicional.'],
  }
  return {
    tone: decision.decision === 'ESCALADO' ? 'warning' : 'error',
    title: fallback.title,
    message: decision.explanation || fallback.reason,
    ...fallback,
    context,
  }
}

export function getProcessingErrorMessage(error, processingStage) {
  const originalError = error instanceof Error ? error.message : String(error)
  return {
    tone: 'error',
    title: 'No pudimos completar el procesamiento',
    message: processingStage === 'guardado en Supabase'
      ? `La decisión no pudo guardarse; el pago no se ejecutó. ${originalError}`
      : `Falló el ${processingStage}. ${originalError}`,
    summary: processingStage === 'guardado en Supabase'
      ? 'La factura no se guardó y el pago no fue ejecutado.'
      : 'La factura no pudo analizarse en esta ocasión.',
    reason: cleanErrorMessage(error),
    action: 'Corrige la información indicada y vuelve a intentarlo. Si el problema continúa, contacta al administrador.',
    causes: processingStage === 'guardado en Supabase'
      ? ['La información obligatoria pudo no estar completa.', 'El servicio de almacenamiento pudo rechazar algún dato.']
      : ['El documento pudo no ser legible.', 'El servicio de extracción pudo estar temporalmente ocupado.'],
    context: [],
  }
}
