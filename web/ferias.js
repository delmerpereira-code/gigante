/* ============================================================================
 *  ferias.js — Comunicação de férias/licença com semáforo de disponibilidade.
 * ==========================================================================*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = window.Store;

  function papel() { return S.papelAtual(); }
  function souGerente() { return S.ehLider(); }

  function preencherPessoas() {
    var p = papel();
    var sel = $('fPessoa');
    var atual = sel.value;
    var lista = S.funcionarios()
      .filter(function (f) { return f.regime === 'plantao' || f.regime === 'coringa'; })
      .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
    if (souGerente()) {
      sel.innerHTML = lista.map(function (f) {
        return '<option value="' + f.nome_curto + '">' + f.nome_curto + ' · ' + (f.plantao || 'coringa') + '</option>';
      }).join('');
      sel.disabled = false;
      // preserva a seleção atual (o rebuild do <select> a zeraria)
      if (atual && lista.some(function (f) { return f.nome_curto === atual; })) sel.value = atual;
    } else {
      sel.innerHTML = '<option value="' + p.nome + '">' + p.nome + '</option>';
      sel.disabled = true;
    }
  }

  function fmtBR(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }
  function dias(ini, fim) {
    var a = new Date(ini + 'T00:00'), b = new Date((fim || ini) + 'T00:00');
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  var ultimaAval = null;

  function semaforo() {
    var box = $('semaforo');
    var pessoa = $('fPessoa').value, ini = $('fInicio').value, fim = $('fFim').value || ini;
    if (!pessoa || !ini) { box.hidden = true; ultimaAval = null; atualizarBotao(); return; }

    var av = S.avaliarFerias(pessoa, ini, fim, $('fId').value || undefined, false, $('fTipo').value);
    ultimaAval = av;
    var cor = { livre: 'verde', impacto: 'ama', bloqueado: 'verm' }[av.nivel];
    var titulo = { livre: '🟢 Disponível', impacto: '🟡 Permitido com impacto', bloqueado: '🔴 Bloqueado' }[av.nivel];

    var html = '<div class="sem-cab sem-' + cor + '"><b>' + titulo + '</b> · ' +
      dias(ini, fim) + ' dia(s)</div>';
    if (av.mensagens.length) {
      html += '<ul>' + av.mensagens.map(function (m) { return '<li>' + m + '</li>'; }).join('') + '</ul>';
    }
    var s = av.saldo;
    html += '<div class="sem-saldo">Saldo em ' + new Date(ini).getFullYear() + ': ' +
      s.consumido + ' marcados + ' + s.novos + ' novos de ' + s.base +
      ' → <b class="' + (s.restante < 0 ? 'neg' : '') + '">' + s.restante + ' restantes</b></div>';
    if (av.proximaJanela) {
      html += '<div class="sem-janela">Próxima janela 🟢: <b>' +
        fmtBR(av.proximaJanela.inicio) + ' a ' + fmtBR(av.proximaJanela.fim) + '</b> ' +
        '<button type="button" id="usarJanela" class="mini">usar</button></div>';
    }
    box.className = 'semaforo sem-' + cor;
    box.innerHTML = html;
    box.hidden = false;

    var uj = $('usarJanela');
    if (uj) uj.addEventListener('click', function () {
      $('fInicio').value = av.proximaJanela.inicio;
      $('fFim').value = av.proximaJanela.fim;
      semaforo();
    });
    atualizarBotao();
  }

  function atualizarBotao() {
    var bloq = ultimaAval && ultimaAval.nivel === 'bloqueado';
    $('btnSalvar').disabled = !!bloq;
    $('btnSalvar').textContent = bloq ? 'Bloqueado' :
      ($('fId').value ? 'Salvar alterações' : 'Comunicar');
  }

  function limpar() {
    $('form').reset();
    $('fId').value = '';
    $('formTitulo').textContent = 'Comunicar férias';
    $('btnCancelar').hidden = true;
    $('formErro').textContent = '';
    $('semaforo').hidden = true;
    ultimaAval = null;
    preencherPessoas();
    atualizarBotao();
  }

  function editar(e) {
    $('fId').value = e.id;
    $('fTipo').value = e.tipo;
    if (souGerente()) $('fPessoa').value = e.pessoa;
    $('fInicio').value = String(e.inicio).slice(0, 10);
    $('fFim').value = String(e.fim).slice(0, 10);
    $('fObs').value = e.obs || '';
    $('formTitulo').textContent = 'Editando período de ' + e.pessoa;
    $('btnCancelar').hidden = false;
    semaforo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function salvar(ev) {
    ev.preventDefault();
    $('formErro').textContent = '';
    try {
      var r = S.salvarEvento({
        id: $('fId').value || undefined,
        tipo: $('fTipo').value,
        pessoa: $('fPessoa').value,
        inicio: $('fInicio').value,
        fim: $('fFim').value || $('fInicio').value,
        obs: $('fObs').value
      });
      limpar();
      render();
      var box = $('semaforo');
      box.hidden = false;
      box.className = 'semaforo sem-' + (r.nivel === 'impacto' ? 'ama' : 'verde');
      box.innerHTML = '<div class="sem-cab">Comunicado registrado' +
        (r.nivel === 'impacto' ? ' — com impacto (ver alertas)' : '') + '.</div>';
    } catch (e) {
      $('formErro').textContent = e.message;
    }
  }

  function podeMexer(e) {
    return souGerente() || papel().nome === e.pessoa;
  }

  function excluir(e) {
    if (!confirm('Excluir o período de ' + e.pessoa + '?')) return;
    S.removerEvento(e.id);
    render();
  }

  function render() {
    var funcs = S.funcionarios();
    $('avisoVazio').hidden = funcs.length > 0;
    preencherPessoas();

    var anoRef = new Date().getFullYear();
    if ($('fInicio').value) anoRef = new Date($('fInicio').value).getFullYear();
    $('anoRef').textContent = anoRef;

    // saldos
    var pes = funcs.filter(function (f) { return f.regime === 'plantao' || f.regime === 'coringa'; });
    if (!souGerente()) pes = pes.filter(function (f) { return f.nome_curto === papel().nome; });
    pes.sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
    $('tbodySaldo').innerHTML = pes.map(function (f) {
      var s = S.saldoFerias(f.nome_curto, anoRef);
      var pct = Math.max(0, Math.min(100, Math.round(s.consumido / s.base * 100)));
      return '<tr><td>' + f.nome_curto + '</td><td class="num">' + s.base + '</td>' +
        '<td class="num">' + s.consumido + '</td>' +
        '<td class="num ' + (s.restante < 0 ? 'neg' : '') + '">' + s.restante + '</td>' +
        '<td><span class="barra"><i style="width:' + pct + '%"></i></span></td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">—</td></tr>';

    // períodos (calendário de férias = todos veem)
    var evs = S.eventos().filter(function (e) { return e.tipo === 'ferias' || e.tipo === 'licenca_medica'; });
    $('qtd').textContent = evs.length;
    var NIV = { livre: '<span class="tag st-ativo">livre</span>',
                impacto: '<span class="tag st-licenca">impacto</span>',
                bloqueado: '<span class="tag st-afastado">bloqueado</span>' };
    $('tbody').innerHTML = evs.map(function (e) {
      var acao = podeMexer(e)
        ? '<button class="mini" data-ed>editar</button> <button class="mini danger" data-rm>excluir</button>'
        : '<span class="muted mini">—</span>';
      return '<tr data-id="' + e.id + '"><td>' + e.pessoa + '</td>' +
        '<td>' + (e.tipo === 'ferias' ? 'Férias' : 'Licença') + '</td>' +
        '<td>' + fmtBR(e.inicio) + '</td><td>' + fmtBR(e.fim) + '</td>' +
        '<td class="num">' + dias(String(e.inicio).slice(0, 10), String(e.fim).slice(0, 10)) + '</td>' +
        '<td>' + (NIV[e.nivel] || '—') + '</td><td class="acoes">' + acao + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="muted">Nenhum período marcado.</td></tr>';

    Array.prototype.forEach.call($('tbody').querySelectorAll('tr[data-id]'), function (tr) {
      var e = evs.filter(function (x) { return x.id === tr.getAttribute('data-id'); })[0];
      var ed = tr.querySelector('[data-ed]'), rm = tr.querySelector('[data-rm]');
      if (ed) ed.addEventListener('click', function () { editar(e); });
      if (rm) rm.addEventListener('click', function () { excluir(e); });
    });
  }

  document.addEventListener('dados-prontos', function () {
    ['fTipo', 'fPessoa', 'fInicio', 'fFim'].forEach(function (id) {
      $(id).addEventListener('change', function () { render(); semaforo(); });
    });
    $('form').addEventListener('submit', salvar);
    $('btnCancelar').addEventListener('click', limpar);
    render();
    atualizarBotao();
  });
})();
