# Despliegue

`appsscript.json` declara V8, zona `America/Argentina/Buenos_Aires`, `STACKDRIVER`, `USER_ACCESSING` y `ANYONE`. `.clasp.json` identifica el proyecto y sus extensiones.

Procedimiento seguro: leer `AGENTS.md`; revisar `git status`; comprobar impacto en hojas, aliases, cachés, permisos y auditoría; probar en copia autorizada; ejecutar `git diff` y `git diff --stat`; y solicitar autorización antes de `clasp push`, publicar o tocar producción.

La identidad efectiva, scopes, URL/versiones activas, proyecto Cloud y rollback no están verificables desde el checkout y quedan **pendientes de confirmar**.
