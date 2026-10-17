export function DashboardStats({ policy, decisions, vendors }) {
  const paidTotal = decisions.filter((item) => item.decision === 'PAGADO').reduce((total, item) => total + Number(item.normalized_amount), 0)
  const availablePercent = Math.max(0, Math.min(100, Math.round((policy.remaining / policy.budget) * 100)))

  return <section className="stats-grid">
    <article className="stat-card"><div className="stat-heading"><span>Presupuesto disponible</span><span className="stat-icon green">$</span></div><strong>${policy.remaining.toLocaleString()} <small>USD</small></strong><div className="progress"><span style={{ width: `${availablePercent}%` }} /></div><footer><span>{availablePercent}% disponible</span><span>de ${policy.budget.toLocaleString()}</span></footer></article>
    <article className="stat-card"><div className="stat-heading"><span>Pagado este mes</span><span className="stat-icon blue">↗</span></div><strong>${paidTotal.toLocaleString()} <small>USD</small></strong><footer><span className="positive">↑ 12.4%</span><span>vs. mes anterior</span></footer></article>
    <article className="stat-card"><div className="stat-heading"><span>Revisión humana</span><span className="stat-icon amber">!</span></div><strong>{decisions.filter((item) => item.decision === 'ESCALADO').length} <small>pendientes</small></strong><footer><span className="warning">Requieren atención</span><span>ahora</span></footer></article>
    <article className="stat-card"><div className="stat-heading"><span>Proveedores activos</span><span className="stat-icon purple">⌁</span></div><strong>{vendors.length} <small>en whitelist</small></strong><footer><span className="positive">Todos operativos</span></footer></article>
  </section>
}
