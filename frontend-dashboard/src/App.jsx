import { useEffect, useState } from 'react'
import { Header } from './components/Layout/Header'
import { DashboardStats } from './components/Dashboard/DashboardStats'
import { InvoiceSimulator } from './components/InvoiceSimulator/InvoiceSimulator'
import { PolicyPanel } from './components/Policy/PolicyPanel'
import { DecisionTable } from './components/Audit/DecisionTable'
import { companyTemplates, demoDecisions, demoVendors } from './data/demoData'
import { listCompanies, updateCompanyPolicy } from './services/companies'
import { createAgentDecision, listAgentDecisions, updateAgentDecision } from './services/decisions'
import { companyId, getSupabaseConfigurationError, isSupabaseConfigured } from './services/supabase'
import { currentUser, getCurrentUser } from './services/users'
import { createCompanyVendor, deactivateCompanyVendor, listCompanyVendors } from './services/vendors'
import { extractInvoiceFromFile, extractInvoiceFromText } from './services/invoiceWebhook'
import { parseExtractedInvoice } from './utils/invoiceParser'
import { evaluatePayment } from './utils/paymentRules'
import { getDecisionMessage, getProcessingErrorMessage } from './utils/userMessages'
import './styles/dashboard.css'

function policyFromConfig(config) {
  return {
    budget: Number(config.monthly_budget_usd || companyTemplates.default.budget),
    remaining: Number(config.remaining_budget_usd || config.monthly_budget_usd || companyTemplates.default.remaining),
    autoPay: Number(config.max_auto_pay_usd || companyTemplates.default.autoPay),
    baseCurrency: config.base_currency || companyTemplates.default.baseCurrency,
  }
}

function App() {
  const [template, setTemplate] = useState('default')
  const [policy, setPolicy] = useState(companyTemplates.default)
  const [company, setCompany] = useState(null)
  const [decisions, setDecisions] = useState(demoDecisions)
  const [vendors, setVendors] = useState(demoVendors)
  const [rawInput, setRawInput] = useState('Hola equipo, soy de DevStudio MX, les paso el cobro de este mes por $25,000 MXN, folio DSM-99')
  const [channel, setChannel] = useState('Chat')
  const [notice, setNotice] = useState(() => {
    const configurationError = getSupabaseConfigurationError()
    return configurationError ? `Modo demo: ${configurationError}` : ''
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [modalNotice, setModalNotice] = useState(null)
  const [isEditingPolicy, setIsEditingPolicy] = useState(false)
  const [savedPolicy, setSavedPolicy] = useState(companyTemplates.default)
  const [reviewer, setReviewer] = useState(currentUser)

  useEffect(() => {
    const configurationError = getSupabaseConfigurationError()
    if (configurationError) {
      return
    }

    async function loadCompanyData() {
      try {
        const [companies, remoteVendors, remoteDecisions, activeReviewer] = await Promise.all([
          listCompanies(),
          listCompanyVendors(companyId),
          listAgentDecisions(companyId),
          getCurrentUser(),
        ])
        const activeCompany = companies.find((item) => item.id === companyId)
        if (!activeCompany) throw new Error('La empresa configurada no existe en public.companies')
        setCompany(activeCompany)
        setVendors(remoteVendors)
        setDecisions(remoteDecisions)
        setReviewer(activeReviewer)
        const config = activeCompany.policy_config || {}
        const loadedPolicy = {
          ...companyTemplates.default,
          ...policyFromConfig({ ...config, base_currency: activeCompany.base_currency || config.base_currency }),
        }
        setPolicy(loadedPolicy)
        setSavedPolicy(loadedPolicy)
      } catch (error) {
        setNotice(`No se pudieron cargar los datos de Supabase: ${error.message}`)
      }
    }

    loadCompanyData()
  }, [])

  const applyTemplate = (value) => {
    setTemplate(value)
    setPolicy(companyTemplates[value])
    setSavedPolicy(companyTemplates[value])
    setIsEditingPolicy(false)
    setNotice(`Plantilla ${companyTemplates[value].label} aplicada`)
  }

  const reviewDecision = async (decision, reviewerStatus) => {
    const approved = reviewerStatus === 'APPROVED'
    if (decision.reviewer_status !== 'PENDING') {
      setNotice('Esta factura ya fue revisada')
      return
    }

    if (approved && Number(decision.normalized_amount) > policy.remaining) {
      setNotice('No se puede aprobar: el presupuesto restante ya no es suficiente')
      return
    }
    const updates = {
      reviewer_status: reviewerStatus,
      decision: approved ? 'PAGADO' : 'FRENADO',
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
    }
    try {
      const updatedDecision = await updateAgentDecision(decision.id, companyId, updates)
      setDecisions((current) => current.map((item) => item.id === decision.id ? { ...item, ...updatedDecision } : item))
      if (approved) {
        setPolicy((current) => ({ ...current, remaining: current.remaining - Number(decision.normalized_amount) }))
        setSavedPolicy((current) => ({ ...current, remaining: current.remaining - Number(decision.normalized_amount) }))
      }
      setNotice(approved
        ? `Pago aprobado por ${reviewer.full_name}. La factura puede continuar a pago.`
        : `Pago rechazado por ${reviewer.full_name}. El usuario debe verificar y confirmar cualquier nuevo intento.`)
    } catch (error) {
      setNotice(`No se pudo registrar la revisión humana. El pago permanece pendiente: ${error.message}`)
    }
  }

  const savePolicy = async () => {
    if (policy.autoPay < 0 || policy.budget < 0 || policy.remaining < 0 || policy.remaining > policy.budget) {
      setNotice('Revisa las reglas: los montos deben ser positivos y el presupuesto restante no puede superar al mensual')
      return
    }
    try {
      const updatedConfig = {
        ...(company?.policy_config || {}),
        monthly_budget_usd: policy.budget,
        remaining_budget_usd: policy.remaining,
        max_auto_pay_usd: policy.autoPay,
        require_human_approval_above_usd: policy.autoPay,
        base_currency: policy.baseCurrency,
      }
      await updateCompanyPolicy(companyId, updatedConfig, policy.baseCurrency)
      setCompany((current) => current ? { ...current, base_currency: policy.baseCurrency, policy_config: updatedConfig } : current)
      setSavedPolicy(policy)
      setIsEditingPolicy(false)
      setNotice(isSupabaseConfigured ? 'Reglas guardadas en la política de la empresa' : 'Reglas actualizadas en modo demo')
    } catch (error) {
      setNotice(`No se pudieron guardar las reglas: ${error.message}`)
    }
  }

  const addVendor = async (vendor) => {
    const createdVendor = await createCompanyVendor({ ...vendor, company_id: companyId })
    setVendors((current) => [...current, createdVendor].sort((left, right) => left.vendor_name.localeCompare(right.vendor_name)))
    setNotice(`Proveedor ${createdVendor.vendor_name} agregado a la whitelist`)
  }

  const removeVendor = async (vendor) => {
    if (!vendor.id || !companyId) {
      setVendors((current) => current.filter((item) => item !== vendor))
      return
    }
    try {
      await deactivateCompanyVendor(vendor.id, companyId)
      setVendors((current) => current.filter((item) => item.id !== vendor.id))
      setNotice(`Proveedor ${vendor.vendor_name} retirado de la whitelist`)
    } catch (error) {
      setNotice(error.message)
    }
  }

  const processInvoice = async (file = null) => {
    setIsProcessing(true)
    let processingStage = file ? 'webhook de n8n' : 'análisis local'
    try {
      const invoice = file
        ? parseExtractedInvoice(await extractInvoiceFromFile(file, file.type.startsWith('image/') ? 'Imagen' : 'PDF'), vendors, file.type.startsWith('image/') ? 'Imagen' : 'PDF')
        : parseExtractedInvoice(await extractInvoiceFromText(rawInput, channel), vendors, channel)
      const newDecision = evaluatePayment({ invoice, decisions, policy })
      processingStage = 'guardado en Supabase'
      const savedDecision = await createAgentDecision({
        ...newDecision,
        company_id: companyId,
        reviewer_status: newDecision.reviewer_status,
        applied_policy_snapshot: policy,
      })
      setDecisions((current) => [savedDecision, ...current])
      if (newDecision.decision === 'PAGADO') {
        setPolicy((current) => ({ ...current, remaining: current.remaining - newDecision.normalized_amount }))
        setSavedPolicy((current) => ({ ...current, remaining: current.remaining - newDecision.normalized_amount }))
      }
      setModalNotice(getDecisionMessage(newDecision, { file: Boolean(file), isSupabaseConfigured, baseCurrency: policy.baseCurrency }))
    } catch (error) {
      console.error(`Error durante ${processingStage}`, error)
      const localDecisionCreated = processingStage === 'guardado en Supabase'
      if (localDecisionCreated) {
        setModalNotice(getProcessingErrorMessage(error, processingStage))
      }
      if (!localDecisionCreated) {
        setModalNotice(getProcessingErrorMessage(error, processingStage))
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return <main className="app-shell">
    <Header user={reviewer} />
    <section className="welcome-row">
      <div><p className="eyebrow">CONTROL CENTER / OCTUBRE 2026</p><h1>Bienvenido a TrustFlow </h1><p className="subtitle">{company ? `${company.company_name} · Supervisa cada pago. Automatiza con confianza.` : 'Supervisa cada pago. Automatiza con confianza.'}</p></div>
      <div className="company-picker"><label htmlFor="company-template">Empresa activa</label><select id="company-template" value={template} onChange={(event) => applyTemplate(event.target.value)}>{Object.entries(companyTemplates).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div>
    </section>
    {notice && <div className="notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
    {modalNotice && <div className="modal-backdrop" role="presentation"><section className={`result-modal ${modalNotice.tone}`} role="dialog" aria-modal="true" aria-labelledby="result-modal-title"><button className="modal-close" type="button" aria-label="Cerrar resultado" onClick={() => setModalNotice(null)}>×</button><div className="modal-icon" aria-hidden="true">{modalNotice.tone === 'success' ? '✓' : modalNotice.tone === 'warning' ? '!' : '×'}</div><p className="eyebrow" id="result-modal-title">RESPUESTA DE TRUSTFLOW</p><h2 className="modal-title">{modalNotice.title}</h2><p className="modal-message">{modalNotice.message}</p><button className="modal-confirm" type="button" onClick={() => setModalNotice(null)}>Entendido</button></section></div>}
    <DashboardStats policy={policy} decisions={decisions} vendors={vendors} />
    <section className="workspace-grid"><InvoiceSimulator channel={channel} setChannel={setChannel} rawInput={rawInput} setRawInput={setRawInput} onProcess={processInvoice} isProcessing={isProcessing} /><PolicyPanel policy={policy} setPolicy={setPolicy} vendors={vendors} onNotice={setNotice} onSave={savePolicy} onEdit={() => setIsEditingPolicy(true)} onCancel={() => { setPolicy(savedPolicy); setIsEditingPolicy(false) }} isEditing={isEditingPolicy} onAddVendor={addVendor} onRemoveVendor={removeVendor} /></section>
    <DecisionTable decisions={decisions} baseCurrency={policy.baseCurrency} onReview={reviewDecision} />
    <footer className="app-footer"><span>TrustFlow v0.1 · Motor de decisiones determinista</span><span>Última sincronización: hace un momento</span></footer>
  </main>
}

export default App
