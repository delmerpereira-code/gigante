/* ============================================================================
 *  Rotacao.js — Motor de rotação (cópia servidor). Mantido em paralelo com
 *  web/rotacao.js. Se alterar um, alterar o outro.
 * ==========================================================================*/

var CICLO_DIAS = 5;
var MS_DIA = 24 * 60 * 60 * 1000;

var FAIXAS = [
  { de: 0,  ate: 12,  estado: 'turno_1',  protegido: false, rotulo: '1º turno (08–20)' },
  { de: 12, ate: 36,  estado: 'descanso', protegido: true,  rotulo: 'descanso protegido 24h' },
  { de: 36, ate: 48,  estado: 'turno_2',  protegido: false, rotulo: '2º turno (20–08)' },
  { de: 48, ate: 120, estado: 'folga',    protegido: true,  rotulo: 'folga 72h' }
];

function _meiaNoite(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function _parseData(v) {
  if (v instanceof Date) return v;
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date(v);
}

function _diasEntre(a, b) { return Math.round((_meiaNoite(b) - _meiaNoite(a)) / MS_DIA); }

function faseRotacao(plantao, data, cfg) {
  cfg = cfg || configRotacao();
  var idx = cfg.ordem.indexOf(plantao);
  if (idx < 0) throw new Error('Plantão desconhecido: ' + plantao);
  var delta = _diasEntre(_parseData(cfg.ancora), _parseData(data));
  return ((delta - idx) % CICLO_DIAS + CICLO_DIAS) % CICLO_DIAS;
}

function turnosDoDia(data, cfg) {
  cfg = cfg || configRotacao();
  var t1 = null, t2 = null;
  cfg.ordem.forEach(function (pl) {
    var f = faseRotacao(pl, data, cfg);
    if (f === 0) t1 = pl;
    if (f === 1) t2 = pl;
  });
  return { data: Utilities.formatDate(_parseData(data), 'America/Manaus', 'yyyy-MM-dd'), turno1: t1, turno2: t2 };
}

function _inicioCicloCorrente(plantao, dataRef, cfg) {
  var f = faseRotacao(plantao, dataRef, cfg);
  var d0 = _meiaNoite(_parseData(dataRef));
  d0.setDate(d0.getDate() - f);
  d0.setHours(8, 0, 0, 0);
  return d0;
}

function estadoEm(plantao, instante, cfg) {
  cfg = cfg || configRotacao();
  var ref = _parseData(instante);
  var inicio = _inicioCicloCorrente(plantao, ref, cfg);
  var horas = (ref - inicio) / 3600000;
  if (horas < 0) { inicio.setDate(inicio.getDate() - CICLO_DIAS); horas += 120; }
  if (horas >= 120) { inicio.setDate(inicio.getDate() + CICLO_DIAS); horas -= 120; }

  var faixa = FAIXAS[FAIXAS.length - 1];
  for (var i = 0; i < FAIXAS.length; i++) {
    if (horas >= FAIXAS[i].de && horas < FAIXAS[i].ate) { faixa = FAIXAS[i]; break; }
  }
  var fimEstado = new Date(inicio.getTime() + faixa.ate * 3600000);
  return {
    plantao: plantao, estado: faixa.estado, protegido: faixa.protegido, rotulo: faixa.rotulo,
    horasNoCiclo: Math.round(horas * 100) / 100,
    inicioCiclo: inicio, fimEstado: fimEstado,
    fimProtecao: faixa.protegido ? fimEstado : null
  };
}

function avaliarConvocacao(plantao, instante, horasTrabalhadas, cfg) {
  cfg = cfg || configRotacao();
  var est = estadoEm(plantao, instante, cfg);
  var ht = Number(horasTrabalhadas) || 0;
  var r2 = function (n) { return Math.round(n * 100) / 100; };

  if (!est.protegido) {
    return {
      irregular: false, estado: est.estado,
      mensagem: 'Convocação fora de período protegido (' + est.rotulo + ').',
      creditoFolga: 0, creditoTrabalho: r2(ht * cfg.fatorConvocacao), total: r2(ht * cfg.fatorConvocacao)
    };
  }
  var horasFolgaPerdidas = (est.fimProtecao - _parseData(instante)) / 3600000;
  var creditoFolga = horasFolgaPerdidas * cfg.multFolgaPerdida;
  var creditoTrabalho = ht * cfg.fatorConvocacao;
  return {
    irregular: true, estado: est.estado,
    mensagem: 'QUEBRA DE REGRA: convocação durante ' + est.rotulo + '.',
    fimProtecao: est.fimProtecao,
    horasFolgaPerdidas: r2(horasFolgaPerdidas),
    creditoFolga: r2(creditoFolga), creditoTrabalho: r2(creditoTrabalho),
    total: r2(creditoFolga + creditoTrabalho)
  };
}
