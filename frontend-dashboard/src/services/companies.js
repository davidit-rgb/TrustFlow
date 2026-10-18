import { supabase } from './supabase'

export async function listCompanies() {
  if (!supabase) return []
  const { data, error } = await supabase.from('companies').select('id, company_name, base_currency, policy_config, created_at').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function updateCompanyPolicy(companyId, policyConfig, baseCurrency) {
  if (!supabase || !companyId) return policyConfig
  const { data, error } = await supabase
    .from('companies')
    .update({
      policy_config: policyConfig,
      ...(baseCurrency ? { base_currency: baseCurrency } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId)
    .select('id, base_currency, policy_config, updated_at')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error(`Supabase no devolvió la empresa actualizada (${companyId}). Ejecuta database/001_human_review.sql para agregar la política UPDATE de public.companies y confirma que el UUID coincide.`)
  }
  return data[0]
}
