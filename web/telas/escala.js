/* telas/escala.js — escala: lista de dias (de hoje pra frente), diurno/noturno */
(function () {
  'use strict';
  var R = window.Rotacao, S = window.Store, A = window.App;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var CLS = { 'PL I': 'pl1', 'PL II': 'pl2', 'PL III': 'pl3', 'PL IV': 'pl4', 'PL V': 'pl5' };
  var ROT = { turno_1: 'trab', turno_2: 'trab', descanso: 'prot', folga: 'prot' };

  var hoje = new Date();
  var ano = hoje.getFullYear(), mes = hoje.getMonth();
  var verPassados = false;

  function cfg() { return S.rotacaoConfig(); }
  function nomes(pl) {
    var d = S.plantoes().filter(function (x) { return x.codigo === pl; })[0] || {};
    return [d.pessoa_1, d.pessoa_2].filter(Boolean).join(' + ') || '—';
  }
  function meianoite(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  var HOJE0 = meianoite(hoje);
  function ehHoje(d) { return d.toDateString() === hoje.toDateString(); }

  function pill(pl) {
    if (!pl) return '<span class="pl-pill vazio">—</span>';
    return '<span class="pl-pill ' + (CLS[pl] || '') + '">' + pl + '</span>';
  }

  function montar(corpo) {
    A.acaoHeader('Estado', function () { estadoModal(new Date()); });

    var tb = A.h('div', { class: 'tb' });
    var lbl = A.h('b');
    tb.append(
      A.h('button', { text: '◀', onclick: function () { mv(-1); } }), lbl,
      A.h('button', { text: '▶', onclick: function () { mv(1); } }),
      A.h('button', { text: 'Hoje', onclick: function () { ano = hoje.getFullYear(); mes = hoje.getMonth(); verPassados = false; draw(); } })
    );
    corpo.appendChild(tb);
    var lista = A.h('div', { class: 'lista', style: 'margin-top:12px' });
    corpo.appendChild(lista);

    function mv(d) { mes += d; if (mes < 0) { mes = 11; ano--; } if (mes > 11) { mes = 0; ano++; } verPassados = false; draw(); }

    function draw() {
      lbl.textContent = MESES[mes] + ' / ' + ano;
      lista.innerHTML = '';
      var C = cfg();
      var total = new Date(ano, mes + 1, 0).getDate();
      var mesAtual = (ano === hoje.getFullYear() && mes === hoje.getMonth());
      var pulou = 0;

      for (var dia = 1; dia <= total; dia++) {
        var d = new Date(ano, mes, dia);
        if (mesAtual && !verPassados && meianoite(d) < HOJE0) { pulou++; continue; }
        var t = R.turnosDoDia(d, C);
        var card = A.h('button', { class: 'dia-card' + (ehHoje(d) ? ' hoje' : ''), 'data-iso': iso(d) });
        card.innerHTML =
          '<div class="dia-cab">' + ('0' + dia).slice(-2) + ' · ' + DIAS[d.getDay()] +
            (ehHoje(d) ? ' <span class="tag v">hoje</span>' : '') + '</div>' +
          '<div class="dia-tur"><span class="dia-rot">Diurno</span> ' + pill(t.turno1) + ' <span class="dia-nm">' + A.esc(nomes(t.turno1)) + '</span></div>' +
          '<div class="dia-tur"><span class="dia-rot">Noturno</span> ' + pill(t.turno2) + ' <span class="dia-nm">' + A.esc(nomes(t.turno2)) + '</span></div>';
        card.addEventListener('click', function () {
          var p = this.getAttribute('data-iso').split('-');
          estadoModal(new Date(+p[0], +p[1] - 1, +p[2]));
        });
        lista.appendChild(card);
      }

      if (pulou > 0) {
        var b = A.h('button', { class: 'btn sec pequeno', text: '↑ ver ' + pulou + ' dia(s) passados', style: 'margin-bottom:10px' });
        b.addEventListener('click', function () { verPassados = true; draw(); });
        lista.insertBefore(b, lista.firstChild);
      }
      if (!lista.children.length) lista.innerHTML = '<div class="vazio"><div class="txt">Sem dias.</div></div>';
    }
    draw();
  }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

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

  A.registrarTela('escala', { titulo: 'ESCALA', icone: '🗓', desc: 'Diurno e noturno de cada dia', acesso: 'todos', montar: montar });
})();
