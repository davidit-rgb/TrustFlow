import { isSupabaseConfigured } from '../../services/supabase'

export function Header() {
  return <header className="topbar">
    <div className="brand"><div className="brand-mark">∞</div><div><strong>TrustFlow</strong><span>Automatización de pagos corporativos</span></div></div>
    <div className="topbar-actions"><span className={`connection ${isSupabaseConfigured ? 'online' : ''}`}><i />{isSupabaseConfigured ? 'Supabase conectado' : 'Modo demo'}</span><button className="avatar" type="button">DA</button></div>
  </header>
}
