/* telas/coringas.js — turnos avulsos de coringa/expediente + linha do tempo
   com aviso de quebra do descanso de 120h. "Rastrear a bagunça." */
(function () {
  'use strict';
  var S = window.Store, A = window.App;

  function fmtDT(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function coringas() {
    return S.equipe().filter(function (f) { return f.regime === 'coringa' || f.regime === 'expediente'; })
      .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
  }
  var CLS = { 'PL I': 'pl1', 'PL II': 'pl2', 'PL III': 'pl3', 'PL IV': 'pl4', 'PL V': 'pl5' };

  function montar(corpo) {
    if (!S.ehLider()) { corpo.innerHTML = '<div class="vazio"><div class="ic">🔒</div><div class="txt">Tela da gestão.</div></div>'; return; }
    var editId = '', previa = null;
    var ord = S.rotacaoConfig().ordem;

    var card = A.h('div', { class: 'card' });
    card.innerHTML =
      '<h3 id="c-tit">Novo turno de coringa</h3><div class="form">' +
      '<div class="campo"><label>Coringa / expediente</label><select id="c-pes"></select></div>' +
      '<div class="campo"><label>Plantão que vai cobrir</label><select id="c-pl">' +
        ord.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Data</label><input type="date" id="c-data"></div>' +
      '<div class="campo"><label>Turno</label><select id="c-parte"><option value="diurno">Diurno · 08–20</option><option value="noturno">Noturno · 20–08</option></select></div>' +
      '<div class="campo wide"><label>No lugar de / observação</label><input type="text" id="c-obs"></div>' +
      '</div>' +
      '<div class="sem" id="c-sem" hidden></div>' +
      '<div class="card-acoes"><button class="pri" id="c-salvar">Adicionar</button>' +
      '<button id="c-cancelar" hidden>Cancelar</button><span class="erro" id="c-erro"></span></div>';
    corpo.appendChild(card);
    var listaCard = A.h('div', { class: 'card' });
    corpo.appendChild(listaCard);
    var $ = function (s) { return card.querySelector(s); };

    function pessoas() {
      $('#c-pes').innerHTML = coringas().map(function (f) {
        return '<option value="' + A.esc(f.nome_curto) + '">' + A.esc(f.nome_curto) + ' · ' + f.regime + '</option>';
      }).join('') || '<option value="">(nenhuma coringa cadastrada)</option>';
    }
    function turnoDados() {
      var t = S.turnoIso($('#c-data').value, $('#c-parte').value);
      return {
        id: editId || undefined, tipo: 'turno_coringa', pessoa: $('#c-pes').value,
        plantao: $('#c-pl').value, inicio: t.inicio, fim: t.fim, obs: $('#c-obs').value
      };
    }
    function verPrevia() {
      var box = $('#c-sem');
      if (!$('#c-pes').value || !$('#c-data').value) { box.hidden = true; previa = null; return; }
      var reg = turnoDados(); reg.id = editId || '__tmp__';
      var q = null;
      try {
        var linha = S.linhaDoCoringa(reg.pessoa, reg);
        linha.forEach(function (x) { if (x.quebra && x.quebra.turnoSeguinte === reg.id) q = x.quebra; });
      } catch (e) {}
      previa = q;
      if (!q) { box.className = 'sem verde'; box.innerHTML = '<div class="cab">🟢 Dentro do descanso</div>'; box.hidden = false; return; }
      box.className = 'sem verm';
      box.innerHTML = '<div class="cab">🔴 Fura o descanso de 120h</div>' +
        '<ul><li>' + A.esc(reg.pessoa) + ' faz ' + A.esc(q.plantaoAnterior || '?') + ' e a proteção iria até <b>' +
        fmtDT(q.protegidoAte) + '</b>, mas este turno começa em <b>' + fmtDT(reg.inicio) + '</b>.</li>' +
        '<li><b>' + q.horasPerdidas + ' h</b> de descanso a menos.</li></ul>' +
        '<label class="quebra-assume"><input type="checkbox" id="c-assumir"> Assumir a quebra e lançar <b>' +
        q.creditoFolga + ' h</b> no banco de ' + A.esc(reg.pessoa) + '.</label>';
      box.hidden = false;
    }
    function limpar() {
      editId = ''; card.querySelectorAll('input').forEach(function (i) { i.value = ''; });
      $('#c-tit').textContent = 'Novo turno de coringa'; $('#c-salvar').textContent = 'Adicionar';
      $('#c-cancelar').hidden = true; $('#c-erro').textContent = ''; $('#c-sem').hidden = true; previa = null;
    }
    function editar(t) {
      editId = t.id; $('#c-pes').value = t.pessoa; $('#c-pl').value = t.plantao || ord[0];
      $('#c-data').value = String(t.inicio).slice(0, 10);
      $('#c-parte').value = new Date(t.inicio).getHours() < 12 ? 'diurno' : 'noturno';
      $('#c-obs').value = t.obs || '';
      $('#c-tit').textContent = 'Editando turno'; $('#c-salvar').textContent = 'Salvar';
      $('#c-cancelar').hidden = false; verPrevia(); corpo.scrollTop = 0;
    }
    function salvar() {
      $('#c-erro').textContent = '';
      try {
        var assume = card.querySelector('#c-assumir');
        var d = turnoDados(); d.assumirQuebra = !!(assume && assume.checked);
        var r = S.salvarEvento(d);
        Promise.resolve(r).then(function () {
          limpar(); render();
          var msg = 'Turno adicionado';
          if (r && r.quebraTurnoAssumida) msg += ' · quebra lançada no banco';
          else if (r && r.quebraTurno) msg += ' · quebra NÃO lançada';
          A.toast(msg, r && r.quebraTurno && !r.quebraTurnoAssumida ? 'erro' : 'sucesso');
        }).catch(function (e) { $('#c-erro').textContent = e.message || String(e); });
      } catch (e) { $('#c-erro').textContent = e.message; }
    }

    function render() {
      pessoas();
      listaCard.innerHTML = '';
      var cs = coringas();
      if (!cs.length) { listaCard.innerHTML = '<h3>Coringas</h3><div class="muted small">Cadastre alguém com regime Coringa ou Expediente.</div>'; return; }
      cs.forEach(function (f) {
        var linha = S.linhaDoCoringa(f.nome_curto);
        var bloco = A.h('div', { style: 'margin-bottom:16px' });
        var furos = linha.filter(function (x) { return x.quebra; }).length;
        bloco.innerHTML = '<h3 style="display:flex;justify-content:space-between">' + A.esc(f.nome_curto) +
          (furos ? '<span class="tag r">' + furos + ' quebra(s)</span>' : '<span class="tag v">ok</span>') + '</h3>';
        if (!linha.length) { bloco.innerHTML += '<div class="muted small">Sem turnos avulsos.</div>'; listaCard.appendChild(bloco); return; }
        linha.forEach(function (x) {
          var row = A.h('div', { class: 'card', style: 'margin-top:6px' });
          row.innerHTML =
            '<div class="card-linha"><span class="pl-pill ' + (CLS[x.plantao] || '') + '">' + (x.plantao || '—') + '</span> ' +
            fmtDT(x.inicio) + ' → ' + fmtDT(x.fim) + ' · ' + x.parte + (x.obs ? ' · ' + A.esc(x.obs) : '') + '</div>' +
            '<div class="card-sub' + (x.quebra ? '' : ' muted') + '">' +
              (x.quebra
                ? '🔴 próximo turno em ' + fmtDT(x.quebra.proximoInicio) + ' — devia descansar até ' + fmtDT(x.protegidoAte) +
                  ' (' + x.quebra.horasPerdidas + ' h a menos' + (x.quebra.assumida ? ', no banco' : '') + ')'
                : 'descansa até ' + fmtDT(x.protegidoAte)) +
            '</div>' +
            '<div class="card-acoes"><button data-ed>editar</button><button class="dng" data-rm>excluir</button></div>';
          row.querySelector('[data-ed]').addEventListener('click', function () {
            editar({ id: x.id, pessoa: f.nome_curto, plantao: x.plantao, inicio: x.inicio, obs: x.obs });
          });
          row.querySelector('[data-rm]').addEventListener('click', function () {
            if (confirm('Excluir este turno?')) Promise.resolve(S.removerEvento(x.id)).then(render);
          });
          bloco.appendChild(row);
        });
        listaCard.appendChild(bloco);
      });
    }

    ['#c-pes', '#c-pl', '#c-data', '#c-parte'].forEach(function (s) { $(s).addEventListener('change', verPrevia); });
    $('#c-salvar').addEventListener('click', salvar);
    $('#c-cancelar').addEventListener('click', limpar);
    render();
  }

  A.registrarTela('coringas', {
    titulo: 'CORINGAS', icone: '🃏', desc: 'Turnos avulsos + descanso de 120h', acesso: 'lider', montar: montar,
    contador: function () {
      try {
        return S.equipe().filter(function (f) { return f.regime === 'coringa' || f.regime === 'expediente'; })
          .reduce(function (n, f) { return n + S.linhaDoCoringa(f.nome_curto).filter(function (x) { return x.quebra; }).length; }, 0) || null;
      } catch (e) { return null; }
    }
  });
})();
