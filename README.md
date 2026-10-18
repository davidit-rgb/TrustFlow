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
