/* telas/escala.js — escala mensal + estado dos plantões numa data */
(function () {
  'use strict';
  var R = window.Rotacao, S = window.Store, A = window.App;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var CLASSE = { 'PL I': 'pl1', 'PL II': 'pl2', 'PL III': 'pl3', 'PL IV': 'pl4', 'PL V': 'pl5' };
  var ROT = { turno_1: 'trab', turno_2: 'trab', descanso: 'prot', folga: 'prot' };

  var hoje = new Date(), ano = hoje.getFullYear(), mes = hoje.getMonth();

  function cfg() { return S.rotacaoConfig(); }
  function nomes(pl) {
    var d = S.plantoes().filter(function (x) { return x.codigo === pl; })[0] || {};
    return [d.pessoa_1, d.pessoa_2].filter(Boolean).join(' + ') || '—';
  }

  function montar(corpo) {
    A.acaoHeader('Estado', estadoModal);

    var tb = A.h('div', { class: 'tb' });
    var lbl = A.h('b');
    tb.append(
      A.h('button', { text: '◀', onclick: function () { mover(-1, lbl, lista); } }),
      lbl,
      A.h('button', { text: '▶', onclick: function () { mover(1, lbl, lista); } }),
      A.h('button', { text: 'Hoje', onclick: function () { ano = hoje.getFullYear(); mes = hoje.getMonth(); redraw(lbl, lista); } })
    );
    corpo.appendChild(tb);
    var lista = A.h('div', { class: 'lista', style: 'margin-top:12px' });
    corpo.appendChild(lista);
    redraw(lbl, lista);
  }

  function mover(d, lbl, lista) { mes += d; if (mes < 0) { mes = 11; ano--; } if (mes > 11) { mes = 0; ano++; } redraw(lbl, lista); }

  function redraw(lbl, lista) {
    lbl.textContent = MESES[mes] + ' / ' + ano;
    lista.innerHTML = '';
    var total = new Date(ano, mes + 1, 0).getDate();
    for (var d = 1; d <= total; d++) {
      var data = new Date(ano, mes, d);
      var t = R.turnosDoDia(data, cfg());
      var ehHoje = data.toDateString() === hoje.toDateString();
      var card = A.h('div', { class: 'card', style: ehHoje ? 'border-color:var(--accent)' : '' });
      card.innerHTML =
        '<div class="card-top"><span class="card-titulo">' + String(d).padStart(2, '0') + ' ' + DOW[data.getDay()] +
        (ehHoje ? ' · hoje' : '') + '</span></div>' +
        turnoHTML('1º · 08–20', t.turno1) + turnoHTML('2º · 20–08', t.turno2);
      lista.appendChild(card);
    }
  }
  function turnoHTML(rot, pl) {
    if (!pl) return '<div class="card-linha muted">' + rot + ' — —</div>';
    return '<div class="card-linha"><span class="tag n">' + rot + '</span> <b>' + pl + '</b> · ' +
      A.esc(nomes(pl)) + '</div>';
  }

  function estadoModal() {
    var iso = new Date().toISOString().slice(0, 10);
    var m = A.abrirModal(
      '<h2>Estado dos plantões</h2>' +
      '<div class="campo"><label>Data</label><input type="date" id="es-data" value="' + iso + '"></div>' +
      '<div id="es-res" class="est-lista"></div>' +
      '<div class="modal-acoes"><button class="btn sec" id="es-fechar">Fechar</button></div>');
    function calc() {
      var v = m.querySelector('#es-data').value;
      if (!v) return;
      var inst = new Date(v + 'T08:30:00');
      m.querySelector('#es-res').innerHTML = cfg().ordem.map(function (pl) {
        var e = R.estadoEm(pl, inst, cfg());
        return '<div class="est-item ' + ROT[e.estado] + '"><span class="pl">' + pl + '</span>' +
          '<div class="card-sub">' + e.rotulo + '</div>' +
          '<div class="card-sub">' + A.esc(nomes(pl)) + '</div>' +
          (e.protegido ? '<div class="card-sub">protegido até ' + e.fimProtecao.toLocaleString('pt-BR') + '</div>' : '') +
          '</div>';
      }).join('');
    }
    m.querySelector('#es-data').addEventListener('change', calc);
    m.querySelector('#es-fechar').addEventListener('click', A.fecharModal);
    calc();
  }

  A.registrarTela('escala', { titulo: 'ESCALA', icone: '🗓', desc: 'Rotação dos 5 plantões', acesso: 'todos', montar: montar });
})();
