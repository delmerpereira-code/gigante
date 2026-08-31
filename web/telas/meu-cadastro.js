/* telas/meu-cadastro.js — cada funcionário atualiza os próprios dados */
(function () {
  'use strict';
  var S = window.Store, A = window.App;
  var CARGO = { investigador: 'Investigador', delegado: 'Delegado', diretor: 'Diretor' };
  var REGIME = { plantao: 'Plantão', coringa: 'Coringa', '': 'Fora da escala' };

  function alvo() {
    var p = S.papelAtual();
    if (p.tipo === 'lider') return S.funcionarioPorNome(S.verComo()) || null;
    return S.funcionarioPorNome(p.nome);
  }

  function montar(corpo) {
    var f = alvo();
    if (!f) {
      corpo.innerHTML = '<div class="vazio"><div class="ic">👤</div><div class="txt">Escolha uma pessoa no "Ver como" (na tela inicial) para editar o cadastro dela.</div></div>';
      return;
    }
    var fotoAtual = f.foto || '';
    var card = A.h('div', { class: 'card' });
    card.innerHTML = '<h3>Meus dados</h3><div class="form">' +
      '<div class="campo wide" style="display:flex;gap:14px;align-items:center">' +
        '<div class="foto-box" id="mc-fbox">' + (fotoAtual ? '<img src="' + fotoAtual + '">' : 'sem foto') + '</div>' +
        '<div><input type="file" id="mc-foto" accept="image/*"><br><button class="btn pequeno sec" id="mc-frm" style="margin-top:6px">remover</button></div>' +
      '</div>' +
      '<div class="campo"><label>Nome completo</label><input type="text" id="mc-nc" value="' + A.esc(f.nome_completo) + '"></div>' +
      '<div class="campo"><label>Nome curto *</label><input type="text" id="mc-ns" value="' + A.esc(f.nome_curto) + '"></div>' +
      '<div class="campo"><label>Celular</label><input type="tel" id="mc-c1" value="' + A.esc(f.celular) + '"></div>' +
      '<div class="campo"><label>Celular 2</label><input type="tel" id="mc-c2" value="' + A.esc(f.celular2) + '"></div>' +
      '<div class="campo"><label>Nascimento</label><input type="date" id="mc-nasc" value="' + A.esc(f.nascimento) + '"></div>' +
      '</div><div class="card-acoes"><button class="pri" id="mc-salvar">Salvar</button><span class="erro" id="mc-erro"></span><span class="ok-msg" id="mc-ok"></span></div>';
    corpo.appendChild(card);

    var ficha = A.h('div', { class: 'card' });
    ficha.innerHTML = '<h3>Definido pelo líder</h3><div class="tab-wrap"><table class="mini">' +
      '<tr><td>Matrícula</td><td>' + A.esc(f.matricula || '—') + '</td></tr>' +
      '<tr><td>Cargo</td><td>' + (CARGO[f.cargo] || '—') + '</td></tr>' +
      '<tr><td>Regime</td><td>' + (REGIME[f.regime] != null ? REGIME[f.regime] : '—') + '</td></tr>' +
      '<tr><td>Plantão</td><td>' + A.esc(f.plantao || '—') + '</td></tr>' +
      '<tr><td>Status</td><td>' + A.esc(f.status) + '</td></tr>' +
      '<tr><td>Líder</td><td>' + (f.lider === 'sim' ? 'Sim' : 'Não') + '</td></tr></table></div>';
    corpo.appendChild(ficha);

    var res = S.resumoContas(f.nome_curto);
    if (res.length) {
      var c = A.h('div', { class: 'card' });
      c.innerHTML = '<h3>Contas de permuta</h3><ul class="lista-alertas">' + res.map(function (r) { return '<li class="' + (r.devo ? '' : 'ok') + '">' + A.esc(r.texto) + '</li>'; }).join('') + '</ul>';
      corpo.appendChild(c);
    }

    var $ = function (s) { return card.querySelector(s); };
    $('#mc-foto').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      window.Foto.reduzir(file, 220, function (err, url) {
        if (err) { $('#mc-erro').textContent = err.message; return; }
        fotoAtual = url; $('#mc-fbox').innerHTML = '<img src="' + url + '">';
      });
    });
    $('#mc-frm').addEventListener('click', function () { fotoAtual = ''; $('#mc-fbox').textContent = 'sem foto'; $('#mc-foto').value = ''; });
    $('#mc-salvar').addEventListener('click', function () {
      $('#mc-erro').textContent = ''; $('#mc-ok').textContent = '';
      try {
        Promise.resolve(S.salvarFuncionario({
          id: f.id, nome_completo: $('#mc-nc').value, nome_curto: $('#mc-ns').value,
          celular: $('#mc-c1').value, celular2: $('#mc-c2').value, nascimento: $('#mc-nasc').value, foto: fotoAtual
        }, true)).then(function () { $('#mc-ok').textContent = 'Salvo.'; A.toast('Dados salvos', 'sucesso'); })
          .catch(function (e) { $('#mc-erro').textContent = e.message || String(e); });
      } catch (e) { $('#mc-erro').textContent = e.message; }
    });
  }

  A.registrarTela('meu-cadastro', { titulo: 'MEU CADASTRO', icone: '👤', desc: 'Seus dados pessoais', acesso: 'todos', montar: montar });
})();
