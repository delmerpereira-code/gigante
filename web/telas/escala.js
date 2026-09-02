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
  function ausenciaDe(nome, d) {
    var dia = iso(d);
    return S.eventos().filter(function (e) {
      if (e.tipo !== 'ferias' && e.tipo !== 'licenca_medica') return false;
      if (e.situacao === 'solicitada' || e.situacao === 'rejeitada') return false; // ainda não vale na escala
      return e.pessoa === nome && String(e.inicio).slice(0, 10) <= dia && dia <= String(e.fim).slice(0, 10);
    })[0] || null;
  }
  function coringasNoTurno(pl, d, parte) {
    var dia = iso(d);
    return S.eventos().filter(function (e) {
      if (e.tipo !== 'turno_coringa' || e.plantao !== pl) return false;
      if (iso(new Date(e.inicio)) !== dia) return false;
      if (!parte) return true;
      var diurno = new Date(e.inicio).getHours() < 12;
      return parte === 'diurno' ? diurno : !diurno;
    }).map(function (e) { return { pessoa: e.pessoa, substituto: e.substituto || '' }; });
  }
  // Nomes na escala do dia, já trocando quem está de férias/licença pela
  // coringa que cobre (campo "substituto") e somando os turnos avulsos de coringa.
  function nomesNoDia(pl, d, parte) {
    var dd = S.plantoes().filter(function (x) { return x.codigo === pl; })[0] || {};
    var base = [dd.pessoa_1, dd.pessoa_2].filter(Boolean);
    var linha = (base.length ? base : ['—']).map(function (nome) {
      if (nome === '—') return '—';
      var a = ausenciaDe(nome, d);
      if (!a) return A.esc(nome);
      var mot = a.tipo === 'ferias' ? 'férias' : 'licença';
      if (a.substituto) {
        return '<span class="cobre">' + A.esc(a.substituto) + '</span>' +
          '<span class="cobre-de"> (cobre ' + A.esc(nome) + ' · ' + mot + ')</span>';
      }
      return '<span class="ausente">' + A.esc(nome) + '</span><span class="cobre-de"> (' + mot + ' · sem cobertura)</span>';
    });
    coringasNoTurno(pl, d, parte).forEach(function (c) {
      linha.push('<span class="cobre">' + A.esc(c.pessoa) + '</span><span class="cobre-de"> (' +
        (c.substituto ? 'cobre ' + A.esc(c.substituto) : 'reforço') + ')</span>');
    });
    return linha.join(' + ');
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
          '<div class="dia-tur"><span class="dia-rot">Diurno</span> ' + pill(t.turno1) + ' <span class="dia-nm">' + nomesNoDia(t.turno1, d, 'diurno') + '</span></div>' +
          '<div class="dia-tur"><span class="dia-rot">Noturno</span> ' + pill(t.turno2) + ' <span class="dia-nm">' + nomesNoDia(t.turno2, d, 'noturno') + '</span></div>';
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
      var dObj = new Date(val + 'T12:00');
      var t = R.turnosDoDia(dObj, cfg());
      m.querySelector('#es-turnos').innerHTML =
        '<div class="dia-tur"><span class="dia-rot">Diurno · 08–20</span> ' + pill(t.turno1) + ' <span class="dia-nm">' + nomesNoDia(t.turno1, dObj, 'diurno') + '</span></div>' +
        '<div class="dia-tur"><span class="dia-rot">Noturno · 20–08</span> ' + pill(t.turno2) + ' <span class="dia-nm">' + nomesNoDia(t.turno2, dObj, 'noturno') + '</span></div>';
      var inst = new Date(val + 'T08:30:00');
      m.querySelector('#es-res').innerHTML = cfg().ordem.map(function (pl) {
        var e = R.estadoEm(pl, inst, cfg());
        return '<div class="est-item ' + ROT[e.estado] + '"><span class="pl">' + pl + '</span>' +
          '<div class="card-sub">' + e.rotulo + '</div><div class="card-sub">' + nomesNoDia(pl, dObj) + '</div>' +
          (e.protegido ? '<div class="card-sub">protegido até ' + e.fimProtecao.toLocaleString('pt-BR') + '</div>' : '') + '</div>';
      }).join('');
    }
    m.querySelector('#es-data').addEventListener('change', calc);
    m.querySelector('#es-x').addEventListener('click', A.fecharModal);
    calc();
  }

  A.registrarTela('escala', { titulo: 'ESCALA', icone: '🗓', desc: 'Diurno e noturno, de hoje em diante', acesso: 'todos', montar: montar });
})();
