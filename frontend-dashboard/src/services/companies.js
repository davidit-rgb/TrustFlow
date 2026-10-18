import { supabase } from './supabase'

export async function listCompanies() {
  if (!supabase) return []
  const { data, error } = await supabase.from('companies').select('id, company_name, base_currency, policy_config, created_at').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function updateCompanyPolicy(companyId, policyConfig) {
  if (!supabase || !companyId) return policyConfig
  const { data, error } = await supabase
    .from('companies')
    .update({ policy_config: policyConfig, updated_at: new Date().toISOString() })
    .eq('id', companyId)
    .select('id, policy_config')
    .single()
  if (error) throw new Error(error.message)
  return data
}
