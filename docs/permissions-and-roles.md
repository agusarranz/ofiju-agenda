# Permisos y roles

`Admin.js` intenta obtener `Session.getActiveUser().getEmail()` y tiene fallbacks hacia usuario efectivo, propietario y correo bootstrap. Luego consulta `Usuarios` y exige usuario activo con rol permitido.

Roles definidos: `SUPERADMIN`, `ADMIN`, `GESTOR`, `CONSULTA`.

| Acción | SUPERADMIN | ADMIN | GESTOR | CONSULTA |
|---|---:|---:|---:|---:|
| VER | Sí | Sí | Sí | Sí |
| OPERAR | Sí | Sí | Sí | No |
| APROBAR_AGENDADO | Sí | Sí | No | No |
| GESTIONAR_PARTICIPANTES | Sí | Sí | Sí | No |
| VER_USUARIOS / GESTIONAR_USUARIOS | Sí | Sí | No | No |
| GESTIONAR_CONFIG | Sí | Sí | No | No |
| VER_LOGS / GESTIONAR_LOGS | Sí | Sí | No | No |
| ELIMINAR | Sí | Sí | No | No |

`requireUsuario_(accion)` es el control server-side de las mutaciones principales. Si `Usuarios` está vacío, el código puede inicializar un primer superadmin mediante la identidad detectada o el bootstrap configurado.

Quedan **pendientes de confirmar** los usuarios reales, grupos de Google, resultado efectivo de `Session` y permisos directos del Spreadsheet.
