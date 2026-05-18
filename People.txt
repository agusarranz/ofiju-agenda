function agregarPersona(datos) {
  try {
    return agregarPersona_(datos);
  } catch (err) {
    registrarError_('agregarPersona', err, datos);
    throw err;
  }
}

function agregarPersona_(datos) {
  requireUsuario_('GESTIONAR_PARTICIPANTES');

  if (!datos) throw new Error('No se recibieron datos');
  if (!datos.nombre || String(datos.nombre).trim() === '') throw new Error('Nombre obligatorio');
  if (!datos.rol || String(datos.rol).trim() === '') throw new Error('Rol obligatorio');

  const sheet = getSheet('Participantes');
  const headers = asegurarColumnasParticipantesAsignacion_(sheet);
  const data = sheet.getDataRange().getValues();

  const nombreNuevo = String(datos.nombre || '').trim();
  const nombreNorm = normalizarTexto(nombreNuevo);

  // Evitar duplicados exactos por nombre.
  for (let i = 1; i < data.length; i++) {
    const nombreActual = normalizarTexto(data[i][0]);
    if (nombreActual && nombreActual === nombreNorm) {
      return { ok: false, msg: 'Ya existe una persona con ese nombre' };
    }
  }

  const fila = new Array(headers.length).fill('');

  setDatosPersonaEnFila_(headers, fila, datos, nombreNuevo, true);

  const filaLibre = primeraFilaLibrePorColumna_(sheet, 1, 2);
  sheet.getRange(filaLibre, 1, 1, fila.length).setValues([fila]);
  limpiarCacheDatos_('participantes');

  try {
    registrarHistorial(
      'CREAR_PERSONA',
      'Participantes',
      nombreNuevo,
      'Persona creada: ' + nombreNuevo + ' (' + String(datos.rol || '').trim() + ')'
    );
  } catch (e) {}

  return { ok: true, msg: 'Realizado' };
}

function actualizarPersona(datos) {
  try {
    return actualizarPersona_(datos);
  } catch (err) {
    registrarError_('actualizarPersona', err, datos);
    throw err;
  }
}

function actualizarPersona_(datos) {
  requireUsuario_('GESTIONAR_PARTICIPANTES');

  if (!datos) throw new Error('No se recibieron datos');
  if (!datos.nombre_original) throw new Error('Falta nombre original');
  if (!datos.nombre || String(datos.nombre).trim() === '') throw new Error('Nombre obligatorio');
  if (!datos.rol || String(datos.rol).trim() === '') throw new Error('Rol obligatorio');

  const sheet = getSheet('Participantes');
  const headers = asegurarColumnasParticipantesAsignacion_(sheet);
  const data = sheet.getDataRange().getValues();

  const colNombre = buscarIndiceHeader(headers, 'NOMBRE');
  if (colNombre < 0) throw new Error('No se encontró la columna NOMBRE');

  const originalNorm = normalizarTexto(datos.nombre_original);
  const nuevoNorm = normalizarTexto(datos.nombre);

  // Evitar renombrar a un nombre ya existente.
  for (let i = 1; i < data.length; i++) {
    const actualNorm = normalizarTexto(data[i][colNombre]);
    if (actualNorm && actualNorm === nuevoNorm && actualNorm !== originalNorm) {
      return { ok: false, msg: 'Ya existe una persona con ese nombre' };
    }
  }

  for (let i = 1; i < data.length; i++) {
    if (normalizarTexto(data[i][colNombre]) !== originalNorm) continue;

    const fila = data[i].slice();
    setDatosPersonaEnFila_(headers, fila, datos, String(datos.nombre || '').trim(), false);

    sheet.getRange(i + 1, 1, 1, fila.length).setValues([fila]);
    limpiarCacheDatos_('participantes');

    try {
      registrarHistorial(
        'EDITAR_PERSONA',
        'Participantes',
        datos.nombre,
        'Persona editada. Antes: ' + datos.nombre_original + ' / Ahora: ' + datos.nombre
      );
    } catch (e) {}

    return { ok: true, msg: 'Realizado' };
  }

  return { ok: false, msg: 'Persona no encontrada' };
}

function setDatosPersonaEnFila_(headers, fila, datos, nombre, esNueva) {
  setValorPorHeader_(headers, fila, 'NOMBRE', nombre);
  setValorPorHeader_(headers, fila, 'ROL', String(datos.rol || '').trim());
  setValorPorHeader_(headers, fila, 'AREA', datos.area || '');
  setValorPorHeader_(headers, fila, 'TELEFONO', datos.telefono || '');
  setValorPorHeader_(headers, fila, 'EMAIL', datos.email || '');
  setValorPorHeader_(headers, fila, 'ACTIVO', datos.activo === true || datos.activo === 'true');
  setValorPorHeader_(headers, fila, 'A.K.A.', datos.aka || '');
  setValorPorHeader_(headers, fila, 'RECIBE NOTIFICACIONES', datos.recibe_notificaciones === true || datos.recibe_notificaciones === 'true');
  setValorPorHeader_(headers, fila, 'OBS CONTACTO', datos.obs_contacto || datos.obs || '');
  setValorPorHeader_(headers, fila, 'OBS', datos.obs_contacto || datos.obs || '');
  setValorPorHeader_(headers, fila, 'MAX AUDIENCIAS/DIA', datos.max_audiencias_dia || datos.maximo_audiencias_dia || '');
  setValorPorHeader_(headers, fila, 'Maximo de Audiencias x dia', datos.max_audiencias_dia || datos.maximo_audiencias_dia || '');

  if (datos.fecha_alta_sorteo || (esNueva && !getValorPorHeader_(headers, fila, 'FECHA ALTA SORTEO'))) {
    setValorPorHeader_(
      headers,
      fila,
      'FECHA ALTA SORTEO',
      fechaInputAFechaSheet(datos.fecha_alta_sorteo) || new Date()
    );
  }

  // Columnas opcionales para vacantes/reemplazos. Si no existen, no rompe.
  setValorPorHeader_(headers, fila, 'ES VACANTE', datos.es_vacante === true || datos.es_vacante === 'true');
  setValorPorHeader_(headers, fila, 'REEMPLAZANTE', datos.reemplazante || '');
  setValorPorHeader_(headers, fila, 'INICIO REEMPLAZO', fechaInputAFechaSheet(datos.inicio_reemplazo));
  setValorPorHeader_(headers, fila, 'FIN REEMPLAZO', fechaInputAFechaSheet(datos.fin_reemplazo));
}

function asegurarColumnasParticipantesAsignacion_(sheet) {
  let headers = getHeadersHoja_(sheet, 0);
  ['FECHA ALTA SORTEO'].forEach(function(header) {
    if (buscarIndiceHeader(headers, header) < 0) {
      headers = asegurarColumnaHoja_(sheet, 0, header);
    }
  });
  return headers;
}

function cambiarEstadoPersona(nombre, activo) {
  try {
    return cambiarEstadoPersona_(nombre, activo);
  } catch (err) {
    registrarError_('cambiarEstadoPersona', err, { nombre: nombre, activo: activo });
    throw err;
  }
}

function cambiarEstadoPersona_(nombre, activo) {
  requireUsuario_('GESTIONAR_PARTICIPANTES');

  if (!nombre || String(nombre).trim() === '') throw new Error('Falta indicar la persona');

  const sheet = getSheet('Participantes');
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];

  const colNombre = buscarIndiceHeader(headers, 'NOMBRE');
  const colActivo = buscarIndiceHeader(headers, 'ACTIVO');

  if (colNombre < 0) throw new Error('No se encontró la columna NOMBRE');
  if (colActivo < 0) throw new Error('No se encontró la columna ACTIVO');

  const buscado = normalizarTexto(nombre);

  for (let i = 1; i < data.length; i++) {
    const actual = normalizarTexto(data[i][colNombre]);

    if (actual === buscado) {
      sheet.getRange(i + 1, colActivo + 1).setValue(activo === true || activo === 'true');
      limpiarCacheDatos_('participantes');

      try {
        registrarHistorial(
          activo ? 'REACTIVAR_PERSONA' : 'DESACTIVAR_PERSONA',
          'Participantes',
          String(nombre).trim(),
          (activo ? 'Persona reactivada: ' : 'Persona desactivada: ') + String(nombre).trim()
        );
      } catch (e) {}

      return { ok: true, msg: 'Realizado' };
    }
  }

  return { ok: false, msg: 'Persona no encontrada' };
}

function buscarParticipantePorNombreOAlias_(actor, participantes) {
  const buscado = normalizarTexto(actor);

  for (let i = 0; i < (participantes || []).length; i++) {
    const p = participantes[i];
    if (buscado && participanteCoincideConValor_(p, buscado, '')) return p;
  }

  return null;
}

function personaEsVacante_(p) {
  if (!p) return false;

  const flag = p['ES VACANTE'];
  const nombre = normalizarTexto(p['NOMBRE']);
  const aka = normalizarTexto(p['A.K.A.']);

  return esTrue_(flag) || nombre.indexOf('VACANTE') >= 0 || aka.indexOf('VACANTE') >= 0;
}

function resolverActorReal(actor, fechaStr, participantes) {
  const p = buscarParticipantePorNombreOAlias_(actor, participantes);
  if (!p) return { actorOriginal: actor, actorReal: actor, esVacante: false };

  if (!personaEsVacante_(p)) {
    return { actorOriginal: actor, actorReal: p['NOMBRE'] || actor, esVacante: false };
  }

  const reemplazante = p['REEMPLAZANTE'] || '';
  const inicio = normalizarFechaComparacion(p['INICIO REEMPLAZO']);
  const fin = normalizarFechaComparacion(p['FIN REEMPLAZO']);

  if (!reemplazante) {
    return { actorOriginal: actor, actorReal: actor, esVacante: true };
  }

  let vigente = true;
  if (inicio && fechaStr && fechaStr < inicio) vigente = false;
  if (fin && fechaStr && fechaStr > fin) vigente = false;

  if (!vigente) {
    return { actorOriginal: actor, actorReal: actor, esVacante: true };
  }

  return {
    actorOriginal: actor,
    actorReal: reemplazante,
    esVacante: true
  };
}
