function verificarDisponibilidad(params) {
  return verificarDisponibilidadConDatos_(
    params,
    getOralidad().concat(getDebate()),
    getParticipantes(),
    getConfiguracion()
  );
}

function verificarDisponibilidadConDatos_(params, todas, participantes, config) {
  if (!params) throw new Error('No se recibieron parámetros');

  const fechaStr = normalizarFechaComparacion(params.fecha);
  const horaIni = params.hora_inicio || params.hora || '';
  const duracion = parseInt(params.duracion, 10) || 60;
  const sala = params.sala || '';
  const actoresOriginales = params.actores || [];
  const excluirExpediente = normalizarTexto(params.excluirExpediente || '');

  const actores = obtenerActoresEfectivos_(actoresOriginales, fechaStr, participantes);

  const iniMin = horaAMin(horaIni);
  const finMin = iniMin + duracion;

  const conflictos = [];

  detectarFeriado(fechaStr, conflictos);

  todas.forEach(function(a) {
    const expteActual = normalizarTexto(expedienteAudienciaBackend_(a));
    if (excluirExpediente && expteActual === excluirExpediente) return;

    const fechaAud = normalizarFechaComparacion(
      a['DIA'] || a['FECHA AUDIENCIA'] || a['FECHA'] || ''
    );

    if (!fechaAud || fechaAud !== fechaStr) return;

    const estado = normalizarTexto(a['ESTADO']);
    if (estado === 'CANCELADA' || estado === 'REALIZADA') return;

    const horaAud = a['HORA INICIO'] || a['HORA DE INICIO'] || a['HORA'] || '';
    if (!horaAud || !horaIni) return;

    const iniA = horaAMin(horaAud);
    const durA = parseInt(a['DURACION'], 10) || 60;
    const finA = iniA + durA;

    const solapan = iniMin < finA && finMin > iniA;
    if (!solapan) return;

    detectarConflictoSala(a, sala, iniA, finA, conflictos);
    detectarConflictoActores(a, actores, participantes, fechaStr, conflictos);
  });

  detectarBloqueos(participantes, actoresOriginales, fechaStr, conflictos);
  detectarBloqueos(participantes, actores, fechaStr, conflictos);

  detectarMaximoAudienciasPorDia_(
    todas,
    participantes,
    actores,
    fechaStr,
    excluirExpediente,
    conflictos
  );

  return {
    ok: conflictos.length === 0,
    conflictos: conflictos
  };
}

function obtenerActoresEfectivos_(actores, fechaStr, participantes) {
  const out = [];

  (actores || []).forEach(function(actor) {
    if (!actor) return;

    const resuelto = resolverActorReal(actor, fechaStr, participantes);

    if (resuelto && resuelto.actorReal) {
      out.push(resuelto.actorReal);
    } else {
      out.push(actor);
    }
  });

  return unicos(out);
}

function detectarConflictoSala(a, sala, iniA, finA, conflictos) {
  if (!sala) return;

  const salaAud = a['SALA'] || a['LUGAR CONFIRM.'] || a['LUGAR'] || '';

  if (normalizarTexto(salaAud) === normalizarTexto(sala)) {
    conflictos.push({
      tipo: 'SALA',
      detalle: sala + ' ocupada de ' + minAHora(iniA) + ' a ' + minAHora(finA),
      expediente: expedienteAudienciaBackend_(a) || '-'
    });
  }
}

function detectarConflictoActores(a, actores, participantes, fechaStr, conflictos) {
  if (!actores || actores.length === 0) return;

  const columnas = getColumnasActores_();

  actores.forEach(function(actor) {
    if (!normalizarTexto(actor)) return;

    columnas.forEach(function(col) {
      const valor = a[col] || '';

      if (actorCoincideEnFecha_(valor, actor, participantes, fechaStr)) {
        conflictos.push({
          tipo: 'ACTOR',
          detalle: actor + ' ya asignado como ' + col,
          expediente: expedienteAudienciaBackend_(a) || '-'
        });
      }
    });
  });
}

function actorCoincideEnFecha_(valorAudiencia, actorPedido, participantes, fechaStr) {
  const valores = splitActoresLogica_(valorAudiencia);
  const pedidos = splitActoresLogica_(actorPedido);

  for (let i = 0; i < valores.length; i++) {
    for (let j = 0; j < pedidos.length; j++) {
      const resA = resolverActorReal(valores[i], fechaStr, participantes);
      const resB = resolverActorReal(pedidos[j], fechaStr, participantes);

      const realA = resA && resA.actorReal ? resA.actorReal : valores[i];
      const realB = resB && resB.actorReal ? resB.actorReal : pedidos[j];

      if (actorCoincide_(realA, realB, participantes)) return true;
    }
  }

  return false;
}

function actorCoincide_(valorAudiencia, actorPedido, participantes) {
  const valor = normalizarTexto(valorAudiencia);
  const actor = normalizarTexto(actorPedido);

  if (!valor || !actor) return false;
  if (valor === actor) return true;

  const alternativasActor = alternativasActor_(actorPedido, participantes);
  if (alternativasActor.indexOf(valor) >= 0) return true;

  const alternativasValor = alternativasActor_(valorAudiencia, participantes);
  return alternativasValor.indexOf(actor) >= 0;
}

function alternativasActor_(actor, participantes) {
  const buscado = normalizarTexto(actor);
  const out = [buscado];

  (participantes || []).forEach(function(p) {
    if (buscado && participanteCoincideConValor_(p, buscado, '')) {
      valoresParticipanteComparacion_(p, '').forEach(function(v) {
        if (v) out.push(v);
      });
    }
  });

  return out.filter(function(x, i, arr) {
    return x && arr.indexOf(x) === i;
  });
}

function detectarBloqueos(participantes, actores, fechaStr, conflictos) {
  if (!actores || actores.length === 0) return;

  actores.forEach(function(actor) {
    const actorNorm = normalizarTexto(actor);
    if (!actorNorm) return;

    participantes.forEach(function(p) {
      if (!participanteCoincideConValor_(p, actorNorm, '')) return;

      const inicio = normalizarFechaComparacion(p['INICIO AUSENCIA']);
      const fin = normalizarFechaComparacion(p['FIN AUSENCIA']);

      if (!inicio || !fin) return;

      if (fechaStr >= inicio && fechaStr <= fin) {
        agregarConflictoUnico_(conflictos, {
          tipo: 'BLOQUEO',
          detalle: (p['NOMBRE'] || actor) + ' no disponible (' + (p['MOTIVO AUSENCIA'] || 'ausencia') + ')',
          expediente: '-'
        });
      }
    });
  });
}

function agregarConflictoUnico_(conflictos, conflicto) {
  const clave =
    normalizarTexto(conflicto.tipo) + '|' +
    normalizarTexto(conflicto.detalle) + '|' +
    normalizarTexto(conflicto.expediente);

  const existe = conflictos.some(function(c) {
    return (
      normalizarTexto(c.tipo) + '|' +
      normalizarTexto(c.detalle) + '|' +
      normalizarTexto(c.expediente)
    ) === clave;
  });

  if (!existe) conflictos.push(conflicto);
}

function detectarMaximoAudienciasPorDia_(todas, participantes, actores, fechaStr, excluirExpediente, conflictos) {
  if (!actores || actores.length === 0) return;

  const columnasActores = getColumnasActores_();

  actores.forEach(function(actor) {
    if (!actor) return;

    const p = buscarParticipantePorNombreOAka_(participantes, actor);
    if (!p) return;

    const maxRaw =
      p['Maximo de Audiencias x dia'] ||
      p['MAX AUDIENCIAS/DIA'] ||
      p['MAXIMO DE AUDIENCIAS X DIA'] ||
      p['MAXIMO AUDIENCIAS DIA'] ||
      '';

    const max = parseInt(maxRaw, 10);
    if (!max || max <= 0) return;

    let cantidad = 0;

    todas.forEach(function(a) {
      const expteActual = normalizarTexto(expedienteAudienciaBackend_(a));
      if (excluirExpediente && expteActual === excluirExpediente) return;

      const fechaAud = normalizarFechaComparacion(
        a['DIA'] || a['FECHA AUDIENCIA'] || a['FECHA'] || ''
      );

      if (fechaAud !== fechaStr) return;

      const estado = normalizarTexto(a['ESTADO']);
      if (estado === 'CANCELADA' || estado === 'REALIZADA') return;

      const aparece = columnasActores.some(function(col) {
        return actorCoincideEnFecha_(a[col] || '', actor, participantes, fechaStr);
      });

      if (aparece) cantidad++;
    });

    if (cantidad >= max) {
      conflictos.push({
        tipo: 'MAXIMO_DIA',
        detalle: (p['NOMBRE'] || actor) + ' ya alcanzó el máximo de audiencias del día (' + max + ')',
        expediente: '-'
      });
    }
  });
}

function detectarFeriado(fechaStr, conflictos) {
  if (!fechaStr) return;

  if (!esDiaHabil(fechaStr)) {
    conflictos.push({
      tipo: 'NO_HABIL',
      detalle: 'La fecha no es hábil (fin de semana, feriado nacional o día bloqueado)',
      expediente: '-'
    });
  }
}

function sugerirHorariosDisponibles(params) {
  if (!params) throw new Error('No se recibieron parámetros');

  const todas = getOralidad().concat(getDebate());
  const participantes = getParticipantes();
  const config = getConfiguracion();

  const fecha = params.fecha;
  const sala = params.sala || '';
  const actores = params.actores || [];
  const duracion = parseInt(params.duracion, 10) || 60;

  const inicioDia = horaAMin(params.inicio_jornada || '08:00');
  const finDia = horaAMin(params.fin_jornada || '14:00');
  const paso = parseInt(params.paso, 10) || 30;

  const sugerencias = [];

  for (let m = inicioDia; m + duracion <= finDia; m += paso) {
    const hora = minAHora(m);

    const res = verificarDisponibilidadConDatos_(
      { fecha: fecha, hora_inicio: hora, duracion: duracion, sala: sala, actores: actores },
      todas,
      participantes,
      config
    );

    if (res.ok) {
      sugerencias.push({
        fecha: normalizarFechaComparacion(fecha),
        hora: hora,
        sala: sala || 'Sin sala definida',
        duracion: duracion
      });
    }

    if (sugerencias.length >= 5) break;
  }

  return {
    ok: sugerencias.length > 0,
    sugerencias: sugerencias
  };
}

function buscarProximaFecha(params) {
  if (!params) throw new Error('No se recibieron parámetros');

  const todas = getOralidad().concat(getDebate());
  const participantes = getParticipantes();
  const config = getConfiguracion();

  const sala = params.sala || '';
  const actores = params.actores || [];
  const duracion = parseInt(params.duracion, 10) || 60;
  const desdeMin = horaAMin(params.hora_desde || '08:00');
  const hastaMin = horaAMin(params.hora_hasta || '13:00');
  const offset = parseInt(params.offset_dias, 10) || 0;
  const maxDias = parseInt(params.max_dias, 10) || 15;
  const paso = parseInt(params.paso, 10) || 30;

  const base = new Date();
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() + offset);

  const sugerencias = [];

  for (let d = 0; d <= maxDias && sugerencias.length < 5; d++) {
    const fecha = new Date(base);
    fecha.setDate(base.getDate() + d);

    const fechaStr = Utilities.formatDate(
      fecha,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    if (!esDiaHabil(fechaStr)) continue;

    for (let m = desdeMin; m + duracion <= hastaMin && sugerencias.length < 5; m += paso) {
      const hora = minAHora(m);

      const res = verificarDisponibilidadConDatos_(
        {
          fecha: fechaStr,
          hora_inicio: hora,
          duracion: duracion,
          sala: sala,
          actores: actores
        },
        todas,
        participantes,
        config
      );

      if (res.ok) {
        sugerencias.push({
          fecha: fechaStr.split('-').reverse().join('/'),
          hora: hora,
          sala: sala || 'Sin sala definida',
          duracion: duracion
        });
      }
    }
  }

  return {
    ok: sugerencias.length > 0,
    sugerencias: sugerencias
  };
}

function calcularPlazosBasicos() {
  const todas = getOralidad().concat(getDebate());
  const hoy = new Date();

  const vencidos = [];
  const criticos = [];

  todas.forEach(function(a) {
    const estado = normalizarTexto(a['ESTADO']);

    if (!estadoCuentaParaPlazo_(estado)) return;

    const fechaLimite = parseFechaDDMMYYYY(a['FECHA LIMITE']);
    if (!fechaLimite) return;

    const dias = diferenciaDias(hoy, fechaLimite);

    const item = {
      expediente: expedienteAudienciaBackend_(a) || '-',
      fecha_limite: a['FECHA LIMITE'],
      dias: dias
    };

    if (dias < 0) vencidos.push(item);
    else if (dias <= 3) criticos.push(item);
  });

  return {
    vencidos: vencidos,
    criticos: criticos
  };
}

function buscarParticipantePorNombreOAka_(participantes, actor) {
  const buscado = normalizarTexto(actor);

  return (participantes || []).filter(function(p) {
    return participanteCoincideConValor_(p, buscado, '');
  })[0] || null;
}

function expedienteAudienciaBackend_(a) {
  return a ? (
    a['Nº EXPEDIENTE'] ||
    a['Nº EXPTE'] ||
    a['NÂº EXPEDIENTE'] ||
    a['NÂº EXPTE'] ||
    a['NRO EXPEDIENTE'] ||
    a['NRO EXPTE'] ||
    ''
  ) : '';
}

function getColumnasActores_() {
  return [
    'JUEZ',
    'FISCAL',
    'DEFENSA',
    'AUDIENCISTA',
    'ASESOR - QTE',
    'ASESOR / QTE',
    'SECRETARIO'
  ];
}

function splitActoresLogica_(v) {
  return String(v || '')
    .split(/\s*\/\s*|\s*,\s*|\s*;\s*/)
    .map(function(x) { return String(x || '').trim(); })
    .filter(Boolean);
}

const ASIGNACION_ORALIDAD_TTL_MINUTOS = 30;
const ASIGNACION_ORALIDAD_MAX_SUGERENCIAS = 2;

function sugerirFechaActoresOralidad(params) {
  try {
    requireUsuario_('OPERAR');
    return sugerirFechaActoresOralidad_(params || {});
  } catch (err) {
    registrarError_('sugerirFechaActoresOralidad', err, params);
    throw err;
  }
}

function sugerirFechaActoresOralidad_(params) {
  const expediente = String(params.nro_expediente || params.expediente || '').trim();
  if (!expediente) throw new Error('Falta indicar expediente');

  const oralidad = getOralidad();
  const todas = oralidad.concat(getDebate());
  const participantes = getParticipantes();
  const config = getConfiguracion();
  const reservas = getReservasAsignacionActivas_();

  const fechaLimite = normalizarFechaComparacion(
    params.fecha_limite || buscarFechaLimiteOralidad_(expediente, oralidad)
  );
  const hoy = fechaHoyAsignacion_();
  const desde = normalizarFechaComparacion(params.desde) || hoy;
  const hasta = fechaLimite || fechaMasDiasAsignacion_(desde, parseInt(params.max_dias, 10) || 30);

  if (hasta < desde) {
    return {
      ok: false,
      msg: 'El plazo limite ya vencio o es anterior a la fecha actual',
      sugerencias: [],
      continuidad: {}
    };
  }

  const duracion = parseInt(params.duracion, 10) || 60;
  const horaDesde = params.hora_desde || '08:00';
  const horaHasta = params.hora_hasta || '13:00';
  const paso = parseInt(params.paso, 10) || 30;
  const salas = salasAsignacionOralidad_(params, config);
  const continuidad = continuidadExpedienteOralidad_(expediente, oralidad, participantes);
  const juezPreferido = String(params.juez_preferido || params.juez_preferido_temporal || '').trim();
  const audiencistaPreferida = String(params.audiencista_preferida || params.audiencista_preferida_temporal || '').trim();

  let jueces = rankearCandidatosAsignacion_(
    candidatosRolAsignacion_(participantes, 'JUEZ'),
    'JUEZ',
    continuidad.jueces,
    oralidad,
    reservas,
    participantes,
    hoy
  );

  let audiencistas = rankearCandidatosAsignacion_(
    candidatosRolAsignacion_(participantes, 'AUDIENCISTA'),
    'AUDIENCISTA',
    continuidad.audiencistas,
    oralidad,
    reservas,
    participantes,
    hoy
  );

  jueces = filtrarCandidatosPreferidosAsignacion_(jueces, juezPreferido, participantes);
  audiencistas = filtrarCandidatosPreferidosAsignacion_(audiencistas, audiencistaPreferida, participantes);

  if (juezPreferido && !jueces.length) {
    return {
      ok: false,
      msg: 'El juez seleccionado no coincide con una persona activa disponible para sugerir.',
      sugerencias: [],
      continuidad: {
        jueces: continuidad.jueces,
        audiencistas: continuidad.audiencistas
      }
    };
  }

  if (audiencistaPreferida && !audiencistas.length) {
    return {
      ok: false,
      msg: 'El audiencista seleccionado no coincide con una persona activa disponible para sugerir.',
      sugerencias: [],
      continuidad: {
        jueces: continuidad.jueces,
        audiencistas: continuidad.audiencistas
      }
    };
  }

  const combos = generarCombosAsignacion_(jueces, audiencistas);
  const sugerencias = [];

  for (let i = 0; i < combos.length && sugerencias.length < ASIGNACION_ORALIDAD_MAX_SUGERENCIAS; i++) {
    const turno = buscarTurnoParaComboAsignacion_({
      combo: combos[i],
      expediente: expediente,
      desde: desde,
      hasta: hasta,
      horaDesde: horaDesde,
      horaHasta: horaHasta,
      paso: paso,
      duracion: duracion,
      salas: salas,
      todas: todas,
      participantes: participantes,
      config: config,
      reservas: reservas
    });

    if (turno) {
      const sugerencia = crearSugerenciaAsignacion_(turno, combos[i], continuidad, fechaLimite);
      if (juezPreferido || audiencistaPreferida) {
        sugerencia.motivos.unshift('Se tomo como prioridad la seleccion temporal hecha en la ficha.');
      }
      sugerencias.push(sugerencia);
    }
  }

  return {
    ok: sugerencias.length > 0,
    msg: sugerencias.length ? 'Sugerencias disponibles' : 'No se encontraron turnos disponibles dentro del plazo',
    sugerencias: sugerencias,
    continuidad: {
      jueces: continuidad.jueces,
      audiencistas: continuidad.audiencistas
    },
    ventana: {
      desde: desde,
      hasta: hasta,
      fechaLimite: fechaLimite || ''
    }
  };
}

function reservarSugerenciaOralidad(datos) {
  let lock = null;
  try {
    requireUsuario_('OPERAR');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('No se pudo tomar el bloqueo de asignacion. Intenta nuevamente.');
    return reservarSugerenciaOralidad_(datos || {});
  } catch (err) {
    registrarError_('reservarSugerenciaOralidad', err, datos);
    throw err;
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

function reservarSugerenciaOralidad_(datos) {
  const expediente = String(datos.nro_expediente || datos.expediente || '').trim();
  const juez = String(datos.juez || '').trim();
  const audiencista = String(datos.audiencista || '').trim();
  const fecha = normalizarFechaComparacion(datos.fecha);
  const hora = String(datos.hora || datos.hora_inicio || '').trim();
  const sala = String(datos.sala || '').trim();
  const duracion = parseInt(datos.duracion, 10) || 60;

  if (!expediente || !juez || !audiencista || !fecha || !hora || !sala) {
    throw new Error('Faltan datos para reservar la asignacion');
  }

  const sheet = asegurarHojaReservasAsignacion_();
  vencerReservasAsignacion_(sheet);
  liberarReservasAbiertasExpediente_(sheet, expediente, 'Nueva reserva para el expediente');

  const reservas = getReservasAsignacionActivas_();
  const participantes = getParticipantes();
  const todas = getOralidad().concat(getDebate());
  const config = getConfiguracion();
  const disp = verificarDisponibilidadParaSugerencia_(
    {
      fecha: fecha,
      hora_inicio: hora,
      duracion: duracion,
      sala: sala,
      actores: [juez, audiencista],
      excluirExpediente: expediente
    },
    todas,
    participantes,
    config,
    reservas
  );

  if (!disp.ok) {
    return {
      ok: false,
      msg: 'La sugerencia ya no esta disponible',
      conflictos: disp.conflictos
    };
  }

  const usuario = getEmailUsuarioActual_() || '';
  const id = Utilities.getUuid();
  const ahora = new Date();
  const vence = new Date(ahora.getTime() + ASIGNACION_ORALIDAD_TTL_MINUTOS * 60000);
  const headers = getHeadersReservasAsignacion_();
  const row = [
    id,
    ahora,
    vence,
    usuario,
    expediente,
    'Oralidad',
    juez,
    audiencista,
    fechaInputAFechaSheet(fecha),
    hora,
    duracion,
    sala,
    'RESERVADA',
    datos.motivo || '',
    ''
  ];

  sheet.appendRow(row);

  registrarHistorial(
    'RESERVAR_ASIGNACION',
    'ReservasAsignacion',
    expediente,
    'Juez: ' + juez + ' | Audiencista: ' + audiencista + ' | ' + fecha + ' ' + hora + ' | ' + sala
  );

  return {
    ok: true,
    msg: 'Asignacion reservada',
    reserva: serializarFila(headers, row),
    reservaId: id,
    vence: Utilities.formatDate(vence, Session.getScriptTimeZone(), 'HH:mm')
  };
}

function liberarReservaAsignacion(datos) {
  try {
    requireUsuario_('OPERAR');
    return liberarReservaAsignacion_(datos || {});
  } catch (err) {
    registrarError_('liberarReservaAsignacion', err, datos);
    throw err;
  }
}

function liberarReservaAsignacion_(datos) {
  const id = String(datos.id || datos.reserva_id || '').trim();
  if (!id) return { ok: false, msg: 'Falta reserva' };

  const sheet = asegurarHojaReservasAsignacion_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const colId = buscarIndiceHeader(headers, 'ID');
  const colEstado = buscarIndiceHeader(headers, 'ESTADO');
  const colMotivo = buscarIndiceHeader(headers, 'MOTIVO');
  const colExp = buscarIndiceHeader(headers, 'EXPEDIENTE');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colId] || '') !== id) continue;
    if (String(data[i][colEstado] || '').toUpperCase() !== 'RESERVADA') {
      return { ok: true, msg: 'La reserva ya no estaba activa' };
    }

    sheet.getRange(i + 1, colEstado + 1).setValue('LIBERADA');
    if (colMotivo >= 0) sheet.getRange(i + 1, colMotivo + 1).setValue(datos.motivo || 'Liberada por usuario');

    registrarHistorial(
      'LIBERAR_RESERVA_ASIGNACION',
      'ReservasAsignacion',
      colExp >= 0 ? data[i][colExp] : '',
      datos.motivo || 'Liberada por usuario'
    );

    return { ok: true, msg: 'Reserva liberada' };
  }

  return { ok: false, msg: 'Reserva no encontrada' };
}

function confirmarReservaAsignacion_(id, hoja, expediente, filaFinal) {
  if (!id) return;

  const sheet = asegurarHojaReservasAsignacion_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const colId = buscarIndiceHeader(headers, 'ID');
  const colEstado = buscarIndiceHeader(headers, 'ESTADO');
  const colMotivo = buscarIndiceHeader(headers, 'MOTIVO');
  const colConfirmado = buscarIndiceHeader(headers, 'CONFIRMADO_EN');
  const colExp = buscarIndiceHeader(headers, 'EXPEDIENTE');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colId] || '') !== String(id)) continue;
    if (String(data[i][colEstado] || '').toUpperCase() !== 'RESERVADA') return;

    const reserva = serializarFila(headers, data[i]);
    const coincide =
      normalizarTexto(reserva['EXPEDIENTE']) === normalizarTexto(expediente) &&
      normalizarTexto(reserva['HOJA']) === normalizarTexto(hoja) &&
      normalizarTexto(reserva['JUEZ']) === normalizarTexto(filaFinal['JUEZ']) &&
      normalizarTexto(reserva['AUDIENCISTA']) === normalizarTexto(filaFinal['AUDIENCISTA']) &&
      normalizarFechaComparacion(reserva['FECHA_AUDIENCIA']) === normalizarFechaComparacion(filaFinal['DIA']) &&
      String(reserva['HORA'] || '') === String(filaFinal['HORA INICIO'] || '') &&
      normalizarTexto(reserva['SALA']) === normalizarTexto(filaFinal['SALA']);

    const estado = coincide ? 'CONFIRMADA' : 'LIBERADA';
    const motivo = coincide ? 'Confirmada al enviar a revision' : 'Liberada porque se guardo una asignacion distinta';

    sheet.getRange(i + 1, colEstado + 1).setValue(estado);
    if (colMotivo >= 0) sheet.getRange(i + 1, colMotivo + 1).setValue(motivo);
    if (colConfirmado >= 0) sheet.getRange(i + 1, colConfirmado + 1).setValue(new Date());

    registrarHistorial(
      coincide ? 'CONFIRMAR_RESERVA_ASIGNACION' : 'LIBERAR_RESERVA_ASIGNACION',
      'ReservasAsignacion',
      colExp >= 0 ? data[i][colExp] : expediente,
      motivo
    );

    return;
  }
}

function buscarFechaLimiteOralidad_(expediente, oralidad) {
  const buscado = normalizarTexto(expediente);
  let out = '';

  (oralidad || []).forEach(function(a) {
    if (normalizarTexto(expedienteAudienciaBackend_(a)) !== buscado) return;
    const f = normalizarFechaComparacion(a['FECHA LIMITE']);
    if (f && (!out || f < out)) out = f;
  });

  return out;
}

function continuidadExpedienteOralidad_(expediente, oralidad, participantes) {
  const buscado = normalizarTexto(expediente);
  const items = [];

  (oralidad || []).forEach(function(a, idx) {
    if (normalizarTexto(expedienteAudienciaBackend_(a)) !== buscado) return;
    if (!estadoValidoContinuidadOralidad_(a['ESTADO'])) return;
    if (!a['JUEZ'] && !a['AUDIENCISTA']) return;

    const fechaStr = normalizarFechaComparacion(a['DIA'] || a['FECHA AUDIENCIA'] || a['FECHA LIMITE'] || a['INGRESO OGA']);
    const fechaMs = fechaStr ? new Date(fechaStr + 'T12:00:00').getTime() : 0;
    items.push({
      juez: a['JUEZ'] || '',
      audiencista: a['AUDIENCISTA'] || '',
      fechaMs: fechaMs,
      idx: idx
    });
  });

  items.sort(function(a, b) {
    return b.fechaMs - a.fechaMs || b.idx - a.idx;
  });

  return {
    jueces: actoresUnicosContinuidad_(items.map(function(x) { return x.juez; }), participantes),
    audiencistas: actoresUnicosContinuidad_(items.map(function(x) { return x.audiencista; }), participantes)
  };
}

function estadoValidoContinuidadOralidad_(estado) {
  const e = normalizarTexto(estado);
  if (!e) return false;
  return e !== normalizarTexto('CANCELADA') &&
         e !== normalizarTexto('SIN AGENDA');
}

function actoresUnicosContinuidad_(actores, participantes) {
  const out = [];

  (actores || []).forEach(function(actor) {
    if (!actor) return;
    const existe = out.some(function(prev) {
      return actorCoincide_(prev, actor, participantes);
    });
    if (!existe) out.push(actor);
  });

  return out;
}

function candidatosRolAsignacion_(participantes, rol) {
  const vistos = {};
  const out = [];
  const rolNorm = normalizarTexto(rol);

  (participantes || []).forEach(function(p) {
    if (!p || normalizarTexto(p['ROL']) !== rolNorm) return;
    if (!esTrue_(p['ACTIVO'])) return;

    const valor = valorParticipantePorRol_(p, rol) || p['NOMBRE'] || '';
    const clave = normalizarTexto(valor);
    if (!clave || vistos[clave]) return;

    vistos[clave] = true;
    out.push({
      valor: valor,
      nombre: p['NOMBRE'] || valor,
      rol: rol,
      participante: p
    });
  });

  return out;
}

function rankearCandidatosAsignacion_(candidatos, rol, continuidad, oralidad, reservas, participantes, hoyStr) {
  const desde7 = fechaMasDiasAsignacion_(hoyStr, -6);
  const desde30 = fechaMasDiasAsignacion_(hoyStr, -29);

  const rankeados = (candidatos || []).map(function(c) {
    const continuidadRank = indiceContinuidadActor_(c.valor, continuidad, participantes);
    const cargaHoy = contarRolPeriodoAsignacion_(oralidad, reservas, c.valor, rol, hoyStr, hoyStr, participantes);
    const carga7 = contarRolPeriodoAsignacion_(oralidad, reservas, c.valor, rol, desde7, hoyStr, participantes);
    const carga30 = contarRolPeriodoAsignacion_(oralidad, reservas, c.valor, rol, desde30, hoyStr, participantes);
    const dias7 = diasActivosEnVentanaAsignacion_(c.participante, desde7, hoyStr);
    const dias30 = diasActivosEnVentanaAsignacion_(c.participante, desde30, hoyStr);
    const ratio7 = carga7 / Math.max(dias7, 1);
    const ratio30 = carga30 / Math.max(dias30, 1);
    const ultimoUso = ultimoUsoActorAsignacion_(oralidad, reservas, c.valor, rol, participantes);

    c.continuidadRank = continuidadRank;
    c.esContinuidad = continuidadRank < 999;
    c.cargaHoy = cargaHoy;
    c.carga7 = carga7;
    c.carga30 = carga30;
    c.dias7 = dias7;
    c.dias30 = dias30;
    c.ratio7 = ratio7;
    c.ratio30 = ratio30;
    c.ultimoUso = ultimoUso;
    c.fechaAltaSorteo = fechaAltaSorteoAsignacion_(c.participante);
    c.scoreEquidad = ratio30 * 100 + ratio7 * 70 + cargaHoy * 35 + carga7 * 4 + carga30;
    return c;
  });

  const promedioRatio30 = promedioAsignacion_(rankeados.map(function(c) { return c.ratio30; }));
  const promedioCarga30 = promedioAsignacion_(rankeados.map(function(c) { return c.carga30; }));

  rankeados.forEach(function(c) {
    c.promedioRatio30 = promedioRatio30;
    c.promedioCarga30 = promedioCarga30;
    c.desfaseRatio30 = c.ratio30 - promedioRatio30;
    c.alertaCarga = promedioRatio30 > 0 &&
      c.ratio30 > promedioRatio30 * 1.8 &&
      c.carga30 >= promedioCarga30 + 3;
  });

  return rankeados.sort(function(a, b) {
    if (a.esContinuidad !== b.esContinuidad) return a.esContinuidad ? -1 : 1;
    if (a.esContinuidad && a.continuidadRank !== b.continuidadRank) return a.continuidadRank - b.continuidadRank;
    if (Math.abs(a.scoreEquidad - b.scoreEquidad) > 0.0001) return a.scoreEquidad - b.scoreEquidad;
    if (a.ultimoUso !== b.ultimoUso) return a.ultimoUso - b.ultimoUso;
    return String(a.nombre || a.valor).localeCompare(String(b.nombre || b.valor));
  });
}

function filtrarCandidatosPreferidosAsignacion_(candidatos, preferido, participantes) {
  const pref = String(preferido || '').trim();
  if (!pref) return candidatos || [];
  return (candidatos || []).filter(function(c) {
    return actorCoincide_(c.valor, pref, participantes) ||
      actorCoincide_(c.nombre, pref, participantes);
  });
}

function indiceContinuidadActor_(actor, continuidad, participantes) {
  for (let i = 0; i < (continuidad || []).length; i++) {
    if (actorCoincide_(continuidad[i], actor, participantes)) return i;
  }
  return 999;
}

function generarCombosAsignacion_(jueces, audiencistas) {
  const combos = [];
  const js = (jueces || []).slice(0, 12);
  const auds = (audiencistas || []).slice(0, 12);

  js.forEach(function(juez) {
    auds.forEach(function(audiencista) {
      const continuidadCount = (juez.esContinuidad ? 1 : 0) + (audiencista.esContinuidad ? 1 : 0);
      combos.push({
        juez: juez,
        audiencista: audiencista,
        continuidadCount: continuidadCount,
        continuidadRank: (juez.esContinuidad ? juez.continuidadRank : 50) +
          (audiencista.esContinuidad ? audiencista.continuidadRank : 50),
        scoreEquidad: juez.scoreEquidad + audiencista.scoreEquidad
      });
    });
  });

  return combos.sort(function(a, b) {
    if (a.continuidadCount !== b.continuidadCount) return b.continuidadCount - a.continuidadCount;
    if (a.continuidadRank !== b.continuidadRank) return a.continuidadRank - b.continuidadRank;
    if (Math.abs(a.scoreEquidad - b.scoreEquidad) > 0.0001) return a.scoreEquidad - b.scoreEquidad;
    return String(a.juez.valor + a.audiencista.valor).localeCompare(String(b.juez.valor + b.audiencista.valor));
  });
}

function buscarTurnoParaComboAsignacion_(ctx) {
  const inicio = horaAMin(ctx.horaDesde);
  const fin = horaAMin(ctx.horaHasta);

  for (let fecha = ctx.desde; fecha <= ctx.hasta; fecha = fechaMasDiasAsignacion_(fecha, 1)) {
    if (!esDiaHabil(fecha)) continue;

    for (let m = inicio; m + ctx.duracion <= fin; m += ctx.paso) {
      const hora = minAHora(m);

      for (let s = 0; s < ctx.salas.length; s++) {
        const sala = ctx.salas[s];
        const params = {
          fecha: fecha,
          hora_inicio: hora,
          duracion: ctx.duracion,
          sala: sala,
          actores: [ctx.combo.juez.valor, ctx.combo.audiencista.valor],
          excluirExpediente: ctx.expediente
        };
        const disp = verificarDisponibilidadParaSugerencia_(
          params,
          ctx.todas,
          ctx.participantes,
          ctx.config,
          ctx.reservas
        );

        if (disp.ok) {
          return {
            fecha: fecha,
            hora: hora,
            sala: sala,
            duracion: ctx.duracion,
            conflictos: []
          };
        }
      }
    }
  }

  return null;
}

function crearSugerenciaAsignacion_(turno, combo, continuidad, fechaLimite) {
  const infoJuez = detalleRolSugerenciaAsignacion_('Juez', combo.juez, continuidad.jueces);
  const infoAudiencista = detalleRolSugerenciaAsignacion_('Audiencista', combo.audiencista, continuidad.audiencistas);
  const motivos = [];
  const alertas = [];

  if (combo.continuidadCount === 2) {
    motivos.push('Mantiene juez y audiencista con intervencion previa en el expediente.');
  } else if (combo.continuidadCount === 1) {
    motivos.push('Mantiene la mayor continuidad posible y completa el otro rol por equilibrio.');
  } else {
    motivos.push('No hubo continuidad disponible dentro del plazo; se ordeno por equilibrio reciente.');
  }

  motivos.push('Disponible dentro del plazo' + (fechaLimite ? ' limite' : ' operativo') + '.');
  motivos.push('Sin conflictos de agenda, bloqueos ni maximo diario detectado.');
  infoJuez.motivos.concat(infoAudiencista.motivos).forEach(function(m) {
    motivos.push(m);
  });
  infoJuez.alertas.concat(infoAudiencista.alertas).forEach(function(a) {
    alertas.push(a);
  });

  return {
    fecha: turno.fecha,
    hora: turno.hora,
    sala: turno.sala,
    duracion: turno.duracion,
    juez: combo.juez.valor,
    juezNombre: combo.juez.nombre,
    audiencista: combo.audiencista.valor,
    audiencistaNombre: combo.audiencista.nombre,
    continuidad: combo.continuidadCount,
    motivos: motivos,
    alertas: alertas,
    roles: {
      juez: infoJuez,
      audiencista: infoAudiencista
    },
    metricas: {
      juez: metricasCandidatoAsignacion_(combo.juez),
      audiencista: metricasCandidatoAsignacion_(combo.audiencista)
    }
  };
}

function detalleRolSugerenciaAsignacion_(rolLabel, c, continuidad) {
  const motivos = [];
  const alertas = [];
  const hayContinuidad = (continuidad || []).length > 0;

  if (hayContinuidad && c.esContinuidad) {
    if (c.continuidadRank === 0) {
      motivos.push(rolLabel + ': mantiene la ultima intervencion valida.');
    } else {
      motivos.push(rolLabel + ': mantiene una intervencion anterior del expediente.');
      alertas.push(rolLabel + ': no se pudo sostener la ultima intervencion, se tomo una anterior.');
    }
  } else if (hayContinuidad) {
    motivos.push(rolLabel + ': se propone una persona nueva por disponibilidad y equilibrio.');
    alertas.push(rolLabel + ': no se pudo mantener continuidad dentro de la ventana disponible.');
  } else {
    motivos.push(rolLabel + ': sin antecedente valido en el expediente, se ordena por equilibrio reciente.');
  }

  motivos.push(
    rolLabel + ': carga hoy ' + (c.cargaHoy || 0) +
    ', 7 dias ' + (c.carga7 || 0) +
    ', 30 dias ' + (c.carga30 || 0) +
    ' sobre ' + (c.dias30 || 1) + ' dias activos.'
  );

  if (c.alertaCarga) {
    alertas.push(rolLabel + ': carga reciente sensiblemente superior al promedio del rol.');
  }

  return {
    rol: rolLabel,
    valor: c.valor,
    nombre: c.nombre,
    continuidad: !!c.esContinuidad,
    continuidadRank: c.continuidadRank,
    cargaHoy: c.cargaHoy || 0,
    carga7: c.carga7 || 0,
    carga30: c.carga30 || 0,
    dias7: c.dias7 || 1,
    dias30: c.dias30 || 1,
    ratio7: c.ratio7 || 0,
    ratio30: c.ratio30 || 0,
    promedioRatio30: c.promedioRatio30 || 0,
    promedioCarga30: c.promedioCarga30 || 0,
    fechaAltaSorteo: c.fechaAltaSorteo || '',
    alertaCarga: !!c.alertaCarga,
    motivos: motivos,
    alertas: alertas
  };
}

function metricasCandidatoAsignacion_(c) {
  return {
    cargaHoy: c.cargaHoy || 0,
    carga7: c.carga7 || 0,
    carga30: c.carga30 || 0,
    dias7: c.dias7 || 1,
    dias30: c.dias30 || 1,
    ratio7: c.ratio7 || 0,
    ratio30: c.ratio30 || 0,
    promedioRatio30: c.promedioRatio30 || 0,
    promedioCarga30: c.promedioCarga30 || 0,
    fechaAltaSorteo: c.fechaAltaSorteo || '',
    alertaCarga: !!c.alertaCarga,
    continuidad: !!c.esContinuidad,
    continuidadRank: c.continuidadRank
  };
}

function verificarDisponibilidadParaSugerencia_(params, todas, participantes, config, reservas) {
  const base = verificarDisponibilidadConDatos_(params, todas, participantes, config);
  const conflictos = (base.conflictos || []).slice();

  conflictosReservasAsignacion_(reservas, params, participantes).forEach(function(c) {
    agregarConflictoUnico_(conflictos, c);
  });

  conflictosMaximoReservasAsignacion_(reservas, params, todas, participantes).forEach(function(c) {
    agregarConflictoUnico_(conflictos, c);
  });

  return {
    ok: conflictos.length === 0,
    conflictos: conflictos
  };
}

function conflictosReservasAsignacion_(reservas, params, participantes) {
  const out = [];
  const fecha = normalizarFechaComparacion(params.fecha);
  const expte = normalizarTexto(params.excluirExpediente || '');
  const ini = horaAMin(params.hora_inicio || params.hora || '');
  const fin = ini + (parseInt(params.duracion, 10) || 60);
  const actores = params.actores || [];

  (reservas || []).forEach(function(r) {
    if (normalizarTexto(r['EXPEDIENTE']) === expte) return;
    if (normalizarFechaComparacion(r['FECHA_AUDIENCIA']) !== fecha) return;

    const ri = horaAMin(r['HORA'] || '');
    const rf = ri + (parseInt(r['DURACION'], 10) || 60);
    const solapan = ini < rf && fin > ri;
    if (!solapan) return;

    if (normalizarTexto(r['SALA']) === normalizarTexto(params.sala)) {
      out.push({
        tipo: 'RESERVA_SALA',
        detalle: params.sala + ' reservada para expediente ' + (r['EXPEDIENTE'] || '-'),
        expediente: r['EXPEDIENTE'] || '-'
      });
    }

    actores.forEach(function(actor) {
      if (actorCoincide_(r['JUEZ'], actor, participantes) ||
          actorCoincide_(r['AUDIENCISTA'], actor, participantes)) {
        out.push({
          tipo: 'RESERVA_ACTOR',
          detalle: actor + ' reservado para expediente ' + (r['EXPEDIENTE'] || '-'),
          expediente: r['EXPEDIENTE'] || '-'
        });
      }
    });
  });

  return out;
}

function conflictosMaximoReservasAsignacion_(reservas, params, todas, participantes) {
  const out = [];
  const fecha = normalizarFechaComparacion(params.fecha);
  const expte = normalizarTexto(params.excluirExpediente || '');

  (params.actores || []).forEach(function(actor) {
    const p = buscarParticipantePorNombreOAka_(participantes, actor);
    if (!p) return;

    const max = parseInt(
      p['Maximo de Audiencias x dia'] ||
      p['MAX AUDIENCIAS/DIA'] ||
      p['MAXIMO DE AUDIENCIAS X DIA'] ||
      p['MAXIMO AUDIENCIAS DIA'] ||
      '',
      10
    );
    if (!max || max <= 0) return;

    const existentes = contarAudienciasDiaActorAsignacion_(todas, actor, fecha, expte, participantes);
    const reservadas = contarReservasDiaActorAsignacion_(reservas, actor, fecha, expte, participantes);

    if (existentes + reservadas >= max) {
      out.push({
        tipo: 'MAXIMO_DIA_RESERVA',
        detalle: (p['NOMBRE'] || actor) + ' ya alcanza el maximo diario contando reservas activas (' + max + ')',
        expediente: '-'
      });
    }
  });

  return out;
}

function contarAudienciasDiaActorAsignacion_(todas, actor, fecha, excluirExpediente, participantes) {
  const columnas = getColumnasActores_();
  let count = 0;

  (todas || []).forEach(function(a) {
    const expteActual = normalizarTexto(expedienteAudienciaBackend_(a));
    if (excluirExpediente && expteActual === excluirExpediente) return;
    if (normalizarFechaComparacion(a['DIA'] || a['FECHA AUDIENCIA'] || a['FECHA']) !== fecha) return;

    const estado = normalizarTexto(a['ESTADO']);
    if (estado === 'CANCELADA' || estado === 'REALIZADA') return;

    const aparece = columnas.some(function(col) {
      return actorCoincideEnFecha_(a[col] || '', actor, participantes, fecha);
    });
    if (aparece) count++;
  });

  return count;
}

function contarReservasDiaActorAsignacion_(reservas, actor, fecha, excluirExpediente, participantes) {
  let count = 0;

  (reservas || []).forEach(function(r) {
    if (normalizarTexto(r['EXPEDIENTE']) === excluirExpediente) return;
    if (normalizarFechaComparacion(r['FECHA_AUDIENCIA']) !== fecha) return;
    if (actorCoincide_(r['JUEZ'], actor, participantes) ||
        actorCoincide_(r['AUDIENCISTA'], actor, participantes)) {
      count++;
    }
  });

  return count;
}

function contarRolPeriodoAsignacion_(oralidad, reservas, actor, rol, desde, hasta, participantes) {
  let count = 0;
  const rolCampo = rol === 'AUDIENCISTA' ? 'AUDIENCISTA' : 'JUEZ';

  (oralidad || []).forEach(function(a) {
    if (!estadoValidoContinuidadOralidad_(a['ESTADO'])) return;
    const fecha = normalizarFechaComparacion(a['DIA'] || a['FECHA AUDIENCIA']);
    if (!fecha || fecha < desde || fecha > hasta) return;
    if (actorCoincideEnFecha_(a[rolCampo] || '', actor, participantes, fecha)) count++;
  });

  (reservas || []).forEach(function(r) {
    const fecha = normalizarFechaComparacion(r['FECHA_AUDIENCIA']);
    if (!fecha || fecha < desde || fecha > hasta) return;
    const valor = rolCampo === 'JUEZ' ? r['JUEZ'] : r['AUDIENCISTA'];
    if (actorCoincide_(valor, actor, participantes)) count++;
  });

  return count;
}

function ultimoUsoActorAsignacion_(oralidad, reservas, actor, rol, participantes) {
  let ultimo = 0;
  const rolCampo = rol === 'AUDIENCISTA' ? 'AUDIENCISTA' : 'JUEZ';

  (oralidad || []).forEach(function(a) {
    if (!estadoValidoContinuidadOralidad_(a['ESTADO'])) return;
    if (!actorCoincideEnFecha_(a[rolCampo] || '', actor, participantes, normalizarFechaComparacion(a['DIA'] || a['FECHA AUDIENCIA']))) return;
    const fecha = normalizarFechaComparacion(a['DIA'] || a['FECHA AUDIENCIA']);
    if (fecha) ultimo = Math.max(ultimo, new Date(fecha + 'T12:00:00').getTime());
  });

  (reservas || []).forEach(function(r) {
    const valor = rolCampo === 'JUEZ' ? r['JUEZ'] : r['AUDIENCISTA'];
    if (!actorCoincide_(valor, actor, participantes)) return;
    const fecha = normalizarFechaComparacion(r['FECHA_AUDIENCIA']);
    if (fecha) ultimo = Math.max(ultimo, new Date(fecha + 'T12:00:00').getTime());
  });

  return ultimo;
}

function promedioAsignacion_(valores) {
  let total = 0;
  let count = 0;

  (valores || []).forEach(function(v) {
    const n = Number(v);
    if (isNaN(n)) return;
    total += n;
    count++;
  });

  return count ? total / count : 0;
}

function fechaAltaSorteoAsignacion_(p) {
  return normalizarFechaComparacion(
    (p && (
      p['FECHA ALTA SORTEO'] ||
      p['ACTIVO DESDE'] ||
      p['FECHA ALTA'] ||
      p['CREADO']
    )) ||
    ''
  );
}

function diasActivosEnVentanaAsignacion_(p, desde, hasta) {
  const alta = fechaAltaSorteoAsignacion_(p);
  const inicio = alta && alta > desde ? alta : desde;
  const d1 = new Date(inicio + 'T12:00:00');
  const d2 = new Date(hasta + 'T12:00:00');
  return Math.max(1, Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

function salasAsignacionOralidad_(params, config) {
  const principales = ['SALA 1', 'SALA 2', 'SALA 3', 'SALA ESPECIAL'];
  const out = [];

  function add(s) {
    const v = String(s || '').trim();
    if (!v) return;
    const n = normalizarTexto(v);
    const esPrincipal = principales.map(normalizarTexto).indexOf(n) >= 0;
    if (!esPrincipal) return;
    if (!out.some(function(x) { return normalizarTexto(x) === n; })) out.push(v);
  }

  add(params.sala_preferida || params.sala || '');
  (config.salas || []).forEach(add);
  principales.forEach(add);

  return out;
}

function fechaHoyAsignacion_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function fechaMasDiasAsignacion_(fechaStr, dias) {
  const d = new Date(fechaStr + 'T12:00:00');
  d.setDate(d.getDate() + parseInt(dias, 10));
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function asegurarHojaReservasAsignacion_() {
  const ss = getSS();
  let sheet = ss.getSheetByName('ReservasAsignacion');
  const headers = getHeadersReservasAsignacion_();

  if (!sheet) {
    sheet = ss.insertSheet('ReservasAsignacion');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  const actuales = getHeadersHoja_(sheet, 0);
  headers.forEach(function(header) {
    if (buscarIndiceHeader(actuales, header) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      actuales.push(header);
    }
  });

  return sheet;
}

function getHeadersReservasAsignacion_() {
  return [
    'ID',
    'CREADO',
    'VENCE_EN',
    'USUARIO',
    'EXPEDIENTE',
    'HOJA',
    'JUEZ',
    'AUDIENCISTA',
    'FECHA_AUDIENCIA',
    'HORA',
    'DURACION',
    'SALA',
    'ESTADO',
    'MOTIVO',
    'CONFIRMADO_EN'
  ];
}

function getReservasAsignacionActivas_() {
  const sheet = asegurarHojaReservasAsignacion_();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0] || [];
  const colEstado = buscarIndiceHeader(headers, 'ESTADO');
  const colVence = buscarIndiceHeader(headers, 'VENCE_EN');
  const ahora = new Date().getTime();
  const out = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colEstado] || '').toUpperCase() !== 'RESERVADA') continue;
    const vence = fechaReservaAsignacionAFecha_(data[i][colVence]);
    if (vence && vence.getTime() < ahora) continue;
    out.push(serializarFila(headers, data[i]));
  }

  return out;
}

function vencerReservasAsignacion_(sheet) {
  sheet = sheet || asegurarHojaReservasAsignacion_();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0] || [];
  const colEstado = buscarIndiceHeader(headers, 'ESTADO');
  const colVence = buscarIndiceHeader(headers, 'VENCE_EN');
  const colMotivo = buscarIndiceHeader(headers, 'MOTIVO');
  const ahora = new Date().getTime();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colEstado] || '').toUpperCase() !== 'RESERVADA') continue;
    const vence = fechaReservaAsignacionAFecha_(data[i][colVence]);
    if (!vence || vence.getTime() >= ahora) continue;
    sheet.getRange(i + 1, colEstado + 1).setValue('VENCIDA');
    if (colMotivo >= 0) sheet.getRange(i + 1, colMotivo + 1).setValue('Vencida automaticamente');
  }
}

function liberarReservasAbiertasExpediente_(sheet, expediente, motivo) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0] || [];
  const colEstado = buscarIndiceHeader(headers, 'ESTADO');
  const colExp = buscarIndiceHeader(headers, 'EXPEDIENTE');
  const colMotivo = buscarIndiceHeader(headers, 'MOTIVO');
  const buscado = normalizarTexto(expediente);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colEstado] || '').toUpperCase() !== 'RESERVADA') continue;
    if (normalizarTexto(data[i][colExp]) !== buscado) continue;
    sheet.getRange(i + 1, colEstado + 1).setValue('LIBERADA');
    if (colMotivo >= 0) sheet.getRange(i + 1, colMotivo + 1).setValue(motivo || 'Liberada');
  }
}

function fechaReservaAsignacionAFecha_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
