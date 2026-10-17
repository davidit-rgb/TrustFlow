import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const companyId = import.meta.env.VITE_TRUSTFLOW_COMPANY_ID

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && companyId)

export function getSupabaseConfigurationError() {
  if (!supabaseUrl) return 'Falta VITE_SUPABASE_URL en frontend-dashboard/.env'
  if (!supabaseAnonKey) return 'Falta VITE_SUPABASE_ANON_KEY en frontend-dashboard/.env'
  if (!companyId) return 'Falta VITE_TRUSTFLOW_COMPANY_ID en frontend-dashboard/.env'
  return null
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
