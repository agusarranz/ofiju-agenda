# Arquitectura

`Code.js` define `doGet()`, renderiza `Index.html` e incluye `CSS.html` y `JS.html`. `JS.html` es el cliente monolítico: mantiene el estado global `G`, renderiza agenda, expedientes, recepción, revisión, administración, personas, estadísticas y asignación, y llama al servidor con `google.script.run`.

El backend comparte el espacio global de Apps Script. `Utils.js` abre el Spreadsheet mediante `SpreadsheetApp.openById(SS_ID)`, busca hojas y normaliza encabezados. `Data.js` lee y cachea datos. `Logic.js` verifica disponibilidad, días hábiles, plazos, sugerencias y reservas. `Save.js` escribe audiencias y operaciones. `Admin.js` aplica roles y administra usuarios, actividad, revisión y logs. `History.js` registra historial y movimientos. `People.js` mantiene participantes, alias, vacantes y reemplazos. `Calendar.js` consulta feriados externos y `DiasBloqueados`.

El manifiesto declara runtime V8, zona `America/Argentina/Buenos_Aires`, ejecución como usuario que accede y acceso `ANYONE`. La estructura real del Spreadsheet, sus protecciones y el despliegue efectivo quedan **pendientes de confirmar**.
