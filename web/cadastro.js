/* ============================================================================
 *  cadastro.js — Cadastro completo de funcionários (só Líder).
 * ==========================================================================*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var fotoAtual = '';

  function ordem() { return Store.rotacaoConfig().ordem; }
  var CARGO_ROT = { investigador: 'Investigador', delegado: 'Delegado', diretor: 'Diretor' };
  var REGIME_ROT = { plantao: 'Plantão', coringa: 'Coringa', '': 'Fora da escala' };

  function preencherPlantoesSelect() {
    $('fPlantao').innerHTML = '<option value="">— sem plantão —</option>' +
      ordem().map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  }
  function togglePlantao() {
    $('wrapPlantao').style.display = $('fRegime').value === 'plantao' ? '' : 'none';
  }

  function mostrarFoto(dataUrl) {
    fotoAtual = dataUrl || '';
    var img = $('fFotoPrev');
    if (fotoAtual) { img.src = fotoAtual; img.hidden = false; $('fFotoVazia').hidden = true; }
    else { img.hidden = true; $('fFotoVazia').hidden = false; }
  }

  function limparForm() {
    $('form').reset();
    $('fId').value = '';
    $('fSaldo').value = '0';
    $('fDiasFerias').value = '30';
    mostrarFoto('');
    $('formTitulo').textContent = 'Novo funcionário';
    $('btnCancelar').hidden = true;
    $('formErro').textContent = '';
    $('contasPessoa').hidden = true;
    togglePlantao();
  }

  function mostrarContas(nome) {
    var resumo = Store.resumoContas(nome);
    var ul = $('contasPessoa');
    ul.hidden = resumo.length === 0;
    ul.innerHTML = resumo.map(function (r) {
      return '<li class="' + (r.devo ? '' : 'ok') + '">' + nome + ': ' + r.texto + '</li>';
    }).join('');
  }

  function editar(f) {
    $('fId').value = f.id;
    $('fMatricula').value = f.matricula || '';
    $('fNomeCompleto').value = f.nome_completo || '';
    $('fNomeCurto').value = f.nome_curto || '';
    $('fCelular').value = f.celular || '';
    $('fCelular2').value = f.celular2 || '';
    $('fNascimento').value = f.nascimento || '';
    $('fCargo').value = f.cargo || 'investigador';
    $('fRegime').value = f.regime || '';
    togglePlantao();
    $('fPlantao').value = f.plantao || '';
    $('fLider').value = f.lider === 'sim' ? 'sim' : 'nao';
    $('fStatus').value = f.status || 'ativo';
    $('fAdmissao').value = f.admissao || '';
    $('fSaldo').value = f.saldo_inicial_banco != null ? f.saldo_inicial_banco : 0;
    $('fDiasFerias').value = f.dias_ferias_ano != null ? f.dias_ferias_ano : 30;
    mostrarFoto(f.foto || '');
    $('formTitulo').textContent = 'Editando: ' + f.nome_curto;
    $('btnCancelar').hidden = false;
    $('formErro').textContent = '';
    mostrarContas(f.nome_curto);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function salvar(ev) {
    ev.preventDefault();
    $('formErro').textContent = '';
    try {
      Store.salvarFuncionario({
        id: $('fId').value || undefined,
        matricula: $('fMatricula').value.trim(),
        nome_completo: $('fNomeCompleto').value,
        nome_curto: $('fNomeCurto').value,
        foto: fotoAtual,
        celular: $('fCelular').value, celular2: $('fCelular2').value,
        nascimento: $('fNascimento').value,
        cargo: $('fCargo').value,
        regime: $('fRegime').value,
        plantao: $('fRegime').value === 'plantao' ? $('fPlantao').value : '',
        lider: $('fLider').value,
        status: $('fStatus').value,
        admissao: $('fAdmissao').value,
        saldo_inicial_banco: $('fSaldo').value,
        dias_ferias_ano: $('fDiasFerias').value
      });
      limparForm();
      render();
    } catch (e) {
      $('formErro').textContent = e.message;
    }
  }

  function excluir(f) {
    if (!confirm('Excluir "' + f.nome_curto + '"? Eventos e lançamentos já feitos por essa pessoa continuam registrados.')) return;
    Store.removerFuncionario(f.id);
    render();
  }

  function render() {
    var lista = Store.funcionarios();
    var saldos = Store.saldos();
    $('qtd').textContent = lista.length;
    $('avisoVazio').hidden = lista.length > 0;

    var ord = ordem();
    lista.sort(function (a, b) {
      var ra = a.regime === 'plantao' ? 0 : (a.regime === 'coringa' ? 1 : 2);
      var rb = b.regime === 'plantao' ? 0 : (b.regime === 'coringa' ? 1 : 2);
      if (ra !== rb) return ra - rb;
      var pa = ord.indexOf(a.plantao), pb = ord.indexOf(b.plantao);
      if (pa !== pb) return pa - pb;
      return a.nome_curto.localeCompare(b.nome_curto);
    });

    var tb = $('tbody');
    tb.innerHTML = '';
    lista.forEach(function (f) {
      var tr = document.createElement('tr');
      var saldo = (f.nome_curto in saldos) ? saldos[f.nome_curto] : (Number(f.saldo_inicial_banco) || 0);
      var foto = f.foto
        ? '<img class="mini-foto" src="' + f.foto + '" alt="">'
        : '<span class="mini-foto vazia">' + (f.nome_curto || '?').charAt(0) + '</span>';
      tr.innerHTML =
        '<td>' + foto + '</td>' +
        '<td>' + f.nome_curto + '</td>' +
        '<td>' + (f.matricula || '—') + '</td>' +
        '<td>' + (CARGO_ROT[f.cargo] || '—') + '</td>' +
        '<td>' + (REGIME_ROT[f.regime] != null ? REGIME_ROT[f.regime] : '—') + '</td>' +
        '<td>' + (f.plantao || '—') + '</td>' +
        '<td>' + (f.lider === 'sim' ? '★' : '') + '</td>' +
        '<td><span class="tag st-' + (f.status || 'ativo') + '">' + (f.status || 'ativo') + '</span></td>' +
        '<td class="num ' + (saldo < 0 ? 'neg' : '') + '">' + saldo + ' h</td>' +
        '<td class="acoes"><button class="mini" data-ed>editar</button> ' +
        '<button class="mini danger" data-rm>excluir</button></td>';
      tr.querySelector('[data-ed]').addEventListener('click', function () { editar(f); });
      tr.querySelector('[data-rm]').addEventListener('click', function () { excluir(f); });
      tb.appendChild(tr);
    });

    var chips = $('chipsPlantoes');
    chips.innerHTML = Store.plantoes().map(function (p) {
      var dupla = [p.pessoa_1, p.pessoa_2].filter(Boolean).join(' + ') || '(vazio)';
      var falta = (!p.pessoa_1 || !p.pessoa_2) ? ' incompleto' : '';
      return '<span class="chip' + falta + '"><b>' + p.codigo + '</b> ' + dupla + '</span>';
    }).join('') +
      (Store.coringas().length
        ? '<span class="chip coringa"><b>Coringas</b> ' + Store.coringas().join(', ') + '</span>'
        : '');
  }

  document.addEventListener('dados-prontos', function () {
    if (!Store.ehLider()) {
      document.querySelector('main').innerHTML =
        '<section class="card"><h2>Acesso restrito</h2><p class="muted">' +
        'Esta tela é do Líder. Use o seletor <b>"Ver como"</b> no topo e escolha ' +
        '<b>Líder</b> (ou uma pessoa com acesso de líder).</p></section>';
      return;
    }
    preencherPlantoesSelect();
    togglePlantao();
    $('fRegime').addEventListener('change', togglePlantao);
    $('form').addEventListener('submit', salvar);
    $('btnCancelar').addEventListener('click', limparForm);
    $('fFoto').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      Foto.reduzir(file, 220, function (err, dataUrl) {
        if (err) { $('formErro').textContent = err.message; return; }
        mostrarFoto(dataUrl);
      });
    });
    $('fFotoLimpar').addEventListener('click', function () { mostrarFoto(''); $('fFoto').value = ''; });
    var seed = $('btnSeed');
    var modoBanco = window.Sync && Sync.modo === 'db';
    if (seed && modoBanco) seed.style.display = 'none';
    else if (seed) seed.addEventListener('click', function () { Store.seedElencoExemplo(); render(); });
    render();
  });
})();
