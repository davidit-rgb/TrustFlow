import { useState } from 'react'
import { presetCases } from '../../data/demoData'

export function InvoiceSimulator({ channel, setChannel, rawInput, setRawInput, onProcess, isProcessing }) {
  const [selectedFile, setSelectedFile] = useState(null)

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    if (file?.type.startsWith('image/')) setChannel('Imagen')
    else if (file) setChannel('PDF')
  }

  return <article className="panel simulator">
    <div className="panel-header"><div><p className="eyebrow">AUTOMATIZACIÓN</p><h2>Procesar factura</h2></div><span className="live-badge">● Motor activo</span></div>
    <div className="tabs"><button className={channel === 'Chat' || channel === 'Correo' ? 'active' : ''} type="button" onClick={() => setChannel('Chat')}>▤ Chat / correo</button><button className={channel === 'PDF' || channel === 'Imagen' ? 'active' : ''} type="button" onClick={() => setChannel('PDF')}>▧ Subir archivo</button></div>
    {channel === 'Chat' || channel === 'Correo' ? <><label className="field-label" htmlFor="invoice-message">Mensaje recibido</label><textarea id="invoice-message" value={rawInput} onChange={(event) => setRawInput(event.target.value)} /><div className="presets"><span className="presets-label">Origen</span><button className={`source-option ${channel === 'Chat' ? 'active' : ''}`} type="button" onClick={() => setChannel('Chat')}>Chat</button><button className={`source-option ${channel === 'Correo' ? 'active' : ''}`} type="button" onClick={() => setChannel('Correo')}>Correo</button><span className="presets-label quick-cases-label">Casos rápidos</span>{presetCases.map((item, index) => <button key={item} type="button" aria-label={`Cargar caso ${index + 1}`} onClick={() => setRawInput(item)}>{index + 1}</button>)}</div></> : <label className="dropzone"><span>↑</span><strong>{selectedFile ? selectedFile.name : 'Selecciona tu factura'}</strong><small>PDF, PNG o JPG hasta 10 MB · se enviará al extractor</small><input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={handleFileChange} /></label>}
    <button className="primary-action" type="button" onClick={() => onProcess(channel === 'PDF' || channel === 'Imagen' ? selectedFile : null)} disabled={isProcessing || ((channel === 'PDF' || channel === 'Imagen') && !selectedFile)}>{isProcessing ? 'Extrayendo y analizando...' : channel === 'PDF' || channel === 'Imagen' ? 'Extraer y decidir' : 'Analizar y decidir'} <span>→</span></button><p className="helper">El motor validará fechas, duplicados multi-canal, whitelist, contrato, presupuesto y límite automático.</p>
  </article>
}
