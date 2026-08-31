/* ============================================================================
 *  meu-cadastro.js — Cada funcionário atualiza os próprios dados pessoais.
 *  Só os campos de CAMPOS_PESSOAIS; o resto é leitura.
 * ==========================================================================*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = window.Store;
  var fotoAtual = '';
  var alvoId = null;

  var CARGO = { investigador: 'Investigador', delegado: 'Delegado', diretor: 'Diretor' };
  var REGIME = { plantao: 'Plantão', coringa: 'Coringa', '': 'Fora da escala' };

  function pessoaAlvo() {
    var p = S.papelAtual();
    if (p.tipo === 'lider') {
      // se o "Ver como" apontar para uma pessoa-líder, edita ela; senão, nada
      var f = S.funcionarioPorNome(S.verComo()) || S.funcionarioPorMatricula(S.verComo());
      return f || null;
    }
    return S.funcionarioPorNome(p.nome);
  }

  function mostrarFoto(dataUrl) {
    fotoAtual = dataUrl || '';
    var img = $('fFotoPrev');
    if (fotoAtual) { img.src = fotoAtual; img.hidden = false; $('fFotoVazia').hidden = true; }
    else { img.hidden = true; $('fFotoVazia').hidden = false; }
  }

  function carregar(f) {
    alvoId = f.id;
    $('fNomeCompleto').value = f.nome_completo || '';
    $('fNomeCurto').value = f.nome_curto || '';
    $('fCelular').value = f.celular || '';
    $('fCelular2').value = f.celular2 || '';
    $('fNascimento').value = f.nascimento || '';
    mostrarFoto(f.foto || '');
    $('ficha').innerHTML =
      linha('Matrícula', f.matricula || '—') +
      linha('Cargo', CARGO[f.cargo] || '—') +
      linha('Regime', REGIME[f.regime] != null ? REGIME[f.regime] : '—') +
      linha('Plantão', f.plantao || '—') +
      linha('Status', f.status || 'ativo') +
      linha('Acesso de líder', f.lider === 'sim' ? 'Sim' : 'Não');

    var resumo = S.resumoContas(f.nome_curto);
    $('cardContas').hidden = resumo.length === 0;
    $('contas').innerHTML = resumo.map(function (r) {
      return '<li class="' + (r.devo ? '' : 'ok') + '">' + r.texto + '</li>';
    }).join('');
  }
  function linha(k, v) { return '<dt>' + k + '</dt><dd>' + v + '</dd>'; }

  function salvar(ev) {
    ev.preventDefault();
    $('formErro').textContent = '';
    $('formOk').textContent = '';
    try {
      S.salvarFuncionario({
        id: alvoId,
        nome_completo: $('fNomeCompleto').value,
        nome_curto: $('fNomeCurto').value,
        celular: $('fCelular').value,
        celular2: $('fCelular2').value,
        nascimento: $('fNascimento').value,
        foto: fotoAtual
      }, true); // apenasPessoais
      $('formOk').textContent = 'Dados salvos.';
      carregar(S.funcionarioPorId(alvoId));
    } catch (e) {
      $('formErro').textContent = e.message;
    }
  }

  document.addEventListener('dados-prontos', function () {
    var f = pessoaAlvo();
    if (!f) {
      $('avisoLider').hidden = false;
      return;
    }
    $('cartao').hidden = false;
    carregar(f);
    $('form').addEventListener('submit', salvar);
    $('fFoto').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      Foto.reduzir(file, 220, function (err, dataUrl) {
        if (err) { $('formErro').textContent = err.message; return; }
        mostrarFoto(dataUrl);
      });
    });
    $('fFotoLimpar').addEventListener('click', function () { mostrarFoto(''); $('fFoto').value = ''; });
  });
})();
