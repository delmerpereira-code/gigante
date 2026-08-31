/* ============================================================================
 *  banco.js — Visão do banco de horas: saldos, movimentos e ajuste manual.
 * ==========================================================================*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  function pessoas() {
    var p = Store.papelAtual();
    var lista = Store.funcionarios();
    if (p.tipo === 'funcionario') lista = lista.filter(function (f) { return f.nome_curto === p.nome; });
    return lista.map(function (f) { return f.nome_curto; }).sort(function (a, b) { return a.localeCompare(b); });
  }

  function preencherSelects() {
    var ops = pessoas().map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
    var mAtual = $('mPessoa').value;
    $('mPessoa').innerHTML = ops;
    if (mAtual && pessoas().indexOf(mAtual) >= 0) $('mPessoa').value = mAtual;
    var gerente = Store.ehLider();
    var atual = $('filtroPessoa').value;
    $('filtroPessoa').innerHTML = (gerente ? '<option value="">todas</option>' : '') + ops;
    $('filtroPessoa').value = gerente ? atual : (pessoas()[0] || '');
    $('filtroPessoa').disabled = !gerente;
  }

  function fmt(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function lancar(e) {
    e.preventDefault();
    $('formErro').textContent = '';
    try {
      Store.ajusteManual(
        $('mPessoa').value,
        $('mSentido').value,
        parseFloat($('mHoras').value),
        $('mObs').value,
        $('mQuando').value || undefined
      );
      $('mHoras').value = '';
      $('mObs').value = '';
      render();
    } catch (err) {
      $('formErro').textContent = err.message;
    }
  }

  function render() {
    preencherSelects();
    var saldos = Store.saldos();
    var vis = pessoas();

    // saldos por pessoa (na ordem de cadastro)
    $('saldos').innerHTML = Store.funcionarios()
      .filter(function (f) { return vis.indexOf(f.nome_curto) >= 0; })
      .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); })
      .map(function (f) {
        var s = (f.nome_curto in saldos) ? saldos[f.nome_curto] : (Number(f.saldo_inicial_banco) || 0);
        return '<span class="chip' + (s < 0 ? ' incompleto' : '') + '"><b>' + f.nome_curto + '</b> ' + s + ' h</span>';
      }).join('') || '<span class="muted">Nenhum funcionário cadastrado.</span>';

    var filtro = $('filtroPessoa').value;
    var linhas = Store.bancoHorasVisivel().filter(function (l) { return !filtro || l.pessoa === filtro; });
    $('qtd').textContent = linhas.length;

    var tb = $('tbody');
    tb.innerHTML = '';
    // mostra mais recente primeiro
    linhas.slice().reverse().forEach(function (l) {
      var tr = document.createElement('tr');
      var manual = l.motivo === 'ajuste_manual';
      tr.innerHTML =
        '<td>' + fmt(l.data_hora) + '</td>' +
        '<td>' + l.pessoa + '</td>' +
        '<td>' + l.motivo.replace('obs:', '').replace(/_/g, ' ') + '</td>' +
        '<td class="num">' + (l.sentido === 'entrada' ? '+' + l.horas : '') + '</td>' +
        '<td class="num">' + (l.sentido === 'saida' ? '−' + l.horas : '') + '</td>' +
        '<td class="num ' + (l.saldo_resultante < 0 ? 'neg' : '') + '">' + l.saldo_resultante + '</td>' +
        '<td class="acoes">' + (manual
          ? '<button class="mini danger" data-rm>excluir</button>'
          : '<span class="muted mini">via evento</span>') + '</td>';
      if (manual) {
        tr.querySelector('[data-rm]').addEventListener('click', function () {
          if (confirm('Excluir este lançamento manual?')) { Store.removerLancamento(l.seq); render(); }
        });
      }
      tb.appendChild(tr);
    });
  }

  document.addEventListener('dados-prontos', function () {
    $('form').addEventListener('submit', lancar);
    $('filtroPessoa').addEventListener('change', render);
    render();
  });
})();
