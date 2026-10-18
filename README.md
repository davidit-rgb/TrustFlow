# TrustFlow

Dashboard React para automatizar decisiones de pagos corporativos por empresa.

## Frontend

El dashboard está en [`frontend-dashboard`](./frontend-dashboard) y usa React + Vite.

```text
frontend-dashboard/src/
├── assets/           # Recursos estáticos
├── components/       # Header, métricas, simulador, política y auditoría
├── data/             # Casos y datos de demo
├── services/         # Acceso a Supabase y webhook de n8n
├── styles/           # Hojas CSS separadas de la lógica React
│   ├── dashboard.css # Estilos de los componentes del dashboard
│   └── global.css    # Estilos globales
├── utils/            # Parser de facturas y reglas de decisión
├── App.jsx           # Estado y composición de la aplicación
└── main.jsx          # Punto de entrada React
```

## Supabase

El frontend usa las tablas `companies`, `company_vendors` y `agent_decisions`.

1. Copia `frontend-dashboard/.env.example` como `frontend-dashboard/.env`.
2. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Crea o selecciona una fila en `public.companies`.
4. Coloca su UUID en `VITE_TRUSTFLOW_COMPANY_ID`.
5. Reinicia Vite.

La clave `service_role` no debe exponerse en el frontend. Sin variables de Supabase, el dashboard funciona con datos de demo.

## Contrato del webhook de n8n

Para subir una factura, el frontend envía un `POST` `multipart/form-data` al webhook de producción con el archivo en el campo `file`.

La respuesta recomendada de n8n es un objeto JSON con estos nombres:

```json
{
  "invoice_number": "FAC-001",
  "vendor_name": "DevStudio MX",
  "original_amount": 25000,
  "original_currency": "MXN",
  "due_date": "2026-10-31",
  "concept": "Servicios"
}
```

El frontend también acepta `invoiceNumber`, `vendorName`, `amount`, `currency`, `folio`, `numero_factura`, `monto`, `moneda`, `dueDate`, `fecha_vencimiento` y respuestas envueltas en `data`, `result`, `output` o `response`. Los errores de n8n deben devolverse como `{"error":"..."}` para que no se intenten guardar como facturas.

TrustFlow calcula y guarda `decision`, `rule_triggered`, `normalized_amount`, `explanation`, `source_channel` y `applied_policy_snapshot`; n8n no debe calcular esos campos. La tabla `agent_decisions` debe conservar al menos las columnas `company_id`, `invoice_number`, `vendor_name`, `source_channel`, `original_amount`, `original_currency`, `normalized_amount`, `decision`, `rule_triggered`, `explanation` y `applied_policy_snapshot`.

### Usuario revisor y aprobación humana

Ejecuta [`database/001_human_review.sql`](./database/001_human_review.sql) en Supabase para crear el usuario operativo de ejemplo y agregar a `agent_decisions` los campos `reviewer_status`, `reviewed_by` y `reviewed_at`. El dashboard identifica inicialmente al usuario `David Admin` mediante el UUID fijo `00000000-0000-0000-0000-000000000001`; en modo Supabase valida que ese usuario exista y esté activo en `trustflow_users`.

Las facturas que superan `max_auto_pay_usd` quedan como `ESCALADO` y `reviewer_status = 'PENDING'`. Un revisor puede aprobarlas o denegarlas desde la bandeja de decisiones. Aprobar cambia la decisión a `PAGADO`; denegar la cambia a `FRENADO`, registra el usuario y la fecha de revisión, y muestra una alerta para verificar cualquier nuevo intento de pago.

La edición de reglas también persiste `companies.base_currency` y la moneda dentro de `policy_config`. El motor normaliza los montos a la moneda base seleccionada (`USD` o `MXN`) antes de aplicar presupuesto y límite automático. La columna `companies.base_currency` ya es necesaria para que `listCompanies()` funcione; si la base existente no la tiene, créala con:

```sql
alter table public.companies
  add column if not exists base_currency text not null default 'USD'
  check (base_currency in ('USD', 'MXN'));
```

El mismo script agrega la política RLS `demo_update_companies`, limitada al UUID configurado en `frontend-dashboard/.env`. Sin esa política Supabase puede devolver cero filas al actualizar, aunque la política de lectura funcione correctamente.

Para habilitar la ingesta completa y la detección de duplicados multi-canal ejecuta también [`database/002_invoice_ingestion.sql`](./database/002_invoice_ingestion.sql). Esta migración agrega fechas, concepto, indicador de folio de origen y huellas persistidas a `agent_decisions`.

Para los campos fiscales del extractor ejecuta [`database/004_webhook_invoice_totals.sql`](./database/004_webhook_invoice_totals.sql). Agrega `subtotal`, `iva`, `total`, `decision_final` y `motivo`. `decision_final` y `motivo` se conservan como evidencia del webhook; TrustFlow no los usa para aprobar, ya que siempre recalcula la decisión localmente.

Si Supabase muestra `Could not find la columna 'tiene_folio_origen'`, ejecuta [`database/003_fix_invoice_ingestion_columns.sql`](./database/003_fix_invoice_ingestion_columns.sql) en el SQL Editor y recarga el schema cache. La migración sólo agrega la columna faltante y sincroniza su valor con `has_source_folio`; las demás columnas ya deben existir por la migración de ingesta. El frontend convierte valores como `No detectada` a `NULL` y no guarda `decision_final` ni `motivo` del webhook porque la decisión debe calcularse localmente con las reglas vigentes.

El nodo Webhook de n8n siempre agrega metadatos de transporte (`headers`, `params`, `query`, `webhookUrl` y `executionMode`). TrustFlow los descarta: sólo procesa `body` y, dentro de éste, los campos de factura. Para el nodo de extracción usa `$json.body.text` en Chat/Correo o los datos binarios del archivo; el nodo `Respond to Webhook` debe devolver únicamente el objeto de factura, no el sobre completo del Webhook. Si devuelve `{"myField":"value"}`, el dashboard lo rechaza porque corresponde a la respuesta estática predeterminada de n8n.

El navegador no permite eliminar metadatos HTTP como `origin`, `referer`, `sec-*` o `x-forwarded-*`; tampoco los controla el frontend. Esos campos son agregados por el navegador, Cloudflare y n8n antes de ejecutar el workflow. El cuerpo enviado por TrustFlow para texto es deliberadamente mínimo:

```json
{
  "text": "mensaje de la factura",
  "source_channel": "Chat"
}
```

Para evitar que esos metadatos lleguen al extractor, agrega inmediatamente después del nodo **Webhook** un nodo **Code** en n8n con este contenido:

```javascript
const body = $json.body ?? {};
const text = typeof body === 'string' ? body : body.text;
const sourceChannel = typeof body === 'object' ? body.source_channel : 'Chat';

if (!String(text ?? '').trim()) {
  throw new Error('El webhook no recibió body.text.');
}

return [{
  json: {
    text: String(text).trim(),
    source_channel: sourceChannel === 'Correo' ? 'Correo' : 'Chat',
  },
}];
```

Conecta la salida de ese nodo al extractor/IA y usa `{{$json.text}}`, no `{{$json}}`. Para archivos, conserva sólo el binario de `file` y `source_channel`. Finalmente, configura **Respond to Webhook** para devolver exclusivamente el JSON de factura extraído (`invoice_number`, `vendor_name`, `original_amount`, `original_currency`, `issue_date`, `due_date` y `concept`), nunca el objeto completo del nodo Webhook.

## Cobertura del reto Blinka

El flujo implementado termina en la decisión y no mueve dinero real:

- `PAGADO`: proveedor activo, contrato válido, presupuesto disponible y monto dentro del límite automático.
- `ESCALADO`: la factura es válida, pero supera el límite automático; queda en `PENDING` hasta una acción humana.
- `FRENADO`: factura duplicada, proveedor no permitido, contrato excedido, presupuesto insuficiente, moneda no soportada o datos ilegibles.
- Cada decisión conserva la regla (`rule_triggered`), explicación, montos original/normalizado y snapshot de política.
- Una factura nunca se aprueba por falta de datos ni se permite reprocesar como nueva después de haber sido frenada.

Casos demo disponibles en el simulador: caso normal, escalamiento por monto, proveedor desconocido, contrato excedido y duplicado.

## Comandos

```powershell
cd frontend-dashboard
pnpm install
pnpm dev
pnpm run lint
pnpm run build
```
