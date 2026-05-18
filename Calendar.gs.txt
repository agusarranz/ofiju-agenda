function getFeriadosAPI_(anio) {
  const cache = CacheService.getScriptCache();
  const key = 'feriados_' + anio;

  const cached = cache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const url = 'https://api.argentinadatos.com/v1/feriados/' + anio;
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (resp.getResponseCode() !== 200) return [];

    const data = JSON.parse(resp.getContentText());

    const fechas = data.map(function(f) {
      return normalizarFechaComparacion(f.fecha);
    });

    cache.put(key, JSON.stringify(fechas), 21600); // 6 horas
    return fechas;

  } catch (e) {
    return [];
  }
}

function getDiasBloqueados_() {
  const sheet = getSheet('DiasBloqueados');
  const data = sheet.getDataRange().getValues();

  const fechas = [];

  for (let i = 1; i < data.length; i++) {
    const fecha = data[i][0];
    const activo = data[i][2];

    if (!fecha) continue;
    if (!(activo === true || String(activo).toUpperCase() === 'TRUE')) continue;

    fechas.push(normalizarFechaComparacion(fecha));
  }

  return fechas;
}

function getCalendarioNoHabil_(anio) {
  if (!anio) {
    const hoy = new Date();
    anio = hoy.getFullYear();
  }

  const feriados = getFeriadosAPI_(anio);
  const bloqueados = getDiasBloqueados_();

  return {
    feriados: feriados,
    bloqueados: bloqueados
  };
}

function esDiaHabil(fechaStr) {
  if (!fechaStr) return false;

  const fecha = new Date(fechaStr + 'T12:00:00');

  if (fecha.getDay() === 0 || fecha.getDay() === 6) return false;

  const cal = getCalendarioNoHabil_(fecha.getFullYear());

  const esFeriado = cal.feriados.indexOf(fechaStr) >= 0;
  const esBloqueado = cal.bloqueados.indexOf(fechaStr) >= 0;

  return !(esFeriado || esBloqueado);
}
