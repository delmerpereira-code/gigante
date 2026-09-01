/* telas/ferias.js — comunicação de férias com semáforo de disponibilidade */
(function () {
  'use strict';
  var S = window.Store, A = window.App;

  function souLider() { return S.ehLider(); }
  function eu() { return S.papelAtual(); }
  function fmtBR(iso) { var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
  function dias(a, b) { var x = new Date(a + 'T00:00'), y = new Date((b || a) + 'T00:00'); return Math.max(1, Math.round((y - x) / 864e5) + 1); }
  function plantonistas() {
    return S.funcionarios().filter(function (f) {
      return f.regime === 'plantao' || f.regime === 'coringa' || f.regime === 'expediente';
    }).sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
  }

  function montar(corpo) {
    var editId = '';
    // ── form ──
    var card = A.h('div', { class: 'card' });
    card.innerHTML =
      '<h3 id="f-tit">Comunicar férias</h3>' +
      '<div class="form">' +
        '<div class="campo"><label>Tipo</label><select id="f-tipo"><option value="ferias">Férias</option><option value="licenca_medica">Licença médica</option></select></div>' +
        '<div class="campo"><label>Pessoa</label><select id="f-pessoa"></select></div>' +
        '<div class="campo"><label>Início</label><input type="date" id="f-ini"></div>' +
        '<div class="campo"><label>Fim</label><input type="date" id="f-fim"></div>' +
        '<div class="campo wide"><label>Quem cobre (coringa que entra no plantão)</label><select id="f-sub"><option value="">— a definir —</option></select></div>' +
        '<div class="campo wide"><label>Observação</label><input type="text" id="f-obs"></div>' +
      '</div>' +
      '<div class="sem" id="f-sem" hidden></div>' +
      '<div class="card-acoes"><button class="pri" id="f-salvar">Comunicar</button>' +
      '<button id="f-cancelar" hidden>Cancelar</button><span class="erro" id="f-erro"></span></div>';
    corpo.appendChild(card);

    var saldoCard = A.h('div', { class: 'card' });
    corpo.appendChild(saldoCard);
    var listaCard = A.h('div', { class: 'card' });
    corpo.appendChild(listaCard);

    var $ = function (s) { return card.querySelector(s); };
    var ultima = null;

    function pessoas() {
      var sel = $('#f-pessoa'), p = eu();
      if (souLider()) {
        sel.innerHTML = plantonistas().map(function (f) {
          return '<option value="' + A.esc(f.nome_curto) + '">' + A.esc(f.nome_curto) + ' · ' + (f.plantao || 'coringa') + '</option>';
        }).join('');
        sel.disabled = false;
      } else {
        sel.innerHTML = '<option value="' + A.esc(p.nome) + '">' + A.esc(p.nome) + '</option>';
        sel.disabled = true;
      }
      coberturas();
    }
    function coberturas() {
      var sel = $('#f-sub'), atual = sel.value, quem = $('#f-pessoa').value;
      var ativos = S.funcionarios().filter(function (f) { return f.status !== 'afastado' && f.nome_curto !== quem; });
      // coringas e expediente primeiro (cobrem ausências), depois os titulares
      var cor = ativos.filter(function (f) { return f.regime === 'coringa'; });
      var exp = ativos.filter(function (f) { return f.regime === 'expediente'; });
      var pla = ativos.filter(function (f) { return f.regime === 'plantao'; });
      var opt = function (f, tag) { return '<option value="' + A.esc(f.nome_curto) + '">' + A.esc(f.nome_curto) + ' · ' + tag + '</option>'; };
      sel.innerHTML = '<option value="">— a definir —</option>' +
        cor.map(function (f) { return opt(f, 'coringa'); }).join('') +
        exp.map(function (f) { return opt(f, 'expediente'); }).join('') +
        pla.map(function (f) { return opt(f, f.plantao); }).join('');
      if (atual && sel.querySelector('option[value="' + atual.replace(/"/g, '\\"') + '"]')) sel.value = atual;
    }

    function semaforo() {
      var box = $('#f-sem'), pessoa = $('#f-pessoa').value, ini = $('#f-ini').value, fim = $('#f-fim').value || ini;
      if (!pessoa || !ini) { box.hidden = true; ultima = null; botao(); return; }
      var av = S.avaliarFerias(pessoa, ini, fim, editId || undefined, false, $('#f-tipo').value, $('#f-sub').value);
      ultima = av;
      var cor = { livre: 'verde', impacto: 'ama', bloqueado: 'verm' }[av.nivel];
      var tit = { livre: '🟢 Sem impacto na escala', impacto: '🟡 Comunicado — atenção ao impacto', bloqueado: '🔴 Comunicado — cobertura crítica' }[av.nivel];
      var h = '<div class="cab">' + tit + ' · ' + dias(ini, fim) + ' dia(s)</div>';
      if (av.mensagens.length) h += '<ul>' + av.mensagens.map(function (m) { return '<li>' + A.esc(m) + '</li>'; }).join('') + '</ul>';
      var s = av.saldo;
      h += '<div class="janela">Saldo ' + new Date(ini).getFullYear() + ': ' + s.consumido + ' + ' + s.novos + ' de ' + s.base +
        ' → <b>' + s.restante + ' restantes</b></div>';
      if (av.proximaJanela) h += '<div class="janela">Próxima 🟢: <b>' + fmtBR(av.proximaJanela.inicio) + ' a ' + fmtBR(av.proximaJanela.fim) +
        '</b> <button class="btn pequeno sec" id="f-usar">usar</button></div>';
      if (av.quebraCarga && av.quebraCarga.length && souLider()) {
        var tot = av.quebraCarga.reduce(function (acc, q) { return acc + q.creditoFolga; }, 0);
        h += '<label class="quebra-assume"><input type="checkbox" id="f-assumir"> ' +
          '<b>Líder assume a quebra de descanso</b> e lança <b>' + tot + ' h</b> no banco de horas de ' +
          A.esc(av.quebraCarga[0].coringa) + '.</label>';
      }
      box.className = 'sem ' + cor; box.innerHTML = h; box.hidden = false;
      var u = box.querySelector('#f-usar');
      if (u) u.addEventListener('click', function () { $('#f-ini').value = av.proximaJanela.inicio; $('#f-fim').value = av.proximaJanela.fim; semaforo(); });
      botao();
    }
    function botao() {
      // Férias é comunicação, não aprovação: o botão nunca trava.
      $('#f-salvar').disabled = false;
      $('#f-salvar').textContent = editId ? 'Salvar' : 'Comunicar';
    }
    function limpar() {
      editId = ''; card.querySelectorAll('input').forEach(function (i) { i.value = ''; });
      $('#f-sub').value = '';
      $('#f-tit').textContent = 'Comunicar férias'; $('#f-cancelar').hidden = true; $('#f-erro').textContent = '';
      $('#f-sem').hidden = true; ultima = null; pessoas(); botao();
    }
    function editar(e) {
      editId = e.id; $('#f-tipo').value = e.tipo;
      if (souLider()) $('#f-pessoa').value = e.pessoa;
      $('#f-ini').value = String(e.inicio).slice(0, 10); $('#f-fim').value = String(e.fim).slice(0, 10);
      coberturas(); $('#f-sub').value = e.substituto || '';
      $('#f-obs').value = e.obs || '';
      $('#f-tit').textContent = 'Editando — ' + e.pessoa; $('#f-cancelar').hidden = false;
      semaforo(); corpo.scrollTop = 0;
    }
    function salvar() {
      $('#f-erro').textContent = '';
      try {
        var assume = card.querySelector('#f-assumir');
        var temQuebra = ultima && ultima.quebraCarga && ultima.quebraCarga.length;
        var r = S.salvarEvento({
          id: editId || undefined, tipo: $('#f-tipo').value, pessoa: $('#f-pessoa').value,
          substituto: $('#f-sub').value, assumirQuebra: !!(assume && assume.checked),
          inicio: $('#f-ini').value, fim: $('#f-fim').value || $('#f-ini').value, obs: $('#f-obs').value
        });
        Promise.resolve(r).then(function () {
          limpar(); render();
          var msg = 'Comunicado registrado';
          if (r && r.quebraAssumida) msg += ' · quebra lançada no banco';
          else if (temQuebra) msg += ' · quebra de descanso NÃO lançada (líder não assumiu)';
          else if (r && r.nivel === 'impacto') msg += ' (com impacto)';
          A.toast(msg, r && temQuebra && !r.quebraAssumida ? 'erro' : 'sucesso');
        }).catch(function (e) { $('#f-erro').textContent = e.message || String(e); });
      } catch (e) { $('#f-erro').textContent = e.message; }
    }

    function render() {
      var anoRef = $('#f-ini').value ? new Date($('#f-ini').value).getFullYear() : new Date().getFullYear();
      var pes = plantonistas();
      if (!souLider()) pes = pes.filter(function (f) { return f.nome_curto === eu().nome; });
      saldoCard.innerHTML = '<h3>Saldo de férias (' + anoRef + ')</h3><div class="tab-wrap"><table class="mini">' +
        '<tr><th>Pessoa</th><th class="num">Direito</th><th class="num">Marcado</th><th class="num">Restante</th></tr>' +
        pes.map(function (f) {
          var s = S.saldoFerias(f.nome_curto, anoRef);
          return '<tr><td>' + A.esc(f.nome_curto) + '</td><td class="num">' + s.base + '</td><td class="num">' + s.consumido +
            '</td><td class="num ' + (s.restante < 0 ? 'neg' : '') + '">' + s.restante + '</td></tr>';
        }).join('') + '</table></div>';

      var evs = S.eventos().filter(function (e) { return e.tipo === 'ferias' || e.tipo === 'licenca_medica'; });
      var NIV = { livre: '<span class="tag v">sem impacto</span>', impacto: '<span class="tag a">com impacto</span>', bloqueado: '<span class="tag r">cobertura crítica</span>' };
      listaCard.innerHTML = '<h3>Períodos marcados (' + evs.length + ')</h3>';
      if (!evs.length) { listaCard.innerHTML += '<div class="muted small">Nenhum.</div>'; return; }
      evs.forEach(function (e) {
        var podeMexer = souLider() || eu().nome === e.pessoa;
        var d = A.h('div', { class: 'card', style: 'margin-top:8px' });
        d.innerHTML = '<div class="card-top"><span class="card-titulo">' + A.esc(e.pessoa) + '</span>' + (NIV[e.nivel] || '') + '</div>' +
          '<div class="card-linha">' + (e.tipo === 'ferias' ? 'Férias' : 'Licença') + ' · ' + fmtBR(e.inicio) + ' a ' + fmtBR(e.fim) +
          ' · ' + dias(String(e.inicio).slice(0, 10), String(e.fim).slice(0, 10)) + ' dia(s)</div>' +
          (e.substituto ? '<div class="card-sub">Coberto por <b>' + A.esc(e.substituto) + '</b></div>' : '<div class="card-sub muted">Cobertura a definir</div>');
        if (podeMexer) {
          d.innerHTML += '<div class="card-acoes"><button data-ed>editar</button><button class="dng" data-rm>excluir</button></div>';
          d.querySelector('[data-ed]').addEventListener('click', function () { editar(e); });
          d.querySelector('[data-rm]').addEventListener('click', function () {
            if (!confirm('Excluir o período de ' + e.pessoa + '?')) return;
            Promise.resolve(S.removerEvento(e.id)).then(render);
          });
        }
        listaCard.appendChild(d);
      });
    }

    ['#f-tipo', '#f-pessoa', '#f-ini', '#f-fim', '#f-sub'].forEach(function (s) {
      $(s).addEventListener('change', function () { if (s === '#f-pessoa') coberturas(); render(); semaforo(); });
    });
    $('#f-salvar').addEventListener('click', salvar);
    $('#f-cancelar').addEventListener('click', limpar);
    pessoas(); render(); botao();
  }

  A.registrarTela('ferias', { titulo: 'FÉRIAS', icone: '🏖', desc: 'Comunicar com semáforo de disponibilidade', acesso: 'todos', montar: montar });
})();
