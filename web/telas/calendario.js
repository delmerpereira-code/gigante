/* telas/calendario.js — gantt mensal compacto + alertas */
(function () {
  'use strict';
  var R = window.Rotacao, S = window.Store, A = window.App;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var hoje = new Date(), ano = hoje.getFullYear(), mes = hoje.getMonth();

  var MARCA = {
    ferias: { c: 'fer', s: 'F' }, licenca_medica: { c: 'lic', s: 'L' },
    sobreaviso_escalado: { c: 'sob', s: 'S' }, sobreaviso_acionado: { c: 'sob', s: 'S!' },
    convocacao: { c: 'conv', s: 'C' }, troca: { c: 'perm', s: 'P' }
  };
  function cfg() { return S.rotacaoConfig(); }
  function rank(f) {
    return f.regime === 'plantao' ? 0 : (f.regime === 'coringa' ? 1 : (f.regime === 'expediente' ? 2 : 3));
  }

  function pessoas() {
    var o = cfg().ordem;
    return S.equipe().filter(function (f) {
      return f.regime === 'plantao' || f.regime === 'coringa' || f.regime === 'expediente';
    })
      .sort(function (a, b) {
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        var d = o.indexOf(a.plantao) - o.indexOf(b.plantao);
        return d || a.nome_curto.localeCompare(b.nome_curto);
      });
  }
  function cobreDia(ini, fim, d) {
    var d0 = new Date(ano, mes, d).getTime();
    var a = new Date(ini), b = new Date(fim);
    a = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    b = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return a <= d0 && b >= d0;
  }

  function eventosDoMes() {
    var pa = S.papelAtual();
    var PUB = { ferias: 1, licenca_medica: 1, sobreaviso_escalado: 1, sobreaviso_acionado: 1 };
    var evs = S.eventos().filter(function (e) { return PUB[e.tipo] || pa.tipo === 'lider' || e.pessoa === pa.nome; });
    (S.permutas ? S.permutas() : []).forEach(function (p) {
      if (p.estado !== 'confirmada' && p.estado !== 'concluida') return;
      evs.push({ tipo: 'troca', pessoa: p.pessoa_a, inicio: p.turno_a_inicio, fim: p.turno_a_inicio, obs: p.numero });
      evs.push({ tipo: 'troca', pessoa: p.pessoa_b, inicio: p.turno_a_inicio, fim: p.turno_a_inicio, obs: p.numero });
    });
    return evs;
  }

  function montar(corpo) {
    var tb = A.h('div', { class: 'tb' });
    var lbl = A.h('b');
    tb.append(
      A.h('button', { text: '◀', onclick: function () { mv(-1); } }), lbl,
      A.h('button', { text: '▶', onclick: function () { mv(1); } }),
      A.h('button', { text: 'Hoje', onclick: function () { ano = hoje.getFullYear(); mes = hoje.getMonth(); draw(); } })
    );
    corpo.appendChild(tb);

    var leg = A.h('div', { class: 'legenda', html:
      '<span><i style="background:rgba(249,171,0,.4)"></i>1º</span><span><i style="background:rgba(66,133,244,.35)"></i>2º</span>' +
      '<span><i style="background:#2e7d32"></i>fér</span><span><i style="background:#ef6c00"></i>lic</span>' +
      '<span><i style="background:#1565c0"></i>sob</span><span><i style="background:#cc3322"></i>conv</span>' +
      '<span><i style="background:#6a1b9a"></i>perm</span>' });
    corpo.appendChild(leg);

    var wrap = A.h('div', { class: 'cal-wrap' });
    corpo.appendChild(wrap);
    var alertas = A.h('div', { class: 'card', style: 'margin-top:14px' });
    corpo.appendChild(alertas);

    function mv(d) { mes += d; if (mes < 0) { mes = 11; ano--; } if (mes > 11) { mes = 0; ano++; } draw(); }
    function draw() {
      lbl.textContent = MESES[mes] + ' / ' + ano;
      var pes = pessoas(), evs = eventosDoMes(), total = new Date(ano, mes + 1, 0).getDate(), C = cfg();

      var head = '<tr><th class="cal-nome">Pessoa</th>';
      for (var d = 1; d <= total; d++) {
        var dow = new Date(ano, mes, d).getDay();
        var h = (ano === hoje.getFullYear() && mes === hoje.getMonth() && d === hoje.getDate());
        head += '<th class="d' + (dow === 0 || dow === 6 ? ' fds' : '') + (h ? ' hoje' : '') + '">' + d + '</th>';
      }
      head += '</tr>';

      var body = pes.map(function (p) {
        var rot = p.regime === 'coringa' ? 'coringa'
          : (p.regime === 'expediente' ? 'expediente' : (p.plantao || '—'));
        var tr = '<tr><td class="cal-nome">' + A.esc(p.nome_curto) + '<span>' + A.esc(rot) + '</span></td>';
        for (var d = 1; d <= total; d++) tr += celula(p, d, C, evs);
        return tr + '</tr>';
      }).join('');

      wrap.innerHTML = '<table class="cal">' + head + body + '</table>';
      renderAlertas(alertas, evs, total);
    }

    function faseDia(pl, dia, C) { return pl ? R.fase(pl, new Date(ano, mes, dia), C) : -1; }

    function celula(p, dia, C, evs) {
      var base = '', tit = [], cobrindo = '', ausente = false;
      // plantão efetivo do dia: o próprio, ou o que está cobrindo como substituto
      var plEfetivo = p.regime === 'plantao' ? p.plantao : '';
      evs.forEach(function (e) {
        if ((e.tipo === 'ferias' || e.tipo === 'licenca_medica') && e.substituto === p.nome_curto &&
            cobreDia(e.inicio, e.fim, dia)) {
          var alvo = S.funcionarioPorNome(e.pessoa);
          if (alvo && alvo.plantao) { plEfetivo = alvo.plantao; cobrindo = alvo.plantao; }
        }
      });
      var fEf = faseDia(plEfetivo, dia, C);
      var noTurno = fEf === 0 || fEf === 1;   // dia em que realmente há trabalho
      if (plEfetivo) {
        if (cobrindo && cobrindo !== p.plantao) {
          base = fEf === 0 ? 't1' : (fEf === 1 ? 't2' : '');   // coringa/expediente: só os turnos
        } else {
          base = fEf === 0 ? 't1' : (fEf === 1 ? 't2' : 'folga');
        }
      }

      var mk = '';
      // cobertura: só aparece nos turnos que a coringa/expediente realmente cumpre
      if (cobrindo && cobrindo !== p.plantao && noTurno) {
        mk += '<i class="mk cob">' + A.esc(cobrindo.replace('PL ', '')) + '</i>';
        tit.push('cobre ' + cobrindo + (fEf === 0 ? ' · 1º turno' : ' · 2º turno'));
      }
      evs.forEach(function (e) {
        if (e.pessoa !== p.nome_curto || !MARCA[e.tipo] || !cobreDia(e.inicio, e.fim, dia)) return;
        if (e.situacao === 'rejeitada') return;
        var m = MARCA[e.tipo];
        var solic = e.tipo === 'ferias' && e.situacao === 'solicitada';
        // férias/licença de plantonista: marca só nos dias de turno do plantão dele;
        // nos dias de folga apenas registra (fica só o sombreado claro)
        if ((e.tipo === 'ferias' || e.tipo === 'licenca_medica') && p.regime === 'plantao' && p.plantao) {
          var fp = faseDia(p.plantao, dia, C);
          if (fp !== 0 && fp !== 1) { ausente = true; tit.push(e.tipo + ' (folga)'); return; }
        }
        var extra = (e.tipo === 'ferias' && e.nivel && e.nivel !== 'livre') ? ' ' + e.nivel : '';
        mk += '<i class="mk ' + m.c + extra + (solic ? ' pend' : '') + '">' + m.s + (solic ? '?' : '') + '</i>';
        tit.push((solic ? 'solicitação de ' : '') + e.tipo + (e.obs ? ' ' + e.obs : ''));
      });
      return '<td class="c ' + base + (ausente ? ' aus' : '') + '" title="' + A.esc(tit.join(' | ')) + '">' + mk + '</td>';
    }
    draw();
  }

  function renderAlertas(box, evs, total) {
    var itens = [];
    var corAtivas = S.funcionarios().filter(function (x) { return x.regime === 'coringa' && x.status !== 'afastado'; }).length;
    for (var d = 1; d <= total; d++) {
      var tit = 0, cor = 0;
      evs.forEach(function (e) {
        if (!cobreDia(e.inicio, e.fim, d)) return;
        var g = S.funcionarioPorNome(e.pessoa); if (!g) return;
        if ((e.tipo === 'ferias' || e.tipo === 'licenca_medica') && g.regime === 'plantao') tit++;
        if (e.tipo === 'ferias' && g.regime === 'coringa') cor++;
      });
      var disp = corAtivas - cor;
      if (tit > disp) itens.push('Dia ' + d + ': ' + tit + ' fora, só ' + disp + ' coringa(s) — cobertura insuficiente.');
      else if (tit > 0 && tit === disp) itens.push('Dia ' + d + ': sobreaviso descoberto.');
      else if (tit >= 2) itens.push('Dia ' + d + ': ' + tit + ' coberturas simultâneas.');
    }
    box.innerHTML = '<h3>Alertas do mês</h3><ul class="lista-alertas">' +
      (itens.length ? itens.map(function (t) { return '<li>' + t + '</li>'; }).join('') : '<li class="ok">Sem alertas.</li>') + '</ul>';
  }

  A.registrarTela('calendario', { titulo: 'CALENDÁRIO', icone: '📅', desc: 'Visão geral do mês', acesso: 'todos', montar: montar });
})();
