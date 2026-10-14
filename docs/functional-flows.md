# Flujos funcionales

1. **Carga:** `doGet` entrega la interfaz; `apiGetAllDataJson` identifica al usuario, carga Oralidad, Debate, Participantes, configuración y secciones autorizadas, y el cliente renderiza.
2. **Alta:** `guardar` delega en Oralidad o Debate, valida `OPERAR`, escribe la fila, limpia caché y registra historial.
3. **Edición:** `actualizarExpediente` localiza por expediente, resuelve aliases, recalcula fecha límite cuando corresponde, valida disponibilidad y registra cambios.
4. **Revisión:** solicitar `AGENDADO` pasa primero a `PENDIENTE - EN REVISION`; un usuario con `APROBAR_AGENDADO` puede aprobar o devolver con motivo.
5. **Disponibilidad:** combina audiencias, participantes y configuración para detectar día no hábil, solapamientos, sala, actores, bloqueos y máximos diarios.
6. **Asignación:** rankea juez/audiencista por continuidad y carga, propone turnos, reserva durante 30 minutos y confirma o libera la reserva al guardar.
7. **Recepción:** registra ingreso físico, actualiza la intervención encontrada y puede crear un movimiento.
8. **Participantes/configuración:** usuarios autorizados crean, editan, activan, bloquean participantes y gestionan opciones, plazos y días bloqueados.
9. **Auditoría:** acciones y errores se escriben en `Historial` y `LogSistema`; la actividad de usuario se actualiza desde el cliente.

Las reglas externas al código, responsabilidades operativas y significado jurídico de estados/plazos quedan **pendientes de confirmar**.
