function getSheetData(nombreHoja, headerRowIndex, startRowIndex, colCheckIndex) {
  const sheet = getSheet(nombreHoja);
  const data = sheet.getDataRange().getValues();

  if (data.length <= headerRowIndex) return [];

  const headers = data[headerRowIndex];
  const colsCheck = getColumnasChequeoLectura_(headers, colCheckIndex);
  const resultado = [];

  for (let i = startRowIndex; i < data.length; i++) {
    const row = data[i];
    const tieneClave = colsCheck.some(function(idx) {
      return idx >= 0 &&
        row[idx] !== '' &&
        row[idx] !== null &&
        typeof row[idx] !== 'undefined' &&
        String(row[idx]).trim() !== '';
    });
    if (!tieneClave) continue;
    resultado.push(serializarFilaHoja_(nombreHoja, headers, row));
  }

  return resultado;
}

function getColumnasChequeoLectura_(headers, colCheckIndex) {
  const out = [];

  if (typeof colCheckIndex === 'number' && colCheckIndex >= 0) out.push(colCheckIndex);

  [
    'Nº EXPEDIENTE',
    'Nº EXPTE',
    'N° EXPEDIENTE',
    'N° EXPTE',
    'NRO EXPEDIENTE',
    'NRO EXPTE',
    'EXPEDIENTE',
    'EXPTE',
    'NÂº EXPEDIENTE',
    'NÂº EXPTE'
  ].forEach(function(nombre) {
    const idx = buscarIndiceHeader(headers, nombre);
    if (idx >= 0) out.push(idx);
  });

  return unicosNumericos_(out);
}

function unicosNumericos_(arr) {
  const vistos = {};
  const out = [];

  (arr || []).forEach(function(v) {
    if (typeof v !== 'number' || v < 0) return;
    if (vistos[v]) return;
    vistos[v] = true;
    out.push(v);
  });

  return out;
}

function getOralidad() {
  return getCachedJsonLarge_('ofiju_oralidad_v6', 60, function() {
    return getSheetData('Oralidad', 2, 3, 2);
  });
}

function getDebate() {
  return getCachedJsonLarge_('ofiju_debate_v6', 60, function() {
    return getSheetData('Debate', 2, 3, 0);
  });
}

function getParticipantes() {
  return getCachedJson_('ofiju_participantes_v5', 120, function() {
    return getSheetData('Participantes', 0, 1, 0);
  });
}

function getImputadosExpediente() {
  return getCachedJson_('ofiju_imputados_expediente_v1', 120, function() {
    const sheet = asegurarHojaImputadosExpediente_();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0];
    const out = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[3] || !row[4]) continue;
      const item = serializarFila(headers, row);
      if (item['ACTIVO'] === false) continue;
      out.push(item);
    }

    return out;
  });
}

function getConfiguracion() {
  return getCachedJson_('ofiju_config_v2', 300, getConfiguracionSinCache_);
}

function getConfiguracionSinCache_() {
  const sheet = getSheet('Configuracion');
  const data = sheet.getDataRange().getValues();

  const estadosPermitidos = [
    'PENDIENTE - EN CURSO',
    'PENDIENTE - EN REVISION',
    'EN REVISION',
    'AGENDADO',
    'REALIZADA',
    'CANCELADA',
    'SUSP. Y REPROGRAMADA',
    'SIN AGENDA'
  ];

  const resultadosPermitidos = [
    '',
    'MANTENER/CONVERTIR PP',
    'REMISION A JUICIO',
    'J. ABREVIADO EFECTIVA',
    'J. ABREVIADO CONDICIONAL',
    'J. ABREVIADO SUSPENSO',
    'LIBERTAD',
    'OTORGA DOMICILIARIA',
    'DENIEGA DOMICILIARIA',
    'AUTORIZA ALLANAMIENTO',
    'CANCELADA',
    'SUSP. Y REPROGRAMADA',
    'REALIZADA SIN RESULTADO',
    'J. ABREVIADO RECHAZADO',
    'ELEVACION RECHAZADA',
    'SIN RESULTADO',
    'SIN AGENDA'
  ];

  const config = {
    estados: [],
    resultados: resultadosPermitidos,
    tipos: [],
    salas: [],
    plazos: [],
    feriados: [],
    bloqueados: [],
    horarios: {},
    juzgados: JUZGADOS
  };

  data.forEach(function(row) {
    const posibleEstado = String(row[0] || '').trim();
    if (estadosPermitidos.indexOf(posibleEstado) >= 0) config.estados.push(posibleEstado);

    if (row[1]) config.tipos.push(String(row[1]).trim());
    if (row[2]) config.salas.push(String(row[2]).trim());

    if (row[4] && ['PP','CA','RPP','MU'].indexOf(String(row[4]).trim()) > -1) {
      config.plazos.push({
        tipo: String(row[4]).trim(),
        conPreso: row[5],
        sinPreso: row[6]
      });
    }

    if (row[13]) config.feriados.push(normalizarFechaComparacion(row[13]));
  });

  try {
    const anioActual = new Date().getFullYear();
    const calActual = getCalendarioNoHabil_(anioActual);
    const calSiguiente = getCalendarioNoHabil_(anioActual + 1);

    config.feriados = config.feriados.concat(
      calActual.feriados,
      calActual.bloqueados,
      calSiguiente.feriados,
      calSiguiente.bloqueados
    );

    config.bloqueados = unicos([].concat(
      calActual.bloqueados,
      calSiguiente.bloqueados
    )).sort();
  } catch (e) {
    try {
      config.bloqueados = getDiasBloqueados_();
      config.feriados = config.feriados.concat(config.bloqueados);
    } catch (err) {}
  }

  config.estados = unicos(config.estados.concat(estadosPermitidos));

  config.tipos = unicos(config.tipos).filter(function(t) {
    return t !== 'TIPOS DE AUDIENCIA' && t !== 'TODOS';
  });

  config.salas = unicos(config.salas).filter(function(s) {
    return esOpcionSala_(s);
  });

  config.feriados = unicos(config.feriados).sort();
  config.bloqueados = unicos(config.bloqueados).sort();

  return config;
}

function esOpcionSala_(sala) {
  const s = String(sala || '').trim();
  const n = normalizarTexto(s);

  if (!s || n === 'SALAS' || n === 'SIN PREFERENCIA') return false;

  return n.indexOf('SALA ') === 0 ||
         n.indexOf('SALA') === 0 ||
         n.indexOf('DESPACHO ') === 0 ||
         n.indexOf('DESPACHO') === 0;
}

function getCachedJson_(key, ttlSeconds, producer) {
  let cache = null;

  try {
    cache = CacheService.getScriptCache();
    const cached = cache.get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const value = producer();

  try {
    if (cache) cache.put(key, JSON.stringify(value), ttlSeconds || 60);
  } catch (err) {}

  return value;
}

function getCachedJsonLarge_(key, ttlSeconds, producer) {
  let cache = null;

  try {
    cache = CacheService.getScriptCache();

    const direct = cache.get(key);
    if (direct) return JSON.parse(direct);

    const metaRaw = cache.get(key + '__meta');
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      const partes = [];

      for (let i = 0; i < meta.partes; i++) {
        const parte = cache.get(key + '__' + i);
        if (!parte) {
          partes.length = 0;
          break;
        }
        partes.push(parte);
      }

      if (partes.length === meta.partes) {
        return JSON.parse(partes.join(''));
      }
    }
  } catch (e) {}

  const value = producer();

  try {
    if (cache) {
      const json = JSON.stringify(value);
      const chunkSize = 85000;

      limpiarCacheKeyGrande_(cache, key);

      if (json.length <= chunkSize) {
        cache.put(key, json, ttlSeconds || 60);
      } else {
        const partes = Math.ceil(json.length / chunkSize);
        for (let i = 0; i < partes; i++) {
          cache.put(key + '__' + i, json.slice(i * chunkSize, (i + 1) * chunkSize), ttlSeconds || 60);
        }
        cache.put(key + '__meta', JSON.stringify({ partes: partes }), ttlSeconds || 60);
      }
    }
  } catch (err) {}

  return value;
}

function limpiarCacheKeyGrande_(cache, key) {
  try {
    cache.remove(key);
    const metaRaw = cache.get(key + '__meta');
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      for (let i = 0; i < meta.partes; i++) cache.remove(key + '__' + i);
    }
    cache.remove(key + '__meta');
  } catch (e) {}
}

function limpiarCacheDatos_(tipo) {
  try {
    const cache = CacheService.getScriptCache();

    if (!tipo || tipo === 'oralidad' || tipo === 'audiencias') {
      limpiarCacheKeyGrande_(cache, 'ofiju_oralidad_v3');
      limpiarCacheKeyGrande_(cache, 'ofiju_oralidad_v4');
      limpiarCacheKeyGrande_(cache, 'ofiju_oralidad_v5');
      limpiarCacheKeyGrande_(cache, 'ofiju_oralidad_v6');
    }
    if (!tipo || tipo === 'debate' || tipo === 'audiencias') {
      limpiarCacheKeyGrande_(cache, 'ofiju_debate_v3');
      limpiarCacheKeyGrande_(cache, 'ofiju_debate_v4');
      limpiarCacheKeyGrande_(cache, 'ofiju_debate_v5');
      limpiarCacheKeyGrande_(cache, 'ofiju_debate_v6');
    }
    if (!tipo || tipo === 'participantes') {
      cache.remove('ofiju_participantes_v2');
      cache.remove('ofiju_participantes_v3');
      cache.remove('ofiju_participantes_v4');
      cache.remove('ofiju_participantes_v5');
    }
    if (!tipo || tipo === 'imputados') cache.remove('ofiju_imputados_expediente_v1');
    if (!tipo || tipo === 'config') cache.remove('ofiju_config_v2');
    if (!tipo || tipo === 'historial') cache.remove('ofiju_historial_v1');
  } catch (e) {}
}
