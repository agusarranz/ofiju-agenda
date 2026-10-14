# Esquema de Google Sheets

El Spreadsheet se abre con el `SS_ID` de `Code.js`. Las hojas se localizan por nombre; los encabezados se normalizan y pueden resolverse mediante aliases o índices fallback.

## Hojas principales

- `Oralidad`: encabezados en índice 2, datos desde índice 3, expediente en índice 2. Usa ingreso, tipo, expediente, imputado, DNI, ingreso físico, audiencia, preso, actores, estado, fechas, hora, sala, duración y observaciones.
- `Debate`: encabezados en índice 2, datos desde índice 3, expediente en índice 0. Usa expediente, imputados, tipo, preso, jornadas, actores, estado, fechas, hora, duración, lugar y observaciones.
- `Participantes`: encabezados en índice 0, datos desde índice 1. Usa nombre, rol, área, contacto, activo, alias, notificaciones, máximo diario, fecha de alta, vacante y reemplazo.
- `Configuracion`: el código lee por posición estados, tipos, salas, plazos y feriados.

## Hojas auxiliares

`Usuarios`, `UsuariosActividad`, `Historial`, `LogSistema`, `DiasBloqueados`, `MovimientosExpediente`, `ImputadosExpediente` y `ReservasAsignacion` se leen o pueden crearse automáticamente. Sus columnas se definen en `Admin.js`, `History.js` y `Save.js`.

No se verificaron las hojas productivas. Quedan **pendientes de confirmar** el orden completo de encabezados, validaciones, fórmulas, protecciones y columnas usadas por procesos externos.
