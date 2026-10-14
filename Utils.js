function getSS() {
  return SpreadsheetApp.openById(SS_ID);
}

function getSheet(nombre) {
  const sheet = getSS().getSheetByName(nombre);
  if (!sheet) throw new Error('No existe la hoja: ' + nombre);
  return sheet;
}

function serializarFila(headers, row) {
  const obj = {};

  headers.forEach(function(h, i) {
    if (!h) return;

    const key = String(h).trim();
    obj[key] = formatearValorSerializado_(key, row[i]);
  });

  return obj;
}

function formatearValorSerializado_(key, val) {
  const tz = Session.getScriptTimeZone();

  if (val instanceof Date) {
    if (val.getFullYear() === 1899) {
      val = Utilities.formatDate(val, tz, 'HH:mm');
    } else {
      val = Utilities.formatDate(val, tz, 'dd/MM/yyyy');
    }
  }

  if (['PRESO','ACTIVO','RECIBE NOTIFICACIONES','ES VACANTE'].indexOf(key) >= 0) {
    val = val === true || val === 'TRUE' || val === 'true';
  }

  return val;
}

function serializarFilaHoja_(nombreHoja, headers, row) {
  const obj = serializarFila(headers, row);
  const esquema = getEsquemaHoja_(nombreHoja);
  if (!esquema || !esquema.fallback) return obj;

  Object.keys(esquema.fallback).forEach(function(campo) {
    const idx = esquema.fallback[campo];
    if (idx < 0 || idx >= row.length) return;
    if (Object.prototype.hasOwnProperty.call(obj, campo) && obj[campo] !== '') return;
    obj[campo] = formatearValorSerializado_(campo, row[idx]);
  });

  return obj;
}

function unicos(arr) {
  return arr.filter(function(x, i, a) {
    return x && a.indexOf(x) === i;
  });
}

function horaAMin(hora) {
  if (!hora) return 0;
  const p = String(hora).split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1] || 0, 10);
}

function minAHora(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function fechaInputAFechaSheet(v) {
  if (!v) return '';
  if (v instanceof Date) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
    return new Date(v + 'T12:00:00');
  }
  return v;
}

function fechaInputAString(v) {
  if (!v) return '';

  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  const s = String(v).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const p = s.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  return s;
}

function normalizarTexto(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bN\s*[º°]?\s*(\d+)/g, 'N $1')
    .replace(/\s+/g, ' ');
}

function normalizarFechaComparacion(v) {
  if (!v) return '';

  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const s = String(v).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const p = s.split('/');
  if (p.length === 3) {
    return p[2] + '-' + completar2(p[1]) + '-' + completar2(p[0]);
  }

  return s;
}

function completar2(n) {
  n = String(n);
  return n.length === 1 ? '0' + n : n;
}

function buscarIndiceHeader(headers, nombre) {
  const buscado = normalizarTexto(nombre);

  for (let i = 0; i < headers.length; i++) {
    if (normalizarTexto(headers[i]) === buscado) return i;
  }

  return -1;
}

function getValorPorHeader_(headers, row, header) {
  const idx = buscarIndiceHeader(headers, header);
  return idx >= 0 ? row[idx] : '';
}

function setValorPorHeader_(headers, fila, header, valor) {
  const idx = buscarIndiceHeader(headers, header);
  if (idx >= 0) fila[idx] = valor;
}

function getHeadersHoja_(sheet, headerRowIndex) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(headerRowIndex + 1, 1, 1, lastCol).getValues()[0];
}

function asegurarColumnaHoja_(sheet, headerRowIndex, header) {
  let headers = getHeadersHoja_(sheet, headerRowIndex);
  if (buscarIndiceHeader(headers, header) >= 0) return headers;

  const col = headers.length + 1;
  sheet.getRange(headerRowIndex + 1, col).setValue(header);
  headers.push(header);
  return headers;
}

function asegurarColumnasSistemaAudiencias_(nombreHoja, sheet) {
  const esquema = getEsquemaHoja_(nombreHoja);
  if (!esquema) return getHeadersHoja_(sheet, 2);

  let headers = getHeadersHoja_(sheet, esquema.headerRow);
  ['DNI IMPUTADO', 'INGRESO EXPTE FISICO'].forEach(function(header) {
    if (indiceCampoHoja_(headers, nombreHoja, header) < 0) {
      headers = asegurarColumnaHoja_(sheet, esquema.headerRow, header);
    }
  });

  return headers;
}

function getEsquemaHoja_(nombreHoja) {
  const esquemas = {
    Oralidad: {
      headerRow: 2,
      startRow: 3,
      colCheck: 2,
      expteIndex: 2,
      fallback: {
        'INGRESO OGA': 0,
        'TIPO EXP': 1,
        'Nº EXPEDIENTE': 2,
        'IMPUTADO(S)': 3,
        'INGRESO EXP.': 4,
        'INGRESO EXPTE FISICO': 4,
        'TIPO DE AUD.': 5,
        'PRESO': 6,
        'GESTOR': 7,
        'ESTADO': 8,
        'AUDIENCISTA': 9,
        'JUEZ': 10,
        'FISCAL': 11,
        'DEFENSA': 12,
        'ASESOR - QTE': 13,
        'DIA': 14,
        'HORA INICIO': 15,
        'DURACION': 16,
        'SALA': 17,
        'RESULTADO': 18,
        'OBSERVACIONES': 19,
        'FECHA LIMITE': 20,
        'ALERTA PLAZO': 21,
        'OGA - EXP': 22,
        'EXP - AGEND': 23
      },
      aliases: {
        'INGRESO OGA': ['INGRESO /INGRESO OGA', 'AGENDA DE AUDIENCIAS - ORALIDAD INGRESO INGRESO OGA'],
        'INGRESO EXP.': ['INGRESO EXPTE FISICO', 'INGRESO EXPTE FISICO', 'INGRESO EXP'],
        'INGRESO EXPTE FISICO': ['INGRESO EXP.', 'INGRESO EXP', 'FECHA INGRESO FISICO'],
        'DNI IMPUTADO': ['DNI', 'DNI IMPUTADO(S)', 'DOCUMENTO IMPUTADO'],
        'TIPO DE AUD.': ['TIPO DE AUD', 'TIPO Y PRIORIDAD TIPO DE AUD.'],
        'GESTOR': ['GESTION INTERNA GESTOR'],
        'DIA': ['FECHA Y LUGAR DIA'],
        'FECHA LIMITE': ['CONTROL FECHA LIMITE']
      }
    },
    Debate: {
      headerRow: 2,
      startRow: 3,
      colCheck: 0,
      expteIndex: 0,
      fallback: {
        'Nº EXPTE': 0,
        'Nº EXPEDIENTE': 0,
        'IMPUTADO(S)': 1,
        'TIPO DE AUD': 2,
        'PRESO': 3,
        'LUGAR SOLICITADO': 4,
        'DIAS SOLICITADOS': 5,
        'HORAS X DIA': 6,
        'SE PUEDE YA': 7,
        'GESTOR': 8,
        'JUEZ': 9,
        'SECRETARIO': 10,
        'FISCAL': 11,
        'DEFENSA': 12,
        'ASESOR-QTE': 13,
        'ASESOR - QTE': 13,
        'ASESOR / QTE': 13,
        'ESTADO': 14,
        'FECHA AGENDAMIENTO': 15,
        'FECHA AUDIENCIA': 16,
        'HORA DE INICIO': 17,
        'DURACION': 18,
        'LUGAR CONFIRM.': 19,
        'FECHA LIMITE': 20,
        'ALERTA PLAZO': 21,
        'OBSERVACIONES': 22
      },
      aliases: {
        'Nº EXPTE': ['Nº EXPEDIENTE', 'INGRESO Nº EXPTE', 'AGENDA DE AUDIENCIAS - DEBATE INGRESO Nº EXPTE'],
        'INGRESO EXPTE FISICO': ['INGRESO EXP.', 'INGRESO EXP', 'FECHA INGRESO FISICO'],
        'DNI IMPUTADO': ['DNI', 'DNI IMPUTADO(S)', 'DOCUMENTO IMPUTADO'],
        'TIPO DE AUD': ['TIPO DE AUD.', 'TIPO'],
        'GESTOR': ['AGENDA GESTOR'],
        'ASESOR - QTE': ['ASESOR-QTE', 'ASESOR / QTE'],
        'ASESOR / QTE': ['ASESOR-QTE', 'ASESOR - QTE'],
        'HORA DE INICIO': ['HORA INICIO'],
        'LUGAR CONFIRM.': ['SALA', 'LUGAR CONFIRMADO'],
        'FECHA LIMITE': ['CONTROL FECHA LIMITE']
      }
    },
    Participantes: {
      headerRow: 0,
      startRow: 1,
      colCheck: 0,
      expteIndex: 0
    }
  };

  return esquemas[nombreHoja] || null;
}

function indiceCampoHoja_(headers, nombreHoja, campo) {
  const esquema = getEsquemaHoja_(nombreHoja);
  const candidatos = [campo];
  const aliases = esquema && esquema.aliases && esquema.aliases[campo] ? esquema.aliases[campo] : [];

  aliases.forEach(function(a) { candidatos.push(a); });

  for (let i = 0; i < candidatos.length; i++) {
    const idx = buscarIndiceHeader(headers, candidatos[i]);
    if (idx >= 0) return idx;
  }

  if (esquema && esquema.fallback && typeof esquema.fallback[campo] === 'number') {
    return esquema.fallback[campo];
  }

  return -1;
}

function setValorPorCampoHoja_(nombreHoja, headers, fila, campo, valor) {
  const idx = indiceCampoHoja_(headers, nombreHoja, campo);
  if (idx >= 0) fila[idx] = valor;
}

function getValorPorCampoHoja_(nombreHoja, headers, row, campo) {
  const idx = indiceCampoHoja_(headers, nombreHoja, campo);
  return idx >= 0 ? row[idx] : '';
}

function campoPorIndiceHoja_(nombreHoja, headers, idx) {
  const h = headers && headers[idx] ? String(headers[idx]).trim() : '';
  if (h) return h;

  const esquema = getEsquemaHoja_(nombreHoja);
  if (!esquema || !esquema.fallback) return '';

  const campos = Object.keys(esquema.fallback);
  for (let i = 0; i < campos.length; i++) {
    if (esquema.fallback[campos[i]] === idx) return campos[i];
  }

  return '';
}

function nuevaFilaHoja_(nombreHoja, headers) {
  const esquema = getEsquemaHoja_(nombreHoja);
  let len = headers.length;

  if (esquema && esquema.fallback) {
    Object.keys(esquema.fallback).forEach(function(campo) {
      len = Math.max(len, esquema.fallback[campo] + 1);
    });
  }

  return new Array(len).fill('');
}

function rolDesdeCampoActor_(campo) {
  const c = normalizarTexto(campo);
  if (c.indexOf('FISCAL') >= 0) return 'FISCAL';
  if (c.indexOf('GESTOR') >= 0) return 'GESTOR';
  if (c.indexOf('AUDIENCISTA') >= 0) return 'AUDIENCISTA';
  if (c.indexOf('JUEZ') >= 0) return 'JUEZ';
  if (c.indexOf('DEFENSA') >= 0) return 'DEFENSA';
  if (c.indexOf('ASESOR') >= 0 || c.indexOf('QTE') >= 0 || c.indexOf('QUERELLANTE') >= 0) return 'ASESOR';
  if (c.indexOf('SECRETARIO') >= 0) return 'SECRETARIO';
  return c;
}

function valorParticipantePorRol_(p, rol) {
  if (!p) return '';
  const r = normalizarTexto(rol);
  if (r === 'FISCAL') return p['AREA'] || p['NOMBRE'] || '';
  if (r === 'GESTOR' || r === 'AUDIENCISTA') return p['A.K.A.'] || p['NOMBRE'] || '';
  return p['NOMBRE'] || '';
}

function valoresParticipanteComparacion_(p, rol) {
  if (!p) return [];
  const vals = [
    p['NOMBRE'],
    p['A.K.A.'],
    p['AREA'],
    valorParticipantePorRol_(p, rol)
  ];
  if (normalizarTexto(p['ROL']) === normalizarTexto('ABOGADO LITIGANTE') && p['NOMBRE']) {
    vals.push('PARTICULAR - ' + p['NOMBRE']);
  }
  return unicos(vals.map(function(v) { return normalizarTexto(v); }));
}

function participanteCoincideConValor_(p, valor, rol) {
  const buscado = normalizarTexto(valor);
  if (!buscado) return false;
  return valoresParticipanteComparacion_(p, rol).indexOf(buscado) >= 0;
}

function estadoCuentaParaPlazo_(estado) {
  const e = normalizarTexto(estado);
  return e === normalizarTexto('PENDIENTE - EN CURSO') ||
         e === normalizarTexto('PENDIENTE - EN REVISION') ||
         e === normalizarTexto('EN REVISION');
}

function primeraFilaLibrePorColumna_(sheet, colIndex, startRow) {
  const lastRow = Math.max(sheet.getLastRow(), startRow);
  const numRows = Math.max(lastRow - startRow + 1, 1);
  const values = sheet.getRange(startRow, colIndex, numRows, 1).getValues();

  for (let i = 0; i < values.length; i++) {
    if (!values[i][0] || String(values[i][0]).trim() === '') return startRow + i;
  }

  return lastRow + 1;
}

function esTrue_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE' || String(v).trim() === '1';
}

function parseFechaDDMMYYYY(v) {
  if (!v) return null;
  if (v instanceof Date) return v;

  const p = String(v).split('/');
  if (p.length !== 3) return null;

  return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
}

function diferenciaDias(desde, hasta) {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b - a) / 86400000);
}
