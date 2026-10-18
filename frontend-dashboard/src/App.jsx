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
import { createCompanyVendor, deactivateCompanyVendor, listCompanyVendors } from './services/vendors'
import { extractInvoiceFromFile } from './services/invoiceWebhook'
import { parseExtractedInvoice, parseInvoiceText } from './utils/invoiceParser'
import { evaluatePayment } from './utils/paymentRules'
import './styles/dashboard.css'

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

  useEffect(() => {
    const configurationError = getSupabaseConfigurationError()
    if (configurationError) {
      return
    }

    async function loadCompanyData() {
      try {
        const [companies, remoteVendors, remoteDecisions] = await Promise.all([
          listCompanies(),
          listCompanyVendors(companyId),
          listAgentDecisions(companyId),
        ])
        const activeCompany = companies.find((item) => item.id === companyId)
        if (!activeCompany) throw new Error('La empresa configurada no existe en public.companies')
        setCompany(activeCompany)
        setVendors(remoteVendors)
        setDecisions(remoteDecisions)
        const config = activeCompany.policy_config || {}
        setPolicy((current) => ({
          ...current,
          budget: Number(config.monthly_budget_usd || current.budget),
          remaining: Number(config.remaining_budget_usd || config.monthly_budget_usd || current.remaining),
          autoPay: Number(config.max_auto_pay_usd || current.autoPay),
        }))
      } catch (error) {
        setNotice(`No se pudieron cargar los datos de Supabase: ${error.message}`)
      }
    }

    loadCompanyData()
  }, [])

  const applyTemplate = (value) => {
    setTemplate(value)
    setPolicy(companyTemplates[value])
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
    const updates = { reviewer_status: reviewerStatus, decision: approved ? 'PAGADO' : 'FRENADO' }
    setDecisions((current) => current.map((item) => item.id === decision.id ? { ...item, ...updates } : item))
    if (approved) setPolicy((current) => ({ ...current, remaining: current.remaining - Number(decision.normalized_amount) }))
    try {
      await updateAgentDecision(decision.id, companyId, updates)
      setNotice(approved ? 'Factura aprobada por revisión humana' : 'Factura rechazada por revisión humana')
    } catch (error) {
      setNotice(`La revisión se aplicó localmente, pero no se pudo guardar: ${error.message}`)
    }
  }

  const savePolicy = async () => {
    try {
      await updateCompanyPolicy(companyId, {
        ...(company?.policy_config || {}),
        monthly_budget_usd: policy.budget,
        remaining_budget_usd: policy.remaining,
        max_auto_pay_usd: policy.autoPay,
      })
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
        ? parseExtractedInvoice(await extractInvoiceFromFile(file), vendors)
        : parseInvoiceText(rawInput, vendors)
      const newDecision = evaluatePayment({ invoice, decisions, policy })
      setDecisions((current) => [newDecision, ...current])
      if (newDecision.decision === 'PAGADO') {
        setPolicy((current) => ({ ...current, remaining: current.remaining - newDecision.normalized_amount }))
      }
      processingStage = 'guardado en Supabase'
      await createAgentDecision({
        ...newDecision,
        company_id: companyId,
        applied_policy_snapshot: policy,
      })
      setNotice(file
        ? 'Factura extraída por n8n, validada por TrustFlow y registrada'
        : isSupabaseConfigured ? 'Decisión procesada y guardada en Supabase' : 'Decisión procesada en modo demo')
    } catch (error) {
      console.error(`Error durante ${processingStage}`, error)
      const localDecisionCreated = processingStage === 'guardado en Supabase'
      setNotice(`${localDecisionCreated ? 'Decisión local creada, pero no guardada.' : `Falló el ${processingStage}.`} ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return <main className="app-shell">
    <Header />
    <section className="welcome-row">
      <div><p className="eyebrow">CONTROL CENTER / OCTUBRE 2026</p><h1>Hola, David</h1><p className="subtitle">{company ? `${company.company_name} · Supervisa cada pago. Automatiza con confianza.` : 'Supervisa cada pago. Automatiza con confianza.'}</p></div>
      <div className="company-picker"><label htmlFor="company-template">Empresa activa</label><select id="company-template" value={template} onChange={(event) => applyTemplate(event.target.value)}>{Object.entries(companyTemplates).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div>
    </section>
    {notice && <div className="notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div>}
    <DashboardStats policy={policy} decisions={decisions} vendors={vendors} />
    <section className="workspace-grid"><InvoiceSimulator channel={channel} setChannel={setChannel} rawInput={rawInput} setRawInput={setRawInput} onProcess={processInvoice} isProcessing={isProcessing} /><PolicyPanel policy={policy} setPolicy={setPolicy} vendors={vendors} onNotice={setNotice} onSave={savePolicy} onAddVendor={addVendor} onRemoveVendor={removeVendor} /></section>
    <DecisionTable decisions={decisions} onReview={reviewDecision} />
    <footer className="app-footer"><span>TrustFlow v0.1 · Motor de decisiones determinista</span><span>Última sincronización: hace un momento</span></footer>
  </main>
}

export default App
