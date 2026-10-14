# OFIJU Agenda

Aplicación web de Google Apps Script para gestionar audiencias, expedientes, participantes, recepción, revisión y estadísticas de OFIJU Penal Orán.

## Arquitectura

`Code.js` sirve `Index.html`; este incluye `CSS.html` y `JS.html`. El cliente llama funciones globales del backend mediante `google.script.run`. `Utils.js` centraliza acceso y esquemas de Sheets; `Data.js` lee y cachea; `Logic.js` calcula disponibilidad, plazos, sugerencias y reservas; `Save.js` persiste operaciones; `Admin.js` gestiona usuarios, permisos, revisión y logs; `History.js`, `People.js` y `Calendar.js` cubren auditoría, participantes y calendario.

Google Sheets es el almacenamiento principal. El detalle está en [docs/architecture.md](docs/architecture.md) y [docs/spreadsheet-schema.md](docs/spreadsheet-schema.md).

## Operación

La autorización está basada en `Session` y la hoja `Usuarios`. Los roles observables y sus acciones están en [docs/permissions-and-roles.md](docs/permissions-and-roles.md). Los flujos están en [docs/functional-flows.md](docs/functional-flows.md); los riesgos en [docs/security.md](docs/security.md); y el despliegue en [docs/deployment.md](docs/deployment.md).

Este checkout no incluye la configuración real del Spreadsheet ni del despliegue. Todo punto no verificable está marcado como **pendiente de confirmar**.

Leer [AGENTS.md](AGENTS.md) antes de modificar algo.
