import { useMemo, useState } from 'react'

export function DecisionTable({ decisions, onReview, baseCurrency }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState({ status: 'ALL', vendor: 'ALL', channel: 'ALL' })

  const vendors = useMemo(() => [...new Set(decisions.map((item) => item.vendor_name).filter(Boolean))].sort(), [decisions])
  const channels = useMemo(() => [...new Set(decisions.map((item) => item.source_channel).filter(Boolean))].sort(), [decisions])
  const filteredDecisions = useMemo(() => decisions.filter((item) => {
    const matchesStatus = filters.status === 'ALL'
      || (filters.status === 'PENDING' ? item.reviewer_status === 'PENDING' : item.decision === filters.status)
    const matchesVendor = filters.vendor === 'ALL' || item.vendor_name === filters.vendor
    const matchesChannel = filters.channel === 'ALL' || item.source_channel === filters.channel
    return matchesStatus && matchesVendor && matchesChannel
  }), [decisions, filters])
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'ALL').length

  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }))
  const clearFilters = () => setFilters({ status: 'ALL', vendor: 'ALL', channel: 'ALL' })

  return <section className="panel audit-panel">
    <div className="panel-header">
      <div><p className="eyebrow">TRAZABILIDAD</p><h2>Bandeja de decisiones</h2></div>
      <button className="filter-button" type="button" aria-expanded={isFilterOpen} onClick={() => setIsFilterOpen((current) => !current)}>Filtrar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} ▾</button>
    </div>
    {isFilterOpen && <div className="filter-panel">
      <label>Estado<select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="ALL">Todos</option><option value="PAGADO">Pagado</option><option value="FRENADO">Frenado</option><option value="PENDING">Pendiente</option><option value="ESCALADO">Escalado</option></select></label>
      <label>Proveedor<select value={filters.vendor} onChange={(event) => updateFilter('vendor', event.target.value)}><option value="ALL">Todos</option>{vendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select></label>
      <label>Canal<select value={filters.channel} onChange={(event) => updateFilter('channel', event.target.value)}><option value="ALL">Todos</option>{channels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}</select></label>
      <button className="clear-filters" type="button" onClick={clearFilters}>Limpiar filtros</button>
    </div>}
    <p className="filter-summary">Mostrando {filteredDecisions.length} de {decisions.length} decisiones</p>
    <div className="table-wrap"><table><thead><tr><th>FACTURA</th><th>PROVEEDOR</th><th>CANAL</th><th>MONTO NORMALIZADO</th><th>DECISIÓN</th><th>DETALLE / REVISIÓN</th></tr></thead><tbody>{filteredDecisions.map((item) => <tr key={item.id}><td><strong>{item.invoice_number || 'Sin folio'}</strong><small>{new Date(item.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></td><td>{item.vendor_name}</td><td><span className="channel">{item.source_channel}</span></td><td><strong>${Number(item.normalized_amount).toLocaleString()} {baseCurrency}</strong><small>${Number(item.original_amount).toLocaleString()} {item.original_currency}</small></td><td><span className={`status ${item.decision.toLowerCase()}`}>{item.decision === 'PAGADO' ? '✓ ' : item.decision === 'ESCALADO' ? '◷ ' : '× '}{item.decision}</span></td><td className="explanation">{item.explanation}{item.decision === 'ESCALADO' && item.reviewer_status === 'PENDING' && <div className="review-actions"><strong className="review-prompt">Verifica y confirma este pago:</strong><button type="button" onClick={() => onReview(item, 'APPROVED')}>Aprobar pago</button><button type="button" onClick={() => onReview(item, 'REJECTED')}>Rechazar pago</button></div>}{item.reviewer_status && item.reviewer_status !== 'PENDING' && <small>Revisión: {item.reviewer_status === 'APPROVED' ? 'aprobada' : 'rechazada'}{item.reviewed_at ? ` · ${new Date(item.reviewed_at).toLocaleString('es-MX')}` : ''}</small>}</td></tr>)}</tbody></table></div>
    {filteredDecisions.length === 0 && <p className="empty-filter-state">No hay decisiones que coincidan con los filtros seleccionados.</p>}
  </section>
}
