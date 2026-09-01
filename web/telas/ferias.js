/* telas/ferias.js — férias: servidor solicita, líder aprova/rejeita/modifica.
   Licença médica: só o líder lança. Semáforo = apoio à decisão. */
(function () {
  'use strict';
  var S = window.Store, A = window.App;

  function gestor() { return S.podeGerirFerias(); }   // líder ou admin
  function eu() { return S.papelAtual(); }
  function fmtBR(iso) { var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
  function dias(a, b) { var x = new Date(a + 'T00:00'), y = new Date((b || a) + 'T00:00'); return Math.max(1, Math.round((y - x) / 864e5) + 1); }
  function equipeEscala() {
    return S.equipe().filter(function (f) {
      return f.regime === 'plantao' || f.regime === 'coringa' || f.regime === 'expediente';
    }).sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
  }
  var SIT = {
    solicitada: '<span class="tag a">aguardando líder</span>',
    aprovada: '<span class="tag v">aprovada</span>',
    rejeitada: '<span class="tag r">rejeitada</span>'
  };
  var NIV = { livre: '<span class="tag v">sem impacto</span>', impacto: '<span class="tag a">com impacto</span>', bloqueado: '<span class="tag r">cobertura crítica</span>' };

  function montar(corpo) {
    var editId = '', ultima = null;
    var G = gestor();

    var card = A.h('div', { class: 'card' });
    card.innerHTML =
      '<h3 id="f-tit">' + (G ? 'Lançar férias / licença' : 'Solicitar férias') + '</h3>' +
      '<div class="form">' +
        (G ? '<div class="campo"><label>Tipo</label><select id="f-tipo"><option value="ferias">Férias</option><option value="licenca_medica">Licença médica</option></select></div>'
           : '<input type="hidden" id="f-tipo" value="ferias">') +
        '<div class="campo"><label>Pessoa</label><select id="f-pessoa"></select></div>' +
        '<div class="campo"><label>Início</label><input type="date" id="f-ini"></div>' +
        '<div class="campo"><label>Fim</label><input type="date" id="f-fim"></div>' +
        (G ? '<div class="campo wide"><label>Quem cobre (coringa/expediente que entra no plantão)</label><select id="f-sub"><option value="">— a definir —</option></select></div>'
           : '<input type="hidden" id="f-sub" value="">') +
        '<div class="campo wide"><label>Observação</label><input type="text" id="f-obs"></div>' +
      '</div>' +
      '<div class="sem" id="f-sem" hidden></div>' +
      '<div class="card-acoes"><button class="pri" id="f-salvar">' + (G ? 'Lançar' : 'Solicitar') + '</button>' +
      '<button id="f-cancelar" hidden>Cancelar</button><span class="erro" id="f-erro"></span></div>';
    corpo.appendChild(card);

    var pendCard = A.h('div', { class: 'card' });
    corpo.appendChild(pendCard);
    var saldoCard = A.h('div', { class: 'card' });
    corpo.appendChild(saldoCard);
    var listaCard = A.h('div', { class: 'card' });
    corpo.appendChild(listaCard);

    var $ = function (s) { return card.querySelector(s); };
    function tipoAtual() { return $('#f-tipo').value; }

    function pessoas() {
      var sel = $('#f-pessoa'), p = eu();
      if (G) {
        sel.innerHTML = equipeEscala().map(function (f) {
          return '<option value="' + A.esc(f.nome_curto) + '">' + A.esc(f.nome_curto) + ' · ' + (f.plantao || f.regime) + '</option>';
        }).join('');
        sel.disabled = false;
      } else {
        sel.innerHTML = '<option value="' + A.esc(p.nome) + '">' + A.esc(p.nome) + '</option>';
        sel.disabled = true;
      }
      coberturas();
    }
    function coberturas() {
      var sel = $('#f-sub'); if (!sel || sel.tagName !== 'SELECT') return;
      var atual = sel.value, quem = $('#f-pessoa').value;
      var ativos = S.equipe().filter(function (f) { return f.status !== 'afastado' && f.nome_curto !== quem; });
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
      if (!pessoa || !ini) { box.hidden = true; ultima = null; return; }
      var sub = ($('#f-sub') && $('#f-sub').value) || '';
      var av = S.avaliarFerias(pessoa, ini, fim, editId || undefined, false, tipoAtual(), sub);
      ultima = av;
      var cor = { livre: 'verde', impacto: 'ama', bloqueado: 'verm' }[av.nivel];
      var tit = { livre: '🟢 Sem impacto na escala', impacto: '🟡 Atenção ao impacto', bloqueado: '🔴 Cobertura crítica' }[av.nivel];
      var h = '<div class="cab">' + tit + ' · ' + dias(ini, fim) + ' dia(s)</div>';
      if (av.mensagens.length) h += '<ul>' + av.mensagens.map(function (m) { return '<li>' + A.esc(m) + '</li>'; }).join('') + '</ul>';
      var s = av.saldo;
      h += '<div class="janela">Saldo ' + new Date(ini).getFullYear() + ': ' + s.consumido + ' + ' + s.novos + ' de ' + s.base +
        ' → <b>' + s.restante + ' restantes</b></div>';
      if (av.proximaJanela) h += '<div class="janela">Próxima 🟢: <b>' + fmtBR(av.proximaJanela.inicio) + ' a ' + fmtBR(av.proximaJanela.fim) +
        '</b> <button class="btn pequeno sec" id="f-usar">usar</button></div>';
      if (av.quebraCarga && av.quebraCarga.length && G) {
        var tot = av.quebraCarga.reduce(function (acc, q) { return acc + q.creditoFolga; }, 0);
        h += '<label class="quebra-assume"><input type="checkbox" id="f-assumir"> ' +
          '<b>Líder assume a quebra de descanso</b> e lança <b>' + tot + ' h</b> no banco de ' +
          A.esc(av.quebraCarga[0].coringa) + '.</label>';
      }
      box.className = 'sem ' + cor; box.innerHTML = h; box.hidden = false;
      var u = box.querySelector('#f-usar');
      if (u) u.addEventListener('click', function () { $('#f-ini').value = av.proximaJanela.inicio; $('#f-fim').value = av.proximaJanela.fim; semaforo(); });
    }

    function limpar() {
      editId = '';
      card.querySelectorAll('input').forEach(function (i) { if (i.type !== 'hidden') i.value = ''; });
      if ($('#f-sub') && $('#f-sub').tagName === 'SELECT') $('#f-sub').value = '';
      $('#f-tit').textContent = G ? 'Lançar férias / licença' : 'Solicitar férias';
      $('#f-salvar').textContent = G ? 'Lançar' : 'Solicitar';
      $('#f-cancelar').hidden = true; $('#f-erro').textContent = '';
      $('#f-sem').hidden = true; ultima = null; pessoas();
    }
    function editar(e) {
      editId = e.id;
      if ($('#f-tipo').tagName === 'SELECT') $('#f-tipo').value = e.tipo;
      if (G) $('#f-pessoa').value = e.pessoa;
      $('#f-ini').value = String(e.inicio).slice(0, 10); $('#f-fim').value = String(e.fim).slice(0, 10);
      coberturas(); if ($('#f-sub')) $('#f-sub').value = e.substituto || '';
      $('#f-obs').value = e.obs || '';
      $('#f-tit').textContent = 'Editando — ' + e.pessoa;
      $('#f-salvar').textContent = 'Salvar'; $('#f-cancelar').hidden = false;
      semaforo(); corpo.scrollTop = 0;
    }
    function salvar() {
      $('#f-erro').textContent = '';
      try {
        var assume = card.querySelector('#f-assumir');
        var temQuebra = ultima && ultima.quebraCarga && ultima.quebraCarga.length;
        var r = S.salvarEvento({
          id: editId || undefined, tipo: tipoAtual(), pessoa: $('#f-pessoa').value,
          substituto: ($('#f-sub') && $('#f-sub').value) || '', assumirQuebra: !!(assume && assume.checked),
          inicio: $('#f-ini').value, fim: $('#f-fim').value || $('#f-ini').value, obs: $('#f-obs').value
        });
        Promise.resolve(r).then(function () {
          limpar(); render();
          var msg = G ? 'Lançado' : 'Solicitação enviada ao líder';
          if (r && r.quebraAssumida) msg += ' · quebra lançada no banco';
          else if (temQuebra && G) msg += ' · quebra NÃO lançada (líder não assumiu)';
          A.toast(msg, temQuebra && G && !(r && r.quebraAssumida) ? 'erro' : 'sucesso');
        }).catch(function (e) { $('#f-erro').textContent = e.message || String(e); });
      } catch (e) { $('#f-erro').textContent = e.message; }
    }

    // ── solicitações pendentes (só gestor) ──────────────────────────────────
    function decidir(e, decisao) {
      var extra = {};
      if (decisao === 'rejeitar') {
        var m = prompt('Justificativa da rejeição (obrigatória):', '');
        if (m == null) return; extra.justificativa = m;
      } else if (decisao === 'modificar') {
        var ni = prompt('Novo início (AAAA-MM-DD):', String(e.inicio).slice(0, 10));
        if (ni == null) return;
        var nf = prompt('Novo fim (AAAA-MM-DD):', String(e.fim).slice(0, 10));
        if (nf == null) return;
        var mj = prompt('Justificativa da alteração (obrigatória):', '');
        if (mj == null) return;
        extra.inicio = ni.trim(); extra.fim = nf.trim(); extra.justificativa = mj;
      }
      Promise.resolve(S.decidirFerias(e.id, decisao, extra))
        .then(function () { render(); A.toast('Solicitação ' + (decisao === 'aprovar' ? 'aprovada' : decisao === 'rejeitar' ? 'rejeitada' : 'modificada'), 'sucesso'); })
        .catch(function (err) { A.toast(err.message || String(err), 'erro'); });
    }
    function renderPendentes() {
      if (!G) { pendCard.hidden = true; return; }
      pendCard.hidden = false;
      var lst = S.feriasPendentes();
      pendCard.innerHTML = '<h3>Solicitações pendentes (' + lst.length + ')</h3>';
      if (!lst.length) { pendCard.innerHTML += '<div class="muted small">Nenhuma.</div>'; return; }
      lst.forEach(function (e) {
        var av = S.avaliarFerias(e.pessoa, String(e.inicio).slice(0, 10), String(e.fim).slice(0, 10), e.id, true, 'ferias', e.substituto);
        var d = A.h('div', { class: 'card', style: 'margin-top:8px' });
        d.innerHTML = '<div class="card-top"><span class="card-titulo">' + A.esc(e.pessoa) + '</span>' + (NIV[av.nivel] || '') + '</div>' +
          '<div class="card-linha">' + fmtBR(e.inicio) + ' a ' + fmtBR(e.fim) + ' · ' +
          dias(String(e.inicio).slice(0, 10), String(e.fim).slice(0, 10)) + ' dia(s)</div>' +
          (e.obs ? '<div class="card-sub">“' + A.esc(e.obs) + '”</div>' : '') +
          (av.mensagens.length ? '<div class="card-sub">' + A.esc(av.mensagens.join(' · ')) + '</div>' : '') +
          '<div class="card-acoes"><button class="pri" data-ap>aprovar</button>' +
          '<button data-mo>modificar</button><button class="dng" data-re>rejeitar</button></div>';
        d.querySelector('[data-ap]').addEventListener('click', function () { decidir(e, 'aprovar'); });
        d.querySelector('[data-mo]').addEventListener('click', function () { decidir(e, 'modificar'); });
        d.querySelector('[data-re]').addEventListener('click', function () { decidir(e, 'rejeitar'); });
        pendCard.appendChild(d);
      });
    }

    function render() {
      renderPendentes();
      var anoRef = $('#f-ini').value ? new Date($('#f-ini').value).getFullYear() : new Date().getFullYear();
      var pes = equipeEscala();
      if (!G) pes = pes.filter(function (f) { return f.nome_curto === eu().nome; });
      saldoCard.innerHTML = '<h3>Saldo de férias (' + anoRef + ')</h3><div class="tab-wrap"><table class="mini">' +
        '<tr><th>Pessoa</th><th class="num">Direito</th><th class="num">Aprovado</th><th class="num">Restante</th></tr>' +
        pes.map(function (f) {
          var s = S.saldoFerias(f.nome_curto, anoRef);
          return '<tr><td>' + A.esc(f.nome_curto) + '</td><td class="num">' + s.base + '</td><td class="num">' + s.consumido +
            '</td><td class="num ' + (s.restante < 0 ? 'neg' : '') + '">' + s.restante + '</td></tr>';
        }).join('') + '</table></div>';

      var evs = S.eventos().filter(function (e) { return e.tipo === 'ferias' || e.tipo === 'licenca_medica'; });
      if (!G) evs = evs.filter(function (e) { return e.pessoa === eu().nome; });
      listaCard.innerHTML = '<h3>' + (G ? 'Períodos e solicitações (' + evs.length + ')' : 'Minhas férias e licenças (' + evs.length + ')') + '</h3>';
      if (!evs.length) { listaCard.innerHTML += '<div class="muted small">Nenhum.</div>'; return; }
      evs.forEach(function (e) {
        var meu = eu().nome === e.pessoa;
        var badge = e.tipo === 'ferias' ? (SIT[e.situacao] || SIT.aprovada) : '<span class="tag v">licença</span>';
        var podeExcluir = G || (meu && e.tipo === 'ferias' && e.situacao === 'solicitada');
        var podeEditar = G || (meu && e.tipo === 'ferias' && e.situacao === 'solicitada');
        var d = A.h('div', { class: 'card', style: 'margin-top:8px' });
        d.innerHTML = '<div class="card-top"><span class="card-titulo">' + A.esc(e.pessoa) + '</span>' + badge + '</div>' +
          '<div class="card-linha">' + (e.tipo === 'ferias' ? 'Férias' : 'Licença') + ' · ' + fmtBR(e.inicio) + ' a ' + fmtBR(e.fim) +
          ' · ' + dias(String(e.inicio).slice(0, 10), String(e.fim).slice(0, 10)) + ' dia(s)</div>' +
          (e.substituto ? '<div class="card-sub">Coberto por <b>' + A.esc(e.substituto) + '</b></div>'
            : (e.tipo === 'licenca_medica' || e.situacao === 'aprovada' ? '<div class="card-sub muted">Cobertura a definir</div>' : '')) +
          (e.justificativa ? '<div class="card-sub" style="color:var(--danger)"><b>Líder:</b> ' + A.esc(e.justificativa) + '</div>' : '') +
          (e.decidido_por ? '<div class="card-sub muted">decidido por ' + A.esc(e.decidido_por) + '</div>' : '');
        if (podeEditar || podeExcluir) {
          var bar = '<div class="card-acoes">';
          if (podeEditar) bar += '<button data-ed>editar</button>';
          if (podeExcluir) bar += '<button class="dng" data-rm>excluir</button>';
          d.innerHTML += bar + '</div>';
          if (podeEditar) d.querySelector('[data-ed]').addEventListener('click', function () { editar(e); });
          if (podeExcluir) d.querySelector('[data-rm]').addEventListener('click', function () {
            if (!confirm('Excluir o período de ' + e.pessoa + '?')) return;
            Promise.resolve(S.removerEvento(e.id)).then(render);
          });
        }
        listaCard.appendChild(d);
      });
    }

    ['#f-tipo', '#f-pessoa', '#f-ini', '#f-fim', '#f-sub'].forEach(function (s) {
      var el = $(s); if (!el) return;
      el.addEventListener('change', function () { if (s === '#f-pessoa') coberturas(); render(); semaforo(); });
    });
    $('#f-salvar').addEventListener('click', salvar);
    $('#f-cancelar').addEventListener('click', limpar);
    pessoas(); render();
  }

  A.registrarTela('ferias', { titulo: 'FÉRIAS', icone: '🏖', desc: 'Solicitar férias · o líder aprova', acesso: 'todos', montar: montar, contador: function () {
    try { return S.podeGerirFerias() ? (S.feriasPendentes().length || null) : null; } catch (e) { return null; }
  } });
})();
