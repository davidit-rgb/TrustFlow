import { useMemo, useState } from 'react'

export function DecisionTable({ decisions, onReview, baseCurrency }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState({ status: 'ALL', vendor: 'ALL', channel: 'ALL' })
  const [activeTag, setActiveTag] = useState('ALL')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const vendors = useMemo(() => [...new Set(decisions.map((item) => item.vendor_name).filter(Boolean))].sort(), [decisions])
  const channels = useMemo(() => [...new Set(decisions.map((item) => item.source_channel).filter(Boolean))].sort(), [decisions])
  const tagOptions = [
    { value: 'ALL', label: 'Todas', className: '' },
    { value: 'FRENADO', label: 'Frenado', className: 'frenado' },
    { value: 'ESCALADO', label: 'Escalado', className: 'escalado' },
    { value: 'APROBADO', label: 'Aprobado', className: 'aprobado' },
  ]
  const filteredDecisions = useMemo(() => decisions.filter((item) => {
    const matchesStatus = filters.status === 'ALL'
      || (filters.status === 'PENDING' ? item.reviewer_status === 'PENDING' : item.decision === filters.status)
    const matchesVendor = filters.vendor === 'ALL' || item.vendor_name === filters.vendor
    const matchesChannel = filters.channel === 'ALL' || item.source_channel === filters.channel
    const matchesTag = activeTag === 'ALL'
      || (activeTag === 'APROBADO' ? item.decision === 'PAGADO' || item.reviewer_status === 'APPROVED' : item.decision === activeTag)
    return matchesStatus && matchesVendor && matchesChannel && matchesTag
  }), [decisions, filters, activeTag])
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredDecisions.length / pageSize))
  const effectivePage = Math.min(currentPage, totalPages)
  const visibleDecisions = pageSize === 0
    ? filteredDecisions
    : filteredDecisions.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'ALL').length

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
    setCurrentPage(1)
  }
  const clearFilters = () => {
    setFilters({ status: 'ALL', vendor: 'ALL', channel: 'ALL' })
    setActiveTag('ALL')
    setCurrentPage(1)
  }
  const updateTag = (tag) => {
    setActiveTag(tag)
    setCurrentPage(1)
  }
  const updatePageSize = (value) => {
    setPageSize(Number(value))
    setCurrentPage(1)
  }

  return <section className="panel audit-panel">
    <div className="panel-header">
      <div><p className="eyebrow">TRAZABILIDAD</p><h2>Bandeja de decisiones</h2></div>
      <button className="filter-button" type="button" aria-expanded={isFilterOpen} onClick={() => setIsFilterOpen((current) => !current)}>Filtrar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} ▾</button>
    </div>
    <div className="decision-tags" aria-label="Organizar decisiones por tag">
      <span className="decision-tags-label">Organizar por tags</span>
      <div className="tag-list" role="group" aria-label="Tags de decisión">
        {tagOptions.map((tag) => <button key={tag.value} className={`decision-tag ${tag.className}${activeTag === tag.value ? ' active' : ''}`} type="button" aria-pressed={activeTag === tag.value} onClick={() => updateTag(tag.value)}>{tag.label}</button>)}
      </div>
    </div>
    {isFilterOpen && <div className="filter-panel">
      <label>Estado<select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="ALL">Todos</option><option value="PAGADO">Pagado</option><option value="FRENADO">Frenado</option><option value="PENDING">Pendiente</option><option value="ESCALADO">Escalado</option></select></label>
      <label>Proveedor<select value={filters.vendor} onChange={(event) => updateFilter('vendor', event.target.value)}><option value="ALL">Todos</option>{vendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select></label>
      <label>Canal<select value={filters.channel} onChange={(event) => updateFilter('channel', event.target.value)}><option value="ALL">Todos</option>{channels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}</select></label>
      <button className="clear-filters" type="button" onClick={clearFilters}>Limpiar filtros</button>
    </div>}
    <div className="table-toolbar"><p className="filter-summary">Mostrando {visibleDecisions.length} de {filteredDecisions.length} decisiones</p><label className="page-size-control">Mostrar<select value={pageSize} onChange={(event) => updatePageSize(event.target.value)}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="0">Todos</option></select></label></div>
    <div className="table-wrap"><table><thead><tr><th>FACTURA</th><th>PROVEEDOR</th><th>CANAL</th><th>MONTO NORMALIZADO</th><th>DECISIÓN</th><th>DETALLE / REVISIÓN</th></tr></thead><tbody>{visibleDecisions.map((item) => <tr key={item.id}><td><strong>{item.invoice_number || 'Sin folio'}</strong><small>{new Date(item.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small><small>Vence: {item.due_date || 'Sin vencimiento'}</small></td><td>{item.vendor_name}</td><td><span className="channel">{item.source_channel}</span></td><td><strong>${Number(item.normalized_amount).toLocaleString()} {baseCurrency}</strong><small>${Number(item.original_amount).toLocaleString()} {item.original_currency || 'UNKNOWN'}</small></td><td><span className={`status ${item.decision.toLowerCase()}`}>{item.decision === 'PAGADO' ? '✓ ' : item.decision === 'ESCALADO' ? '◷ ' : '× '}{item.decision}</span></td><td className="explanation">{item.explanation}{item.decision === 'ESCALADO' && item.reviewer_status === 'PENDING' && <div className="review-actions"><strong className="review-prompt">Verifica y confirma este pago:</strong><button type="button" onClick={() => onReview(item, 'APPROVED')}>Aprobar pago</button><button type="button" onClick={() => onReview(item, 'REJECTED')}>Rechazar pago</button></div>}{item.reviewer_status && item.reviewer_status !== 'PENDING' && <small>Revisión: {item.reviewer_status === 'APPROVED' ? 'aprobada' : 'rechazada'}{item.reviewed_at ? ` · ${new Date(item.reviewed_at).toLocaleString('es-MX')}` : ''}</small>}</td></tr>)}</tbody></table></div>
    {filteredDecisions.length === 0 && <p className="empty-filter-state">No hay decisiones que coincidan con los filtros seleccionados.</p>}
    {filteredDecisions.length > 0 && pageSize > 0 && <div className="pagination" aria-label="Paginación de decisiones"><button type="button" disabled={effectivePage === 1} onClick={() => setCurrentPage((page) => page - 1)}>Anterior</button><span>Página {effectivePage} de {totalPages}</span><button type="button" disabled={effectivePage === totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Siguiente</button></div>}
  </section>
}
