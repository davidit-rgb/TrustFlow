import { supabase } from './supabase'

function mapVendor(vendor) {
  return { ...vendor, maxAgreed: Number(vendor.contract_rules?.max_amount || 0) }
}

export async function listCompanyVendors(companyId) {
  if (!supabase || !companyId) return []
  const { data, error } = await supabase.from('company_vendors').select('id, company_id, vendor_name, country, currency, contract_rules, is_active').eq('company_id', companyId).eq('is_active', true).order('vendor_name')
  if (error) throw new Error(error.message)
  return data.map(mapVendor)
}

export async function createCompanyVendor(vendor) {
  if (!supabase) return { ...vendor, id: `demo-${Date.now()}`, maxAgreed: Number(vendor.maxAgreed) }
  const { data, error } = await supabase
    .from('company_vendors')
    .insert({
      company_id: vendor.company_id,
      vendor_name: vendor.vendor_name,
      country: vendor.country,
      currency: vendor.currency,
      contract_rules: { max_amount: Number(vendor.maxAgreed) },
      is_active: true,
    })
    .select('id, company_id, vendor_name, country, currency, contract_rules, is_active')
    .single()
  if (error) throw new Error(`Supabase rechazó el proveedor: ${error.message}`)
  return mapVendor(data)
}

export async function deactivateCompanyVendor(vendorId, companyId) {
  if (!supabase) return
  const { error } = await supabase
    .from('company_vendors')
    .update({ is_active: false })
    .eq('id', vendorId)
    .eq('company_id', companyId)
  if (error) throw new Error(`No se pudo desactivar el proveedor: ${error.message}`)
}
