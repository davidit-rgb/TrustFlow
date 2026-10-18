import { supabase } from './supabase'

export const currentUser = {
  id: '00000000-0000-0000-0000-000000000001',
  full_name: 'David Admin',
  email: 'david.admin@trustflow.local',
  role: 'admin',
}

export async function getCurrentUser() {
  if (!supabase) return currentUser

  const { data, error } = await supabase
    .from('trustflow_users')
    .select('id, full_name, email, role, is_active')
    .eq('id', currentUser.id)
    .eq('is_active', true)
    .single()

  if (error) throw new Error(`No se pudo identificar al usuario revisor: ${error.message}`)
  return data
}
