/* ============================================================================
 *  permuta.js — Permuta de turno: proposta, aprovação, confirmação, termo e
 *  a "conta entre funcionários" (fora do banco de horas).
 * ==========================================================================*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = window.Store;

  var ESTADO_ROT = {
    proposta: 'aguardando aprovação', aprovada: 'aguardando confirmação de B',
    confirmada: 'confirmada', concluida: 'concluída',
    rejeitada: 'rejeitada', recusada: 'recusada', cancelada: 'cancelada', expirada: 'expirada (prazo)'
  };
  var ESTADO_CLS = {
    proposta: 'st-licenca', aprovada: 'st-licenca', confirmada: 'st-ativo', concluida: 'st-ativo',
    rejeitada: 'st-afastado', recusada: 'st-afastado', cancelada: 'st-afastado', expirada: 'st-afastado'
  };

  function eu() { return S.papelAtual(); }
  function souLider() { return S.ehLider(); }

  function plantonistas() {
    return S.funcionarios().filter(function (f) { return f.regime === 'plantao'; })
      .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
  }

  function fmtDataBR(iso) {
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }
  function fmtHora(iso) {
    var d = new Date(iso);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function rotuloTurno(t) {
    return fmtDataBR(t.data) + ' · ' + (t.parte === 'diurno' ? 'diurno (08–20)' : 'noturno (20–08)') +
      ' · ' + t.plantao;
  }

  // ─── formulário de proposta ───────────────────────────────────────────────
  function preencherPessoas() {
    var lista = plantonistas();
    var p = eu();
    var opt = function (f) { return '<option value="' + f.nome_curto + '">' + f.nome_curto + ' · ' + f.plantao + '</option>'; };
    if (souLider()) {
      $('pA').innerHTML = lista.map(opt).join('');
      $('pA').disabled = false;
    } else {
      $('pA').innerHTML = lista.filter(function (f) { return f.nome_curto === p.nome; }).map(opt).join('') ||
        '<option value="">(você não tem plantão fixo)</option>';
      $('pA').disabled = true;
    }
    atualizarB();
  }
  function atualizarB() {
    var a = $('pA').value;
    var prev = $('pB').value;
    $('pB').innerHTML = plantonistas().filter(function (f) { return f.nome_curto !== a; })
      .map(function (f) { return '<option value="' + f.nome_curto + '">' + f.nome_curto + ' · ' + f.plantao + '</option>'; }).join('');
    if (prev && $('pB').querySelector('option[value="' + prev + '"]')) $('pB').value = prev;
    atualizarLabels();
    preencherTurnos();
  }
  function atualizarLabels() {
    var a = $('pA').value || 'A', b = $('pB').value || 'B';
    ['lblA', 'lblA2'].forEach(function (id) { $(id).textContent = a; });
    ['lblB', 'lblB2'].forEach(function (id) { $(id).textContent = b; });
  }

  var turnosA = [], turnosB = [];
  function preencherTurnos() {
    turnosA = S.proximosTurnosDe($('pA').value, 12);
    turnosB = S.proximosTurnosDe($('pB').value, 12);
    $('turnoA').innerHTML = turnosA.map(function (t, i) { return '<option value="' + i + '">' + rotuloTurno(t) + '</option>'; }).join('');
    $('turnoB').innerHTML = turnosB.map(function (t, i) { return '<option value="' + i + '">' + rotuloTurno(t) + '</option>'; }).join('');
    $('semTurnos').hidden = turnosA.length > 0;
  }
  function toggleMaoDupla() {
    $('wrapTurnoB').hidden = !$('maoDupla').checked;
  }

  function propor(ev) {
    ev.preventDefault();
    $('formErro').textContent = '';
    var tA = turnosA[Number($('turnoA').value)];
    var tB = turnosB[Number($('turnoB').value)];
    if (!tA) { $('formErro').textContent = 'Escolha o turno que ' + $('pA').value + ' vai passar.'; return; }
    Promise.resolve(S.proporPermuta({
      pessoa_a: $('pA').value, pessoa_b: $('pB').value,
      turno_a: tA, mao_dupla: $('maoDupla').checked ? 'sim' : 'nao', turno_b: tB,
      obs: $('obs').value
    })).then(function () { $('obs').value = ''; render(); })
      .catch(function (e) { $('formErro').textContent = e.message || String(e); });
  }

  // ─── lista de permutas ────────────────────────────────────────────────────
  function acoesDe(p) {
    var me = eu(), b = [];
    var souA = me.nome === p.pessoa_a, souB = me.nome === p.pessoa_b, lid = me.tipo === 'lider';
    if (p.estado === 'proposta') {
      if (lid) { b.push(['aprovar', 'primario']); b.push(['rejeitar', 'danger']); }
      if (souA || lid) b.push(['cancelar', '']);
    } else if (p.estado === 'aprovada') {
      if (souB) { b.push(['confirmar', 'primario']); b.push(['recusar', 'danger']); }
      if (souA || lid) b.push(['cancelar', '']);
    } else if (p.estado === 'confirmada') {
      if (souA || souB || lid) b.push(['cancelar', 'danger']);
      if (lid) b.push(['concluir', '']);
    }
    b.push(['termo', '']);
    return b;
  }
  var ACAO_FN = {
    aprovar: function (id) { return S.aprovarPermuta(id, eu().nome); },
    rejeitar: function (id) { var m = prompt('Motivo da rejeição (opcional):'); if (m === null) return null; return S.rejeitarPermuta(id, eu().nome, m); },
    confirmar: function (id) { return S.confirmarPermuta(id, eu().nome); },
    recusar: function (id) { return confirm('Recusar o acordo? A permuta é cancelada.') ? S.recusarPermuta(id, eu().nome) : null; },
    cancelar: function (id) { return confirm('Cancelar esta permuta?') ? S.cancelarPermuta(id, eu().nome) : null; },
    concluir: function (id) { return S.concluirPermuta(id); },
    termo: function (id) { verTermo(id); return null; }
  };

  function turnoResumo(p) {
    var s = p.pessoa_a + ' passa: ' + fmtDataBR(p.turno_a_data) + ' ' + p.turno_a_parte +
      ' (' + fmtHora(p.turno_a_inicio) + '–' + fmtHora(p.turno_a_fim) + ')';
    if (p.mao_dupla === 'sim') {
      s += ' — em troca, ' + p.pessoa_b + ' passa: ' + fmtDataBR(p.turno_b_data) + ' ' + p.turno_b_parte;
    } else {
      s += ' — mão única: ' + p.pessoa_a + ' fica devendo 12 h a ' + p.pessoa_b;
    }
    return s;
  }

  function render() {
    var funcs = S.funcionarios();
    $('avisoVazio').hidden = funcs.length > 0;
    preencherPessoas();
    toggleMaoDupla();
    renderContas();

    var lista = S.permutasVisiveis().sort(function (a, b) {
      return String(b.criada_em).localeCompare(String(a.criada_em));
    });
    $('qtd').textContent = lista.length;
    var box = $('lista');
    box.innerHTML = '';
    if (!lista.length) { box.innerHTML = '<p class="muted">Nenhuma permuta.</p>'; return; }

    lista.forEach(function (p) {
      var div = document.createElement('div');
      div.className = 'permuta-card';
      var acoes = acoesDe(p).map(function (a) {
        return '<button class="mini ' + (a[1] === 'primario' ? 'primario-mini' : (a[1] === 'danger' ? 'danger' : '')) +
          '" data-ac="' + a[0] + '">' + a[0] + '</button>';
      }).join(' ');
      div.innerHTML =
        '<div class="pc-top"><b>' + p.numero + '</b> · ' + p.pessoa_a + ' → ' + p.pessoa_b +
        ' <span class="tag ' + (ESTADO_CLS[p.estado] || '') + '">' + (ESTADO_ROT[p.estado] || p.estado) + '</span></div>' +
        '<div class="pc-turno">' + turnoResumo(p) + '</div>' +
        (p.obs ? '<div class="pc-obs">“' + p.obs + '”</div>' : '') +
        '<div class="pc-acoes">' + acoes + '</div>';
      acoesDe(p).forEach(function (a) {
        div.querySelector('[data-ac="' + a[0] + '"]').addEventListener('click', function () {
          var r;
          try { r = ACAO_FN[a[0]](p.id); }
          catch (e) { alert(e.message || String(e)); return; }
          Promise.resolve(r).then(function () { render(); })
            .catch(function (e) { alert(e.message || String(e)); render(); });
        });
      });
      box.appendChild(div);
    });
  }

  // ─── contas entre funcionários ────────────────────────────────────────────
  function renderContas() {
    var me = eu();
    var box = $('contas');
    if (me.tipo === 'lider') {
      // todas as contas não-zeradas
      var vistos = {}, itens = [];
      S.contaPermutas().forEach(function (r) {
        var par = [r.de, r.para].sort().join('|');
        if (vistos[par]) return; vistos[par] = 1;
        var ab = par.split('|');
        var s = S.saldoEntre(ab[0], ab[1]);
        if (Math.abs(s) > 0.001) {
          itens.push(s > 0 ? ab[0] + ' deve ' + s + ' h a ' + ab[1] : ab[1] + ' deve ' + (-s) + ' h a ' + ab[0]);
        }
      });
      box.innerHTML = itens.length
        ? itens.map(function (t) { return '<span class="chip">' + t + '</span>'; }).join('')
        : '<span class="muted">Nenhuma dívida de permuta em aberto.</span>';
    } else {
      var resumo = S.resumoContas(me.nome);
      box.innerHTML = resumo.length
        ? resumo.map(function (r) {
            return '<span class="chip' + (r.devo ? ' incompleto' : '') + '">' + r.texto + '</span>';
          }).join('')
        : '<span class="muted">Você não tem contas de permuta em aberto.</span>';
    }
  }

  function preencherQuita() {
    var ps = S.funcionarios().filter(function (f) { return f.regime === 'plantao' || f.regime === 'coringa'; })
      .map(function (f) { return f.nome_curto; }).sort();
    var o = ps.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
    $('qDe').innerHTML = o; $('qPara').innerHTML = o;
    if (eu().tipo === 'funcionario') { $('qDe').value = eu().nome; }
  }
  function quitar(ev) {
    ev.preventDefault();
    $('qErro').textContent = '';
    Promise.resolve(S.quitarPermuta($('qDe').value, $('qPara').value, parseFloat($('qHoras').value), $('qObs').value))
      .then(function () {
        $('qHoras').value = ''; $('qObs').value = '';
        $('formQuita').hidden = true;
        render();
      })
      .catch(function (e) { $('qErro').textContent = e.message || String(e); });
  }

  // ─── termo ───────────────────────────────────────────────────────────────
  function verTermo(id) {
    var p = S.permutaPorId(id);
    if (!p) return;
    var A = S.funcionarioPorNome(p.pessoa_a) || {}, B = S.funcionarioPorNome(p.pessoa_b) || {};
    function turnoTexto(data, parte, ini, fim) {
      return 'o turno ' + parte + ' do dia ' + fmtDataBR(data) + ' (das ' + fmtHora(ini) + ' às ' + fmtHora(fim) + ')';
    }
    var corpo = '<p>A PARTE A transfere à PARTE B ' +
      turnoTexto(p.turno_a_data, p.turno_a_parte, p.turno_a_inicio, p.turno_a_fim) + '.</p>';
    if (p.mao_dupla === 'sim') {
      corpo += '<p>Em contrapartida, a PARTE B transfere à PARTE A ' +
        turnoTexto(p.turno_b_data, p.turno_b_parte, p.turno_b_inicio, p.turno_b_fim) +
        '. Não há saldo de horas entre as partes.</p>';
    } else {
      corpo += '<p>Trata-se de permuta de mão única: a PARTE A ficará devendo <b>12 horas</b> à ' +
        'PARTE B, a serem compensadas por permuta futura ou acordo entre as partes.</p>';
    }
    var hoje = new Date().toLocaleDateString('pt-BR');
    $('termo').innerHTML =
      '<h2 style="text-align:center">TERMO DE PERMUTA DE PLANTÃO</h2>' +
      '<p style="text-align:center">Nº ' + p.numero + '</p>' +
      '<p><i>Texto provisório — substituir pelo modelo oficial.</i></p>' +
      '<p><b>PARTE A:</b> ' + (A.nome_completo || p.pessoa_a) + ' — Matrícula ' + (A.matricula || '—') +
        ' — Plantão ' + (A.plantao || '—') + '</p>' +
      '<p><b>PARTE B:</b> ' + (B.nome_completo || p.pessoa_b) + ' — Matrícula ' + (B.matricula || '—') +
        ' — Plantão ' + (B.plantao || '—') + '</p>' +
      corpo +
      (p.obs ? '<p><b>Observação:</b> ' + p.obs + '</p>' : '') +
      '<p>Estado atual no sistema: <b>' + (ESTADO_ROT[p.estado] || p.estado) + '</b>.</p>' +
      '<p style="margin-top:30px">Aprovação da chefia: ____________________________  Data: ____/____/______</p>' +
      '<p style="margin-top:40px;display:flex;justify-content:space-around;text-align:center">' +
        '<span>____________________<br>' + p.pessoa_a + '</span>' +
        '<span>____________________<br>' + p.pessoa_b + '</span></p>' +
      '<p style="text-align:right;margin-top:20px">Emitido em ' + hoje + '</p>';
    $('cardTermo').hidden = false;
    $('cardTermo').scrollIntoView({ behavior: 'smooth' });
  }

  document.addEventListener('dados-prontos', function () {
    $('pA').addEventListener('change', atualizarB);
    $('pB').addEventListener('change', function () { atualizarLabels(); preencherTurnos(); });
    $('maoDupla').addEventListener('change', toggleMaoDupla);
    $('form').addEventListener('submit', propor);
    $('btnQuita').addEventListener('click', function () { preencherQuita(); $('formQuita').hidden = false; });
    $('qCancel').addEventListener('click', function () { $('formQuita').hidden = true; });
    $('formQuita').addEventListener('submit', quitar);
    $('btnImprimir').addEventListener('click', function () { window.print(); });
    $('btnFecharTermo').addEventListener('click', function () { $('cardTermo').hidden = true; });
    render();
  });
})();
