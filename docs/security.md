# Seguridad

El manifiesto declara Web App con acceso `ANYONE` y ejecución `USER_ACCESSING`; el backend depende de `Session`, `Usuarios` y `requireUsuario_`. Las funciones públicas pueden ser llamadas desde `google.script.run`, por lo que toda función pública nueva debe revisar autorización server-side.

Riesgos observables: correo bootstrap hardcodeado; fallbacks de identidad; superficie pública amplia; datos sensibles en Sheets; HTML dinámico mediante `innerHTML`, atributos inline y `document.write`; logs con contexto/stack; escrituras multi-paso sin lock general; dependencia externa de feriados; y funciones de consulta como `sugerirHorariosDisponibles`, `buscarProximaFecha` y `calcularPlazosBasicos` que requieren revisión de autorización explícita.

No confiar en controles visuales del cliente. Mantener historial y logs existentes, escapar toda interpolación HTML/JS, minimizar datos sensibles en errores y revisar caché al cambiar lecturas/escrituras.

Quedan **pendientes de confirmar** los scopes OAuth efectivos, permisos Drive/Sheets, retención de logs y restricciones adicionales del despliegue.
