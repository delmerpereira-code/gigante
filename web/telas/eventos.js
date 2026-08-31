/* telas/eventos.js — folga abatendo banco, convocação, sobreaviso */
(function () {
  'use strict';
  var S = window.Store, A = window.App;
  var ROT = { folga_abatendo_banco: 'Folga abatendo banco', convocacao: 'Convocação', sobreaviso_escalado: 'Sobreaviso escalado', sobreaviso_acionado: 'Sobreaviso acionado' };

  function lider() { return S.ehLider(); }
  function eu() { return S.papelAtual(); }
  function fmt(iso) { var d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function pessoas() {
    return S.funcionarios().filter(function (f) { return f.regime === 'plantao' || f.regime === 'coringa'; })
      .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
  }

  function montar(corpo) {
    var editId = '';
    var card = A.h('div', { class: 'card' });
    card.innerHTML = '<h3 id="e-tit">Novo evento</h3><div class="form">' +
      '<div class="campo"><label>Tipo</label><select id="e-tipo">' +
        '<option value="folga_abatendo_banco">Folga abatendo banco</option>' +
        '<option value="convocacao">Convocação (quebra de proteção)</option>' +
        '<option value="sobreaviso_escalado">Sobreaviso — escalado</option>' +
        '<option value="sobreaviso_acionado">Sobreaviso — acionado</option></select></div>' +
      '<div class="campo"><label>Pessoa</label><select id="e-pessoa"></select></div>' +
      '<div class="campo"><label>Início</label><input type="datetime-local" id="e-ini"></div>' +
      '<div class="campo"><label>Fim</label><input type="datetime-local" id="e-fim"></div>' +
      '<div class="campo wide"><label>Observação</label><input type="text" id="e-obs"></div></div>' +
      '<div class="sem" id="e-previa" hidden></div>' +
      '<div class="card-acoes"><button class="pri" id="e-salvar">Salvar</button><button id="e-cancelar" hidden>Cancelar</button><span class="erro" id="e-erro"></span></div>';
    corpo.appendChild(card);
    var listaCard = A.h('div', { class: 'card' });
    corpo.appendChild(listaCard);
    var $ = function (s) { return card.querySelector(s); };

    function preenchePessoas() {
      var me = eu();
      var lst = pessoas().filter(function (f) { return lider() || f.nome_curto === me.nome; });
      $('#e-pessoa').innerHTML = lst.map(function (f) { return '<option value="' + A.esc(f.nome_curto) + '">' + A.esc(f.nome_curto) + (f.plantao ? ' (' + f.plantao + ')' : ' (coringa)') + '</option>'; }).join('');
      $('#e-pessoa').disabled = !lider();
    }
    function horas(i, f) { if (!i || !f) return 0; return Math.max(0, (new Date(f) - new Date(i)) / 36e5); }
    function previa() {
      var box = $('#e-previa'), tipo = $('#e-tipo').value, pessoa = $('#e-pessoa').value, i = $('#e-ini').value, f = $('#e-fim').value || i;
      if (!pessoa || !i) { box.hidden = true; return; }
      var h = horas(i, f), cfg = S.rotacaoConfig(), fn = S.funcionarioPorNome(pessoa), txt = '', cls = 'verde';
      if (tipo === 'convocacao' && fn && fn.plantao) {
        var imp = window.Rotacao.avaliarConvocacao(fn.plantao, new Date(i), h, cfg);
        cls = imp.irregular ? 'verm' : 'verde';
        txt = '<div class="cab">' + A.esc(imp.mensagem) + '</div>' +
          (imp.irregular ? 'Folga perdida ' + imp.horasFolgaPerdidas + ' h + trabalho ' + imp.creditoTrabalho + ' h → ' : 'Crédito ') +
          '<b>' + imp.total + ' h</b> ao banco';
      } else if (tipo === 'sobreaviso_acionado') txt = 'Crédito de ' + (Math.round(h * cfg.fatorConvocacao * 100) / 100) + ' h no banco.';
      else if (tipo === 'folga_abatendo_banco') txt = 'Débito de ' + (Math.round(h * 100) / 100) + ' h no banco.';
      else txt = 'Apenas registro.';
      box.className = 'sem ' + cls; box.innerHTML = txt; box.hidden = false;
    }
    function limpar() { editId = ''; card.querySelectorAll('input').forEach(function (x) { x.value = ''; }); $('#e-tit').textContent = 'Novo evento'; $('#e-cancelar').hidden = true; $('#e-erro').textContent = ''; $('#e-previa').hidden = true; preenchePessoas(); }
    function editar(e) { editId = e.id; $('#e-tipo').value = e.tipo; preenchePessoas(); $('#e-pessoa').value = e.pessoa; $('#e-ini').value = (e.inicio || '').slice(0, 16); $('#e-fim').value = (e.fim || '').slice(0, 16); $('#e-obs').value = e.obs || ''; $('#e-tit').textContent = 'Editando'; $('#e-cancelar').hidden = false; previa(); corpo.scrollTop = 0; }
    function salvar() {
      $('#e-erro').textContent = '';
      try {
        var r = S.salvarEvento({ id: editId || undefined, tipo: $('#e-tipo').value, pessoa: $('#e-pessoa').value, inicio: $('#e-ini').value, fim: $('#e-fim').value, obs: $('#e-obs').value });
        Promise.resolve(r).then(function () { limpar(); render(); A.toast(r && r.irregular ? 'Salvo — QUEBRA registrada' : 'Evento salvo', 'sucesso'); })
          .catch(function (e) { $('#e-erro').textContent = e.message || String(e); });
      } catch (e) { $('#e-erro').textContent = e.message; }
    }
    function render() {
      var evs = S.eventosVisiveis().filter(function (e) { return e.tipo !== 'ferias' && e.tipo !== 'licenca_medica'; });
      listaCard.innerHTML = '<h3>Eventos (' + evs.length + ')</h3>';
      if (!evs.length) { listaCard.innerHTML += '<div class="muted small">Nenhum.</div>'; return; }
      evs.forEach(function (e) {
        var lanc = S.bancoHoras().filter(function (l) { return l.evento_id === e.id; });
        var d = A.h('div', { class: 'card', style: 'margin-top:8px' });
        d.innerHTML = '<div class="card-top"><span class="card-titulo">' + (ROT[e.tipo] || e.tipo) + '</span>' + (e.irregular === 'sim' ? '<span class="tag r">quebra</span>' : '') + '</div>' +
          '<div class="card-linha">' + A.esc(e.pessoa) + ' · ' + fmt(e.inicio) + ' → ' + fmt(e.fim) + '</div>' +
          (lanc.length ? '<div class="card-sub">' + lanc.map(function (l) { return (l.sentido === 'saida' ? '−' : '+') + l.horas + ' h (' + l.motivo + ')'; }).join(', ') + '</div>' : '') +
          '<div class="card-acoes"><button data-ed>editar</button><button class="dng" data-rm>excluir</button></div>';
        d.querySelector('[data-ed]').addEventListener('click', function () { editar(e); });
        d.querySelector('[data-rm]').addEventListener('click', function () { if (confirm('Excluir? Lançamentos gerados serão desfeitos.')) Promise.resolve(S.removerEvento(e.id)).then(render); });
        listaCard.appendChild(d);
      });
    }
    ['#e-tipo', '#e-pessoa', '#e-ini', '#e-fim'].forEach(function (s) { $(s).addEventListener('change', previa); });
    $('#e-salvar').addEventListener('click', salvar);
    $('#e-cancelar').addEventListener('click', limpar);
    preenchePessoas(); render();
  }

  A.registrarTela('eventos', { titulo: 'EVENTOS', icone: '⚡', desc: 'Folga, convocação, sobreaviso', acesso: 'todos', montar: montar });
})();
