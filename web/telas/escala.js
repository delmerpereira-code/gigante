/* telas/escala.js — escala em formato de calendário (grade mensal) */
(function () {
  'use strict';
  var R = window.Rotacao, S = window.Store, A = window.App;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  var CLS = { 'PL I': 'pl1', 'PL II': 'pl2', 'PL III': 'pl3', 'PL IV': 'pl4', 'PL V': 'pl5' };
  var ROT = { turno_1: 'trab', turno_2: 'trab', descanso: 'prot', folga: 'prot' };

  var hoje = new Date();
  var ano = hoje.getFullYear(), mes = hoje.getMonth();

  function cfg() { return S.rotacaoConfig(); }
  function nomes(pl) {
    var d = S.plantoes().filter(function (x) { return x.codigo === pl; })[0] || {};
    return [d.pessoa_1, d.pessoa_2].filter(Boolean).join(' + ') || '—';
  }
  function ehHoje(d) { return d.toDateString() === hoje.toDateString(); }
  function ehPassado(d) { var h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); return d < h; }

  function montar(corpo) {
    A.acaoHeader('Estado', function () { estadoModal(new Date()); });

    var tb = A.h('div', { class: 'tb' });
    var lbl = A.h('b');
    tb.append(
      A.h('button', { text: '◀', onclick: function () { mv(-1); } }), lbl,
      A.h('button', { text: '▶', onclick: function () { mv(1); } }),
      A.h('button', { text: 'Hoje', onclick: function () { ano = hoje.getFullYear(); mes = hoje.getMonth(); draw(); } })
    );
    corpo.appendChild(tb);

    var leg = A.h('div', { class: 'legenda' });
    leg.innerHTML = cfg().ordem.map(function (p) {
      return '<span><i class="' + (CLS[p] || '') + '" style="background:var(--' + (CLS[p] || 'accent') + ')"></i>' + p + '</span>';
    }).join('');
    corpo.appendChild(leg);

    var grade = A.h('div', { class: 'cal-mes' });
    corpo.appendChild(grade);

    function mv(d) { mes += d; if (mes < 0) { mes = 11; ano--; } if (mes > 11) { mes = 0; ano++; } draw(); }

    function draw() {
      lbl.textContent = MESES[mes] + ' / ' + ano;
      var C = cfg();
      var prim = new Date(ano, mes, 1);
      var ini = new Date(ano, mes, 1 - prim.getDay());       // domingo antes do dia 1
      var html = '<div class="cal-dow">' + DOW.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>';
      html += '<div class="cal-grid">';
      var ultimo = new Date(ano, mes + 1, 0).getDate();
      var semanas = Math.ceil((prim.getDay() + ultimo) / 7);
      for (var i = 0; i < semanas * 7; i++) {
        var d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i);
        var foraMes = d.getMonth() !== mes;
        var t = R.turnosDoDia(d, C);
        var cls = 'cal-cel' + (foraMes ? ' fora' : '') + (ehHoje(d) ? ' hoje' : '') + (!foraMes && ehPassado(d) ? ' passado' : '');
        html += '<button class="' + cls + '" data-iso="' + iso(d) + '">' +
          '<span class="cd">' + d.getDate() + '</span>' +
          (t.turno1 ? '<span class="ct ' + (CLS[t.turno1] || '') + '">' + curto(t.turno1) + '</span>' : '') +
          (t.turno2 ? '<span class="ct2">' + curto(t.turno2) + '</span>' : '') +
          '</button>';
      }
      html += '</div>';
      grade.innerHTML = html;
      Array.prototype.forEach.call(grade.querySelectorAll('.cal-cel'), function (b) {
        b.addEventListener('click', function () {
          var p = b.getAttribute('data-iso').split('-');
          estadoModal(new Date(+p[0], +p[1] - 1, +p[2]));
        });
      });
    }
    draw();
  }
  function curto(pl) { return String(pl).replace('PL ', ''); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  function estadoModal(data) {
    var v = iso(data);
    var m = A.abrirModal(
      '<h2>Escala do dia</h2>' +
      '<div class="campo"><label>Data</label><input type="date" id="es-data" value="' + v + '"></div>' +
      '<div id="es-turnos" style="margin-bottom:10px"></div>' +
      '<div class="home-sec-tit">Estado dos 5 plantões</div>' +
      '<div id="es-res" class="est-lista"></div>' +
      '<div class="modal-acoes"><button class="btn sec" id="es-x">Fechar</button></div>');
    function calc() {
      var val = m.querySelector('#es-data').value; if (!val) return;
      var t = R.turnosDoDia(new Date(val + 'T12:00'), cfg());
      m.querySelector('#es-turnos').innerHTML =
        linhaT('1º turno · 08–20', t.turno1) + linhaT('2º turno · 20–08', t.turno2);
      var inst = new Date(val + 'T08:30:00');
      m.querySelector('#es-res').innerHTML = cfg().ordem.map(function (pl) {
        var e = R.estadoEm(pl, inst, cfg());
        return '<div class="est-item ' + ROT[e.estado] + '"><span class="pl">' + pl + '</span>' +
          '<div class="card-sub">' + e.rotulo + '</div><div class="card-sub">' + A.esc(nomes(pl)) + '</div>' +
          (e.protegido ? '<div class="card-sub">protegido até ' + e.fimProtecao.toLocaleString('pt-BR') + '</div>' : '') + '</div>';
      }).join('');
    }
    function linhaT(rot, pl) {
      if (!pl) return '<div class="card-linha muted">' + rot + ' — —</div>';
      return '<div class="card-linha"><span class="tag n">' + rot + '</span> <b>' + pl + '</b> · ' + A.esc(nomes(pl)) + '</div>';
    }
    m.querySelector('#es-data').addEventListener('change', calc);
    m.querySelector('#es-x').addEventListener('click', A.fecharModal);
    calc();
  }

  A.registrarTela('escala', { titulo: 'ESCALA', icone: '🗓', desc: 'Calendário dos 5 plantões', acesso: 'todos', montar: montar });
})();
