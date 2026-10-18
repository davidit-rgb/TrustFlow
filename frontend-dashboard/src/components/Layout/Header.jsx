import { isSupabaseConfigured } from '../../services/supabase'
import { currentUser } from '../../services/users'

export function Header({ user = currentUser }) {
  return <header className="topbar">
    <div className="brand"><div className="brand-mark">∞</div><div><strong>TrustFlow</strong><span>Automatización de pagos corporativos</span></div></div>
    <div className="topbar-actions"><span className={`connection ${isSupabaseConfigured ? 'online' : ''}`}><i />{isSupabaseConfigured ? 'Supabase conectado' : 'Modo demo'}</span><span className="current-user" title={user.email}>{user.full_name}</span><button className="avatar" type="button" title={user.email}>{user.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</button></div>
  </header>
}
