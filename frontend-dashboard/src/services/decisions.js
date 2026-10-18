import { companyId, isSupabaseConfigured, supabase } from './supabase'

export { isSupabaseConfigured }

export async function listAgentDecisions(companyIdOverride = companyId) {
  if (!supabase || !companyIdOverride) return []
  const { data, error } = await supabase.from('agent_decisions').select('*').eq('company_id', companyIdOverride).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function createAgentDecision(decision) {
  if (!supabase) return decision
  if (!companyId) {
    throw new Error('Falta VITE_TRUSTFLOW_COMPANY_ID para asociar la decisión a una empresa')
  }
  if (!decision.invoice_number) {
    throw new Error('No se puede guardar la decisión: la factura no tiene número o folio')
  }

  try {
    const { data, error } = await supabase
      .from('agent_decisions')
      .insert({
        company_id: companyId,
        invoice_number: decision.invoice_number,
        vendor_name: decision.vendor_name,
        source_channel: decision.source_channel,
        original_amount: decision.original_amount,
        original_currency: decision.original_currency,
        normalized_amount: decision.normalized_amount,
        decision: decision.decision,
        rule_triggered: decision.rule_triggered,
        explanation: decision.explanation,
        reviewer_status: decision.reviewer_status || null,
        reviewed_by: decision.reviewed_by || null,
        reviewed_at: decision.reviewed_at || null,
        applied_policy_snapshot: decision.applied_policy_snapshot || {},
      })
      .select()
      .single()

    if (error) throw new Error(`Supabase rechazó el registro: ${error.message}`)
    return data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('No se pudo conectar con Supabase al guardar la decisión. Revisa la URL, la clave pública, CORS y que hayas reiniciado Vite después de crear .env', { cause: error })
    }
    throw error
  }
}

export async function updateAgentDecision(decisionId, companyIdOverride, updates) {
  if (!supabase) return { id: decisionId, ...updates }
  const { data, error } = await supabase
    .from('agent_decisions')
    .update(updates)
    .eq('id', decisionId)
    .eq('company_id', companyIdOverride || companyId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}
