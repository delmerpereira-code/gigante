/* ============================================================================
 *  rotacao.js — Motor de rotação do plantão (120 h / 5 dias)
 *  Puro, sem dependências. Usado no front (GitHub Pages) e espelhado no
 *  Apps Script para validações no servidor.
 * ==========================================================================*/
(function (root) {
  'use strict';

  // --- Configuração padrão (espelha a aba Config) ----------------------------
  var CONFIG_PADRAO = {
    ancora: '2026-09-01',                                  // dia em que ORDEM[0] inicia o 1º turno
    ordem: ['PL IV', 'PL V', 'PL I', 'PL II', 'PL III'],   // ordem de entrada no ciclo
    multFolgaPerdida: 1,
    fatorConvocacao: 1,
    creditoSobreaviso: 0
  };

  var CICLO_DIAS = 5;
  var MS_DIA = 24 * 60 * 60 * 1000;

  // Faixas do ciclo em horas a partir do dia D às 08:00
  var FAIXAS = [
    { de: 0,  ate: 12,  estado: 'turno_1',   protegido: false, rotulo: '1º turno (08–20)' },
    { de: 12, ate: 36,  estado: 'descanso',  protegido: true,  rotulo: 'descanso protegido 24h' },
    { de: 36, ate: 48,  estado: 'turno_2',   protegido: false, rotulo: '2º turno (20–08)' },
    { de: 48, ate: 120, estado: 'folga',     protegido: true,  rotulo: 'folga 72h' }
  ];

  // --- Helpers de data ------------------------------------------------------
  function meiaNoite(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseData(v) {
    if (v instanceof Date) return v;
    // aceita 'YYYY-MM-DD' como data local (sem fuso)
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim());
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return new Date(v);
  }

  function diasEntre(a, b) {
    return Math.round((meiaNoite(b) - meiaNoite(a)) / MS_DIA);
  }

  // --- Núcleo --------------------------------------------------------------

  /**
   * Fase (0..4) de um plantão numa data.
   *   0 = faz o 1º turno nesse dia
   *   1 = descanso protegido de dia + 2º turno à noite
   *   2 = encerra 2º turno às 08:00, folga a partir daí
   *   3,4 = folga
   */
  function fase(plantao, data, config) {
    var cfg = config || CONFIG_PADRAO;
    var idx = cfg.ordem.indexOf(plantao);
    if (idx < 0) throw new Error('Plantão desconhecido: ' + plantao);
    var delta = diasEntre(parseData(cfg.ancora), parseData(data));
    return ((delta - idx) % CICLO_DIAS + CICLO_DIAS) % CICLO_DIAS;
  }

  /** Qual plantão faz o 1º turno e qual faz o 2º turno num dia. */
  function turnosDoDia(data, config) {
    var cfg = config || CONFIG_PADRAO;
    var t1 = null, t2 = null;
    cfg.ordem.forEach(function (pl) {
      var f = fase(pl, data, cfg);
      if (f === 0) t1 = pl;
      if (f === 1) t2 = pl;
    });
    return { data: parseData(data), turno1: t1, turno2: t2 };
  }

  /**
   * Momento (Date) em que o ciclo corrente do plantão começou (dia D às 08:00),
   * relativo a uma data de referência.
   */
  function inicioCicloCorrente(plantao, dataRef, config) {
    var cfg = config || CONFIG_PADRAO;
    var f = fase(plantao, dataRef, cfg);
    var d0 = meiaNoite(parseData(dataRef));
    d0.setDate(d0.getDate() - f);
    d0.setHours(8, 0, 0, 0);
    return d0;
  }

  /**
   * Estado de um plantão num instante exato.
   * Retorna { estado, protegido, rotulo, horasNoCiclo, fimEstado, fimProtecao }.
   *   fimProtecao = quando termina o bloco protegido atual (null se não protegido).
   */
  function estadoEm(plantao, instante, config) {
    var cfg = config || CONFIG_PADRAO;
    var ref = parseData(instante);
    var inicio = inicioCicloCorrente(plantao, ref, cfg);
    var horas = (ref - inicio) / 3600000;
    if (horas < 0) { inicio.setDate(inicio.getDate() - CICLO_DIAS); horas += 120; }
    if (horas >= 120) { inicio.setDate(inicio.getDate() + CICLO_DIAS); horas -= 120; }

    var faixa = FAIXAS[FAIXAS.length - 1];
    for (var i = 0; i < FAIXAS.length; i++) {
      if (horas >= FAIXAS[i].de && horas < FAIXAS[i].ate) { faixa = FAIXAS[i]; break; }
    }
    var fimEstado = new Date(inicio.getTime() + faixa.ate * 3600000);
    return {
      plantao: plantao,
      estado: faixa.estado,
      protegido: faixa.protegido,
      rotulo: faixa.rotulo,
      horasNoCiclo: Math.round(horas * 100) / 100,
      inicioCiclo: inicio,
      fimEstado: fimEstado,
      fimProtecao: faixa.protegido ? fimEstado : null
    };
  }

  /**
   * Avalia uma convocação de um plantão num instante.
   * Se cair em período protegido, marca a quebra e calcula o impacto.
   *   horasTrabalhadas: duração da convocação (opcional, para o crédito de trabalho).
   */
  function avaliarConvocacao(plantao, instante, horasTrabalhadas, config) {
    var cfg = config || CONFIG_PADRAO;
    var est = estadoEm(plantao, instante, cfg);
    var ht = Number(horasTrabalhadas) || 0;

    if (!est.protegido) {
      return {
        irregular: false,
        estado: est.estado,
        mensagem: 'Convocação fora de período protegido (' + est.rotulo + ').',
        creditoFolga: 0,
        creditoTrabalho: Math.round(ht * cfg.fatorConvocacao * 100) / 100,
        total: Math.round(ht * cfg.fatorConvocacao * 100) / 100
      };
    }

    var horasFolgaPerdidas = (est.fimProtecao - parseData(instante)) / 3600000;
    var creditoFolga = horasFolgaPerdidas * cfg.multFolgaPerdida;
    var creditoTrabalho = ht * cfg.fatorConvocacao;

    return {
      irregular: true,
      estado: est.estado,
      mensagem: 'QUEBRA DE REGRA: convocação durante ' + est.rotulo +
                '. Proteção terminaria em ' + est.fimProtecao.toLocaleString('pt-BR') + '.',
      fimProtecao: est.fimProtecao,
      horasFolgaPerdidas: Math.round(horasFolgaPerdidas * 100) / 100,
      creditoFolga: Math.round(creditoFolga * 100) / 100,
      creditoTrabalho: Math.round(creditoTrabalho * 100) / 100,
      total: Math.round((creditoFolga + creditoTrabalho) * 100) / 100
    };
  }

  var API = {
    CONFIG_PADRAO: CONFIG_PADRAO,
    CICLO_DIAS: CICLO_DIAS,
    FAIXAS: FAIXAS,
    fase: fase,
    turnosDoDia: turnosDoDia,
    inicioCicloCorrente: inicioCicloCorrente,
    estadoEm: estadoEm,
    avaliarConvocacao: avaliarConvocacao
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.Rotacao = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
