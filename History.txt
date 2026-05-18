function registrarHistorial(accion, hoja, expediente, detalle) {
  let usuario = 'usuario no identificado';

  try {
    usuario = getEmailUsuarioActual_() || Session.getActiveUser().getEmail() || usuario;
  } catch (e) {}

  const sheet = getSheet('Historial');

  sheet.appendRow([
    new Date(),
    usuario,
    accion || '',
    hoja || '',
    expediente || '',
    detalle || ''
  ]);

  limpiarCacheDatos_('historial');
}

function getHistorial() {
  return getCachedJson_('ofiju_historial_v1', 120, getHistorialSinCache_);
}

function getHistorialExpediente(expediente) {
  requireUsuario_('VER');

  if (!expediente) return [];

  try {
    const buscado = normalizarTexto(expediente);
    const sheet = getSheet('Historial');
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0];
    const colExpte = buscarIndiceHeader(headers, 'EXPEDIENTE');
    const out = [];

    for (let i = data.length - 1; i >= 1 && out.length < 30; i--) {
      const row = data[i];
      const exp = colExpte >= 0 ? row[colExpte] : row[4];
      if (normalizarTexto(exp || '') === buscado) out.push(serializarFila(headers, row));
    }

    return out.reverse();
  } catch (err) {
    registrarError_('getHistorialExpediente', err, { expediente: expediente });
    throw err;
  }
}

function getEventosRevisionRecientes(limite) {
  requireUsuario_('VER');

  limite = parseInt(limite, 10) || 25;
  limite = Math.max(5, Math.min(limite, 50));

  try {
    const sheet = getSheet('Historial');
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0];
    const colAccion = buscarIndiceHeader(headers, 'ACCION');
    const acciones = ['APROBAR_AGENDADO', 'DEVOLVER_REVISION', 'SOLICITAR_AGENDADO'];
    const out = [];

    for (let i = data.length - 1; i >= 1 && out.length < limite; i--) {
      const row = data[i];
      const accion = String((colAccion >= 0 ? row[colAccion] : row[2]) || '').trim().toUpperCase();
      if (acciones.indexOf(accion) < 0) continue;
      out.push(serializarFila(headers, row));
    }

    return out;
  } catch (err) {
    registrarError_('getEventosRevisionRecientes', err, { limite: limite });
    throw err;
  }
}

function getHistorialSinCache_() {
  const sheet = getSheet('Historial');
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return [];

  const headers = data[0];
  const resultado = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const tieneAlgo = row.some(function(c) {
      return c !== '' && c !== null && typeof c !== 'undefined';
    });

    if (!tieneAlgo) continue;

    resultado.push(serializarFila(headers, row));
  }

  return resultado;
}

function registrarMovimientoExpediente(datos) {
  try {
    requireUsuario_('OPERAR');
    return registrarMovimientoExpediente_(datos || {});
  } catch (err) {
    registrarError_('registrarMovimientoExpediente', err, datos);
    throw err;
  }
}

function registrarMovimientoExpediente_(datos) {
  const expediente = String(datos.expediente || datos.nro_expediente || '').trim();
  const tipo = normalizarTipoMovimientoExpediente_(datos.tipo);
  const ubicacion = normalizarUbicacionMovimientoExpediente_(datos.ubicacion || datos.destino);
  const observacion = String(datos.observacion || datos.obs || '').trim();
  const fecha = normalizarFechaComparacion(datos.fecha) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const hora = normalizarHoraMovimientoExpediente_(datos.hora) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');

  if (!expediente) throw new Error('Falta expediente');
  if (!tipo) throw new Error('Falta tipo de movimiento');
  if (!ubicacion) throw new Error('Falta ubicacion/destino');

  const usuario = getEmailUsuarioActual_() || '';
  const sheet = asegurarHojaMovimientosExpediente_();
  const headers = getHeadersMovimientosExpediente_();
  const row = [
    Utilities.getUuid(),
    fechaInputAFechaSheet(fecha),
    hora,
    expediente,
    tipo,
    ubicacion,
    observacion,
    usuario,
    new Date()
  ];

  sheet.appendRow(row);
  limpiarCacheDatos_('movimientos');

  try {
    registrarHistorial(
      'MOVIMIENTO_EXPEDIENTE',
      'MovimientosExpediente',
      expediente,
      tipo + ' | ' + ubicacion + (observacion ? ' | ' + observacion : '')
    );
  } catch (e) {}

  return {
    ok: true,
    msg: 'Movimiento registrado',
    movimiento: serializarFila(headers, row)
  };
}

function getMovimientosExpediente(expediente) {
  try {
    requireUsuario_('VER');
    if (!expediente) return [];

    const buscado = normalizarTexto(expediente);
    const sheet = asegurarHojaMovimientosExpediente_();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0] || [];
    const colExp = buscarIndiceHeader(headers, 'EXPEDIENTE');
    const out = [];

    for (let i = data.length - 1; i >= 1 && out.length < 80; i--) {
      const row = data[i];
      const exp = colExp >= 0 ? row[colExp] : row[3];
      if (normalizarTexto(exp || '') === buscado) out.push(serializarFila(headers, row));
    }

    return out.reverse();
  } catch (err) {
    registrarError_('getMovimientosExpediente', err, { expediente: expediente });
    throw err;
  }
}

function asegurarHojaMovimientosExpediente_() {
  const ss = getSS();
  let sheet = ss.getSheetByName('MovimientosExpediente');
  const headers = getHeadersMovimientosExpediente_();

  if (!sheet) {
    sheet = ss.insertSheet('MovimientosExpediente');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  let actuales = getHeadersHoja_(sheet, 0);
  headers.forEach(function(header) {
    if (buscarIndiceHeader(actuales, header) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      actuales.push(header);
    }
  });

  return sheet;
}

function getHeadersMovimientosExpediente_() {
  return [
    'ID',
    'FECHA',
    'HORA',
    'EXPEDIENTE',
    'TIPO',
    'UBICACION_DESTINO',
    'OBSERVACION',
    'USUARIO',
    'CREADO'
  ];
}

function normalizarTipoMovimientoExpediente_(tipo) {
  const t = normalizarTexto(tipo);
  if (t === normalizarTexto('Ingreso fisico')) return 'Ingreso fisico';
  if (t === normalizarTexto('Enviado a')) return 'Enviado a';
  if (t === normalizarTexto('En OFIJU')) return 'En OFIJU';
  return String(tipo || '').trim();
}

function normalizarUbicacionMovimientoExpediente_(ubicacion) {
  const u = normalizarTexto(ubicacion);
  const permitidas = ['Recepcion', 'Juzgado', 'Agenda', 'Gestion', 'Asesoria', 'Defensoria', 'Mesa Pupilar', 'Archivo', 'Otro'];

  for (let i = 0; i < permitidas.length; i++) {
    if (u === normalizarTexto(permitidas[i])) return permitidas[i];
  }

  return String(ubicacion || '').trim();
}

function normalizarHoraMovimientoExpediente_(hora) {
  const m = String(hora || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const min = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
}
