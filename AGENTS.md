# Instrucciones operativas

- No cambiar la estructura de Google Sheets sin autorización explícita.
- No modificar encabezados ni aliases sin revisar compatibilidad con todos sus consumidores.
- Respetar las funciones privadas terminadas en `_`; no exponerlas al cliente sin revisar autorización.
- Revisar autorización en toda nueva función pública.
- Mantener historial, actividad y auditoría de errores donde ya existan.
- No cambiar autenticación, permisos ni despliegue en tareas no relacionadas.
- Ejecutar `git diff`, `git diff --stat` y `git status` antes de finalizar.
- No ejecutar `clasp push` automáticamente.
- No modificar producción sin autorización explícita.
- No hacer commit ni push salvo solicitud explícita.

Antes de editar: leer README y `/docs`, identificar hojas/encabezados/aliases afectados, revisar cachés, auditoría y llamadas `google.script.run`.
