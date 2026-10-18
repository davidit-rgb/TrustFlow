import { useState } from 'react'

export function PolicyPanel({ policy, setPolicy, vendors, onNotice, onSave, onAddVendor, onRemoveVendor, isEditing, onEdit, onCancel }) {
  const [isAddingVendor, setIsAddingVendor] = useState(false)
  const [vendorForm, setVendorForm] = useState({ vendor_name: '', country: 'MX', currency: 'MXN', maxAgreed: '' })

  const updateVendorForm = (field, value) => setVendorForm((current) => ({ ...current, [field]: value }))
  const submitVendor = async (event) => {
    event.preventDefault()
    if (!vendorForm.vendor_name.trim() || Number(vendorForm.maxAgreed) <= 0) {
      onNotice('Captura el nombre del proveedor y un límite de contrato mayor a cero')
      return
    }
    try {
      await onAddVendor({ ...vendorForm, vendor_name: vendorForm.vendor_name.trim(), maxAgreed: Number(vendorForm.maxAgreed) })
      setVendorForm({ vendor_name: '', country: 'MX', currency: 'MXN', maxAgreed: '' })
      setIsAddingVendor(false)
    } catch (error) {
      onNotice(error.message)
    }
  }

  return <article className="panel policy-panel"><div className="panel-header"><div><p className="eyebrow">POLÍTICA ACTIVA</p><h2>Reglas de pago</h2></div>{isEditing ? <div className="policy-actions"><button className="edit-button secondary" type="button" onClick={onCancel}>Cancelar</button><button className="edit-button" type="button" onClick={onSave}>Guardar</button></div> : <button className="edit-button" type="button" onClick={onEdit}>✎ Editar</button>}</div>
    <div className="policy-row"><span>Límite de pago automático</span><strong>$<input aria-label="Límite de pago automático" type="number" min="0" step="0.01" disabled={!isEditing} value={policy.autoPay} onChange={(event) => setPolicy({ ...policy, autoPay: Number(event.target.value) })} /> {policy.baseCurrency}</strong></div>
    <div className="policy-row"><span>Presupuesto mensual</span><strong>$<input aria-label="Presupuesto mensual" type="number" min="0" step="0.01" disabled={!isEditing} value={policy.budget} onChange={(event) => setPolicy({ ...policy, budget: Number(event.target.value) })} /> {policy.baseCurrency}</strong></div>
    <div className="policy-row"><span>Presupuesto restante</span><strong>$<input aria-label="Presupuesto restante" type="number" min="0" step="0.01" disabled={!isEditing} value={policy.remaining} onChange={(event) => setPolicy({ ...policy, remaining: Number(event.target.value) })} /> {policy.baseCurrency}</strong></div>
    <div className="policy-row"><label htmlFor="base-currency">Moneda base</label><strong><select id="base-currency" aria-label="Moneda base" disabled={!isEditing} value={policy.baseCurrency} onChange={(event) => setPolicy({ ...policy, baseCurrency: event.target.value })}><option value="USD">USD</option><option value="MXN">MXN</option></select></strong></div>
    <div className="policy-row"><span>Validación de contrato</span><strong className="toggle-on">Activada <i>✓</i></strong></div>
    <div className="policy-row"><span>Alertas de duplicados</span><strong className="toggle-on">Activada <i>✓</i></strong></div>
    {isEditing && <button className="save-policy" type="button" onClick={onSave}>Guardar reglas de pago</button>}
    <div className="vendor-list"><div className="vendor-title"><span>Whitelist de proveedores</span><button type="button" onClick={() => setIsAddingVendor((current) => !current)}>+ Agregar</button></div>
      {isAddingVendor && <form className="vendor-form" onSubmit={submitVendor}><input aria-label="Nombre del proveedor" placeholder="Nombre del proveedor" value={vendorForm.vendor_name} onChange={(event) => updateVendorForm('vendor_name', event.target.value)} /><div><select aria-label="País" value={vendorForm.country} onChange={(event) => updateVendorForm('country', event.target.value)}><option value="MX">MX</option><option value="US">US</option><option value="CA">CA</option><option value="ES">ES</option></select><select aria-label="Moneda" value={vendorForm.currency} onChange={(event) => updateVendorForm('currency', event.target.value)}><option value="MXN">MXN</option><option value="USD">USD</option></select><input aria-label="Límite de contrato" type="number" min="0.01" step="0.01" placeholder="Límite" value={vendorForm.maxAgreed} onChange={(event) => updateVendorForm('maxAgreed', event.target.value)} /></div><button type="submit">Guardar proveedor</button></form>}
      {vendors.map((vendor) => <div className="vendor" key={vendor.id || vendor.vendor_name}><span className="vendor-avatar">{vendor.vendor_name.charAt(0)}</span><span>{vendor.vendor_name}<small>{vendor.currency} · hasta {vendor.maxAgreed.toLocaleString()}</small></span><i>✓</i><button className="vendor-remove" type="button" onClick={() => onRemoveVendor(vendor)}>Quitar</button></div>)}</div>
  </article>
}
