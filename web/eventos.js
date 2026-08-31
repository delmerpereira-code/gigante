/* ============================================================================
 *  eventos.js — Lançamento de eventos + prévia do impacto no banco de horas.
 * ==========================================================================*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var R = window.Rotacao;

  var ROTULO_TIPO = {
    ferias: 'Férias', licenca_medica: 'Licença médica',
    folga_abatendo_banco: 'Folga abatendo banco', troca: 'Troca',
    convocacao: 'Convocação', sobreaviso_escalado: 'Sobreaviso escalado',
    sobreaviso_acionado: 'Sobreaviso acionado'
  };
  // tipos em que o campo "substituto" faz sentido
  var COM_SUB = { ferias: 1, licenca_medica: 1, troca: 1, folga_abatendo_banco: 0 };

  function opcoesPessoas(soEu) {
    var p = Store.papelAtual();
    return Store.funcionarios()
      .filter(function (f) { return f.regime === 'plantao' || f.regime === 'coringa'; })
      .filter(function (f) { return !soEu || p.tipo === 'lider' || f.nome_curto === p.nome; })
      .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); })
      .map(function (f) {
        return '<option value="' + f.nome_curto + '">' + f.nome_curto +
          (f.plantao ? ' (' + f.plantao + ')' : ' (coringa)') + '</option>';
      }).join('');
  }

  function preencherPessoas() {
    var gerente = Store.ehLider();
    $('ePessoa').innerHTML = opcoesPessoas(true);
    $('ePessoa').disabled = !gerente;
    $('eSub').innerHTML = '<option value="">—</option>' + opcoesPessoas(false);
  }

  function toggleSub() {
    $('wrapSub').style.display = COM_SUB[$('eTipo').value] ? '' : 'none';
  }

  function horas(ini, fim) {
    if (!ini || !fim) return 0;
    return Math.max(0, (new Date(fim) - new Date(ini)) / 3600000);
  }

  function previa() {
    var box = $('previa');
    var tipo = $('eTipo').value;
    var pessoa = $('ePessoa').value;
    var ini = $('eInicio').value, fim = $('eFim').value;
    if (!pessoa || !ini) { box.hidden = true; return; }
    var h = horas(ini, fim || ini);
    var f = Store.funcionarioPorNome(pessoa);
    var cfg = Store.rotacaoConfig();
    var txt = '';

    if (tipo === 'convocacao') {
      if (!f || !f.plantao) {
        txt = 'Pessoa sem plantão: credita ' + arred(h * cfg.fatorConvocacao) + ' h de trabalho (× fator).';
        box.className = 'resultado ok';
      } else {
        var imp = R.avaliarConvocacao(f.plantao, new Date(ini), h, cfg);
        box.className = 'resultado ' + (imp.irregular ? 'irregular' : 'ok');
        txt = '<strong>' + imp.mensagem + '</strong>' +
          '<table>' +
          (imp.irregular ? '<tr><td>Folga perdida</td><td>' + imp.horasFolgaPerdidas + ' h</td></tr>' +
            '<tr><td>Crédito folga (× ' + cfg.multFolgaPerdida + ')</td><td>' + imp.creditoFolga + ' h</td></tr>' : '') +
          '<tr><td>Crédito trabalho (× ' + cfg.fatorConvocacao + ')</td><td>' + imp.creditoTrabalho + ' h</td></tr>' +
          '<tr><td>Total ao banco</td><td>' + imp.total + ' h</td></tr></table>';
      }
    } else if (tipo === 'sobreaviso_acionado') {
      box.className = 'resultado ok';
      txt = 'Crédito de ' + arred(h * cfg.fatorConvocacao) + ' h no banco de ' + pessoa + ' (× fator ' + cfg.fatorConvocacao + ').';
    } else if (tipo === 'sobreaviso_escalado') {
      box.className = 'resultado ok';
      txt = cfg.creditoSobreaviso > 0
        ? 'Crédito de ' + arred(h * cfg.creditoSobreaviso) + ' h (sobreaviso não acionado × ' + cfg.creditoSobreaviso + ').'
        : 'Sem crédito (credito_sobreaviso = 0). Apenas registra quem está de sobreaviso.';
    } else if (tipo === 'folga_abatendo_banco') {
      box.className = 'resultado ok';
      txt = 'Débito de ' + arred(h) + ' h no banco de ' + pessoa + ' (abatimento de saldo).';
    } else {
      box.className = 'resultado ok';
      txt = ROTULO_TIPO[tipo] + ': apenas registro, sem lançamento no banco de horas.';
    }
    box.innerHTML = txt;
    box.hidden = false;
  }
  function arred(n) { return Math.round(n * 100) / 100; }

  function limpar() {
    $('form').reset();
    $('eId').value = '';
    $('formTitulo').textContent = 'Novo evento';
    $('btnCancelar').hidden = true;
    $('formErro').textContent = '';
    $('previa').hidden = true;
    toggleSub();
  }

  function editar(ev) {
    $('eId').value = ev.id;
    $('eTipo').value = ev.tipo;
    toggleSub();
    $('ePessoa').value = ev.pessoa;
    $('eSub').value = ev.substituto || '';
    $('eInicio').value = (ev.inicio || '').slice(0, 16);
    $('eFim').value = (ev.fim || '').slice(0, 16);
    $('eObs').value = ev.obs || '';
    $('formTitulo').textContent = 'Editando evento';
    $('btnCancelar').hidden = false;
    previa();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function salvar(e) {
    e.preventDefault();
    $('formErro').textContent = '';
    try {
      var r = Store.salvarEvento({
        id: $('eId').value || undefined,
        tipo: $('eTipo').value,
        pessoa: $('ePessoa').value,
        substituto: COM_SUB[$('eTipo').value] ? $('eSub').value : '',
        inicio: $('eInicio').value,
        fim: $('eFim').value,
        obs: $('eObs').value
      });
      limpar();
      render();
      if (r.irregular) flash('Evento salvo — QUEBRA DE REGRA registrada e lançada no banco.');
      else flash('Evento salvo.');
    } catch (err) {
      $('formErro').textContent = err.message;
    }
  }

  function flash(msg) {
    var b = $('previa');
    b.className = 'resultado ok';
    b.textContent = msg;
    b.hidden = false;
  }

  function excluir(ev) {
    if (!confirm('Excluir este evento? Os lançamentos que ele gerou no banco de horas serão desfeitos.')) return;
    Store.removerEvento(ev.id);
    render();
  }

  function impactoTexto(ev) {
    var linhas = Store.bancoHoras().filter(function (l) { return l.evento_id === ev.id; });
    if (!linhas.length) return ev.tipo === 'convocacao' && ev.irregular === 'nao' ? 'regular — 0 h' : '—';
    return linhas.map(function (l) {
      return (l.sentido === 'saida' ? '−' : '+') + l.horas + ' h (' + l.motivo + ')';
    }).join('<br>');
  }

  function render() {
    var funcs = Store.funcionarios();
    $('avisoSemFunc').hidden = funcs.length > 0;
    preencherPessoas();

    var evs = Store.eventosVisiveis().filter(function (e) {
      return e.tipo !== 'ferias' && e.tipo !== 'licenca_medica';
    });
    $('qtd').textContent = evs.length;
    var tb = $('tbody');
    tb.innerHTML = '';
    evs.forEach(function (ev) {
      var tr = document.createElement('tr');
      if (ev.irregular === 'sim') tr.className = 'linha-irregular';
      tr.innerHTML =
        '<td>' + fmt(ev.inicio) + '</td>' +
        '<td>' + fmt(ev.fim) + '</td>' +
        '<td>' + (ROTULO_TIPO[ev.tipo] || ev.tipo) +
          (ev.irregular === 'sim' ? ' <span class="tag st-afastado">quebra</span>' : '') + '</td>' +
        '<td>' + ev.pessoa + '</td>' +
        '<td>' + (ev.substituto || '—') + '</td>' +
        '<td>' + impactoTexto(ev) + '</td>' +
        '<td class="acoes"><button class="mini" data-ed>editar</button> ' +
        '<button class="mini danger" data-rm>excluir</button></td>';
      tr.querySelector('[data-ed]').addEventListener('click', function () { editar(ev); });
      tr.querySelector('[data-rm]').addEventListener('click', function () { excluir(ev); });
      tb.appendChild(tr);
    });
  }

  function fmt(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  document.addEventListener('dados-prontos', function () {
    toggleSub();
    ['eTipo', 'ePessoa', 'eInicio', 'eFim'].forEach(function (id) {
      $(id).addEventListener('change', function () { toggleSub(); previa(); });
    });
    $('form').addEventListener('submit', salvar);
    $('btnCancelar').addEventListener('click', limpar);
    render();
  });
})();
