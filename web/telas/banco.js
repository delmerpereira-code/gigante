/* telas/banco.js — livro-caixa do banco de horas + saldo + ajuste manual */
(function () {
  'use strict';
  var S = window.Store, A = window.App;

  function lider() { return S.ehLider(); }
  function eu() { return S.papelAtual(); }
  function fmt(iso) { var d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function pessoasVis() {
    var me = eu();
    var l = S.equipe().filter(function (f) { return f.regime === 'plantao' || f.regime === 'coringa'; });
    if (me.tipo === 'funcionario') l = l.filter(function (f) { return f.nome_curto === me.nome; });
    return l.map(function (f) { return f.nome_curto; }).sort();
  }

  function montar(corpo) {
    A.acaoHeader('Ajuste', ajusteModal);
    var saldoCard = A.h('div', { class: 'card' });
    corpo.appendChild(saldoCard);
    var filtroTb = A.h('div', { class: 'tb' });
    corpo.appendChild(filtroTb);
    var movCard = A.h('div', { class: 'card', style: 'margin-top:12px' });
    corpo.appendChild(movCard);

    var filtro = '';
    function render() {
      var saldos = S.saldos(), vis = pessoasVis();
      saldoCard.innerHTML = '<h3>Saldo por pessoa</h3><div class="chips">' +
        S.funcionarios().filter(function (f) { return vis.indexOf(f.nome_curto) >= 0; })
          .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); })
          .map(function (f) {
            var s = (f.nome_curto in saldos) ? saldos[f.nome_curto] : (Number(f.saldo_inicial_banco) || 0);
            return '<span class="chip' + (s < 0 ? ' neg' : '') + '"><b>' + A.esc(f.nome_curto) + '</b> ' + s + ' h</span>';
          }).join('') + '</div>';

      filtroTb.innerHTML = '';
      if (lider()) {
        var sel = A.h('select', { class: 'in' });
        sel.innerHTML = '<option value="">todas</option>' + vis.map(function (n) { return '<option value="' + A.esc(n) + '">' + A.esc(n) + '</option>'; }).join('');
        sel.value = filtro;
        sel.addEventListener('change', function () { filtro = sel.value; render(); });
        filtroTb.appendChild(A.h('span', { class: 'campo-label', text: 'Pessoa', style: 'margin:0' }));
        filtroTb.appendChild(sel);
      } else filtroTb.style.display = 'none';

      var linhas = S.bancoHorasVisivel().filter(function (l) { return !filtro || l.pessoa === filtro; });
      movCard.innerHTML = '<h3>Movimentos (' + linhas.length + ')</h3>';
      if (!linhas.length) { movCard.innerHTML += '<div class="muted small">Nenhum.</div>'; return; }
      movCard.innerHTML += '<div class="tab-wrap"><table class="mini"><tr><th>Data</th><th>Pessoa</th><th>Motivo</th><th class="num">Entr.</th><th class="num">Saída</th><th class="num">Saldo</th><th></th></tr>' +
        linhas.slice().reverse().map(function (l) {
          var manual = l.motivo === 'ajuste_manual';
          return '<tr><td>' + fmt(l.data_hora) + '</td><td>' + A.esc(l.pessoa) + '</td><td>' + l.motivo.replace('obs:', '').replace(/_/g, ' ') + '</td>' +
            '<td class="num">' + (l.sentido === 'entrada' ? '+' + l.horas : '') + '</td><td class="num">' + (l.sentido === 'saida' ? '−' + l.horas : '') + '</td>' +
            '<td class="num ' + (l.saldo_resultante < 0 ? 'neg' : '') + '">' + l.saldo_resultante + '</td>' +
            '<td>' + (manual ? '<button class="btn pequeno danger" data-rm="' + l.seq + '">x</button>' : '') + '</td></tr>';
        }).join('') + '</table></div>';
      movCard.querySelectorAll('[data-rm]').forEach(function (b) {
        b.addEventListener('click', function () { if (confirm('Excluir este lançamento manual?')) Promise.resolve(S.removerLancamento(+b.getAttribute('data-rm'))).then(render); });
      });
    }

    function ajusteModal() {
      var o = pessoasVis().map(function (n) { return '<option value="' + A.esc(n) + '">' + A.esc(n) + '</option>'; }).join('');
      var m = A.abrirModal('<h2>Lançamento manual</h2><div class="form">' +
        '<div class="campo"><label>Pessoa</label><select id="aj-p">' + o + '</select></div>' +
        '<div class="campo"><label>Sentido</label><select id="aj-s"><option value="entrada">Entrada (+)</option><option value="saida">Saída (−)</option></select></div>' +
        '<div class="campo"><label>Horas</label><input type="number" id="aj-h" step="0.5" min="0"></div>' +
        '<div class="campo"><label>Data/hora</label><input type="datetime-local" id="aj-q"></div>' +
        '<div class="campo wide"><label>Observação</label><input type="text" id="aj-o"></div></div>' +
        '<div class="erro" id="aj-erro"></div>' +
        '<div class="modal-acoes"><button class="btn sec" id="aj-x">Fechar</button><button class="btn" id="aj-ok">Lançar</button></div>');
      m.querySelector('#aj-x').addEventListener('click', A.fecharModal);
      m.querySelector('#aj-ok').addEventListener('click', function () {
        try {
          Promise.resolve(S.ajusteManual(m.querySelector('#aj-p').value, m.querySelector('#aj-s').value, parseFloat(m.querySelector('#aj-h').value), m.querySelector('#aj-o').value, m.querySelector('#aj-q').value || undefined))
            .then(function () { A.fecharModal(); render(); A.toast('Lançado', 'sucesso'); })
            .catch(function (e) { m.querySelector('#aj-erro').textContent = e.message || String(e); });
        } catch (e) { m.querySelector('#aj-erro').textContent = e.message; }
      });
    }
    render();
  }

  A.registrarTela('banco', { titulo: 'BANCO DE HORAS', icone: '🏦', desc: 'Livro-caixa e saldo', acesso: 'todos', montar: montar });
})();
