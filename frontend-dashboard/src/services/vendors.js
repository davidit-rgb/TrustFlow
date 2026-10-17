import { supabase } from './supabase'

export async function listCompanyVendors(companyId) {
  if (!supabase || !companyId) return []
  const { data, error } = await supabase.from('company_vendors').select('id, company_id, vendor_name, country, currency, contract_rules, is_active').eq('company_id', companyId).eq('is_active', true).order('vendor_name')
  if (error) throw new Error(error.message)
  return data.map((vendor) => ({ ...vendor, maxAgreed: Number(vendor.contract_rules?.max_amount || 0) }))
}
