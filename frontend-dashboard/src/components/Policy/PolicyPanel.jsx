export function PolicyPanel({ policy, setPolicy, vendors, onNotice, onSave }) {
  return <article className="panel policy-panel"><div className="panel-header"><div><p className="eyebrow">POLÍTICA ACTIVA</p><h2>Reglas de pago</h2></div><button className="edit-button" type="button" onClick={() => onNotice('Las reglas se editan desde la plantilla activa')}>✎ Editar</button></div>
    <div className="policy-row"><span>Límite de pago automático</span><strong>$<input aria-label="Límite de pago automático" type="number" value={policy.autoPay} onChange={(event) => setPolicy({ ...policy, autoPay: Number(event.target.value) })} /> USD</strong></div>
    <div className="policy-row"><span>Moneda base</span><strong>USD <small>▾</small></strong></div>
    <div className="policy-row"><span>Validación de contrato</span><strong className="toggle-on">Activada <i>✓</i></strong></div>
    <div className="policy-row"><span>Alertas de duplicados</span><strong className="toggle-on">Activada <i>✓</i></strong></div>
    <button className="save-policy" type="button" onClick={onSave}>Guardar reglas de pago</button>
    <div className="vendor-list"><div className="vendor-title"><span>Whitelist de proveedores</span><button type="button" onClick={() => onNotice('La gestión de proveedores se conecta a company_vendors')}>+ Agregar</button></div>{vendors.map((vendor) => <div className="vendor" key={vendor.id || vendor.vendor_name}><span className="vendor-avatar">{vendor.vendor_name.charAt(0)}</span><span>{vendor.vendor_name}<small>{vendor.currency} · hasta {vendor.maxAgreed.toLocaleString()}</small></span><i>✓</i></div>)}</div>
  </article>
}
