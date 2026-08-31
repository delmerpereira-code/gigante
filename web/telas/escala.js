/* telas/escala.js — escala contínua de hoje em diante (diurno/noturno por dia) */
(function () {
  'use strict';
  var R = window.Rotacao, S = window.Store, A = window.App;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var CLS = { 'PL I': 'pl1', 'PL II': 'pl2', 'PL III': 'pl3', 'PL IV': 'pl4', 'PL V': 'pl5' };
  var ROT = { turno_1: 'trab', turno_2: 'trab', descanso: 'prot', folga: 'prot' };
  var MS = 864e5;

  var hoje = new Date();
  function m0(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  var HOJE0 = m0(hoje);

  var passados = 0, futuros = 60;   // janela de dias

  function cfg() { return S.rotacaoConfig(); }
  function nomes(pl) {
    var d = S.plantoes().filter(function (x) { return x.codigo === pl; })[0] || {};
    return [d.pessoa_1, d.pessoa_2].filter(Boolean).join(' + ') || '—';
  }
  function ehHoje(d) { return d.toDateString() === hoje.toDateString(); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function pill(pl) {
    return pl ? '<span class="pl-pill ' + (CLS[pl] || '') + '">' + pl + '</span>' : '<span class="pl-pill vazio">—</span>';
  }

  function montar(corpo) {
    A.acaoHeader('Estado', function () { estadoModal(new Date()); });

    var tb = A.h('div', { class: 'tb' });
    tb.append(
      A.h('b', { text: 'De hoje em diante', style: 'flex:1;font-size:13px' }),
      A.h('button', { text: '⇧ Hoje', onclick: function () { irHoje(); } })
    );
    corpo.appendChild(tb);

    var lista = A.h('div', { class: 'lista', style: 'margin-top:12px' });
    corpo.appendChild(lista);
    var cardHoje = null;

    function irHoje() {
      passados = 0; futuros = Math.max(futuros, 60); draw();
      if (cardHoje) setTimeout(function () { cardHoje.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30);
    }

    function draw() {
      var C = cfg();
      lista.innerHTML = '';
      cardHoje = null;

      if (passados > 0) {
        lista.appendChild(botao('▲ menos dias passados', function () { passados = Math.max(0, passados - 15); draw(); }));
      } else {
        lista.appendChild(botao('▲ ver dias passados', function () { passados += 15; draw(); irScroll(); }));
      }

      var mesLbl = '';
      for (var i = -passados; i <= futuros; i++) {
        var d = new Date(HOJE0.getTime() + i * MS);
        var ml = MESES[d.getMonth()].toUpperCase() + ' ' + d.getFullYear();
        if (ml !== mesLbl) { mesLbl = ml; lista.appendChild(A.h('div', { class: 'mes-divisor', text: ml })); }

        var t = R.turnosDoDia(d, C);
        var passado = d < HOJE0;
        var card = A.h('button', { class: 'dia-card' + (ehHoje(d) ? ' hoje' : (passado ? ' passado' : '')), 'data-iso': iso(d) });
        card.innerHTML =
          '<div class="dia-cab">' + ('0' + d.getDate()).slice(-2) + ' · ' + DIAS[d.getDay()] +
            (ehHoje(d) ? ' <span class="tag v">hoje</span>' : '') + '</div>' +
          '<div class="dia-tur"><span class="dia-rot">Diurno</span> ' + pill(t.turno1) + ' <span class="dia-nm">' + A.esc(nomes(t.turno1)) + '</span></div>' +
          '<div class="dia-tur"><span class="dia-rot">Noturno</span> ' + pill(t.turno2) + ' <span class="dia-nm">' + A.esc(nomes(t.turno2)) + '</span></div>';
        card.addEventListener('click', function () {
          var p = this.getAttribute('data-iso').split('-');
          estadoModal(new Date(+p[0], +p[1] - 1, +p[2]));
        });
        lista.appendChild(card);
        if (ehHoje(d)) cardHoje = card;
      }

      lista.appendChild(botao('▼ mais 30 dias', function () { futuros += 30; draw(); }));
    }
    function botao(txt, fn) {
      var b = A.h('button', { class: 'btn sec pequeno', text: txt, style: 'margin:4px 0' });
      b.addEventListener('click', fn);
      return b;
    }
    function irScroll() { if (cardHoje) setTimeout(function () { cardHoje.scrollIntoView({ block: 'start' }); }, 20); }

    draw();
    if (cardHoje) setTimeout(function () { cardHoje.scrollIntoView({ block: 'start' }); }, 40);
  }

  function estadoModal(data) {
    var v = iso(data);
    var m = A.abrirModal(
      '<h2>Escala do dia</h2>' +
      '<div class="campo"><label>Data</label><input type="date" id="es-data" value="' + v + '"></div>' +
      '<div id="es-turnos" style="margin-bottom:12px"></div>' +
      '<div class="home-sec-tit">Estado dos 5 plantões</div>' +
      '<div id="es-res" class="est-lista"></div>' +
      '<div class="modal-acoes"><button class="btn sec" id="es-x">Fechar</button></div>');
    function calc() {
      var val = m.querySelector('#es-data').value; if (!val) return;
      var t = R.turnosDoDia(new Date(val + 'T12:00'), cfg());
      m.querySelector('#es-turnos').innerHTML =
        '<div class="dia-tur"><span class="dia-rot">Diurno · 08–20</span> ' + pill(t.turno1) + ' <span class="dia-nm">' + A.esc(nomes(t.turno1)) + '</span></div>' +
        '<div class="dia-tur"><span class="dia-rot">Noturno · 20–08</span> ' + pill(t.turno2) + ' <span class="dia-nm">' + A.esc(nomes(t.turno2)) + '</span></div>';
      var inst = new Date(val + 'T08:30:00');
      m.querySelector('#es-res').innerHTML = cfg().ordem.map(function (pl) {
        var e = R.estadoEm(pl, inst, cfg());
        return '<div class="est-item ' + ROT[e.estado] + '"><span class="pl">' + pl + '</span>' +
          '<div class="card-sub">' + e.rotulo + '</div><div class="card-sub">' + A.esc(nomes(pl)) + '</div>' +
          (e.protegido ? '<div class="card-sub">protegido até ' + e.fimProtecao.toLocaleString('pt-BR') + '</div>' : '') + '</div>';
      }).join('');
    }
    m.querySelector('#es-data').addEventListener('change', calc);
    m.querySelector('#es-x').addEventListener('click', A.fecharModal);
    calc();
  }

  A.registrarTela('escala', { titulo: 'ESCALA', icone: '🗓', desc: 'Diurno e noturno, de hoje em diante', acesso: 'todos', montar: montar });
})();
