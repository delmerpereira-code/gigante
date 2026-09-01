/* telas/funcionarios.js — cadastro completo (só líder) */
(function () {
  'use strict';
  var S = window.Store, A = window.App;
  var CARGO = { investigador: 'Investigador', delegado: 'Delegado', diretor: 'Diretor', administrador: 'Administrador' };
  var REGIME = { plantao: 'Plantão', coringa: 'Coringa', expediente: 'Expediente', '': 'Fora da escala' };

  function montar(corpo) {
    if (!S.ehLider()) { corpo.innerHTML = '<div class="vazio"><div class="ic">🔒</div><div class="txt">Tela do líder. Use "Ver como → Líder" na tela inicial.</div></div>'; return; }
    var ord = S.rotacaoConfig().ordem, fotoAtual = '', editId = '';

    var card = A.h('div', { class: 'card' });
    card.innerHTML = '<h3 id="fc-tit">Novo funcionário</h3><div class="form">' +
      '<div class="campo wide" style="display:flex;gap:14px;align-items:center"><div class="foto-box" id="fc-fbox">sem foto</div>' +
        '<div><input type="file" id="fc-foto" accept="image/*"><br><button class="btn pequeno sec" id="fc-frm" style="margin-top:6px">remover</button></div></div>' +
      '<div class="campo"><label>Matrícula</label><input type="text" id="fc-mat"></div>' +
      '<div class="campo"><label>Nome completo</label><input type="text" id="fc-nc"></div>' +
      '<div class="campo"><label>Nome curto *</label><input type="text" id="fc-ns"></div>' +
      '<div class="campo"><label>E-mail (contato)</label><input type="email" id="fc-email-c" autocapitalize="off"></div>' +
      '<div class="campo"><label>Celular / WhatsApp</label><input type="tel" id="fc-c1"></div>' +
      '<div class="campo"><label>Celular 2</label><input type="tel" id="fc-c2"></div>' +
      '<div class="campo"><label>Nascimento</label><input type="date" id="fc-nasc"></div>' +
      '<div class="campo"><label>Cargo</label><select id="fc-cargo"><option value="investigador">Investigador</option><option value="delegado">Delegado</option><option value="diretor">Diretor</option><option value="administrador">Administrador</option></select></div>' +
      '<div class="campo"><label>Regime</label><select id="fc-reg"><option value="plantao">Plantão</option><option value="coringa">Coringa</option><option value="expediente">Expediente</option><option value="">Fora da escala</option></select></div>' +
      '<div class="campo" id="fc-wpl"><label>Plantão</label><select id="fc-pl"><option value="">—</option>' + ord.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="campo"><label>Acesso de líder</label><select id="fc-lider"><option value="nao">Não</option><option value="sim">Sim</option></select></div>' +
      '<div class="campo"><label>Status</label><select id="fc-st"><option value="ativo">Ativo</option><option value="ferias">Férias</option><option value="licenca">Licença</option><option value="afastado">Afastado</option></select></div>' +
      '<div class="campo"><label>Admissão</label><input type="date" id="fc-adm"></div>' +
      '<div class="campo"><label>Saldo inicial banco (h)</label><input type="number" id="fc-saldo" step="0.5" value="0"></div>' +
      '<div class="campo"><label>Dias de férias/ano</label><input type="number" id="fc-df" value="30"></div>' +
      '<div class="campo wide" style="border-top:1px solid var(--border);padding-top:12px">' +
        '<label>Login</label><div id="fc-login-info" class="card-sub" style="margin-bottom:6px"></div>' +
        '<input type="text" id="fc-senha" placeholder="senha inicial (mín. 6)" autocomplete="off">' +
        '<div class="card-acoes" style="margin-top:6px"><button id="fc-reset" type="button" hidden>Redefinir senha</button></div>' +
        '<div class="card-sub" style="margin-top:4px">O login é o <b>e-mail (contato)</b> acima. A pessoa entra com e-mail + senha e depois troca a senha em "Meu cadastro".</div>' +
      '</div>' +
      '</div><div class="card-acoes"><button class="pri" id="fc-salvar">Salvar</button><button id="fc-cancelar" hidden>Cancelar</button><span class="erro" id="fc-erro"></span></div>';
    corpo.appendChild(card);
    var listaCard = A.h('div', { class: 'card' });
    corpo.appendChild(listaCard);

    var $ = function (s) { return card.querySelector(s); };
    function togglePl() { $('#fc-wpl').style.display = $('#fc-reg').value === 'plantao' ? '' : 'none'; }
    function limpar() {
      editId = ''; fotoAtual = '';
      card.querySelectorAll('input').forEach(function (i) { i.value = i.id === 'fc-saldo' ? '0' : (i.id === 'fc-df' ? '30' : ''); });
      $('#fc-fbox').textContent = 'sem foto'; $('#fc-tit').textContent = 'Novo funcionário';
      $('#fc-cancelar').hidden = true; $('#fc-erro').textContent = '';
      $('#fc-login-info').textContent = 'Defina e-mail (contato) + senha inicial para criar o acesso.';
      $('#fc-senha').disabled = false; $('#fc-senha').placeholder = 'senha inicial (mín. 6)';
      $('#fc-reset').hidden = true;
      togglePl();
    }
    function editar(f) {
      editId = f.id; fotoAtual = f.foto || '';
      var temLogin = !!f.auth_user_id, ehLiderAlvo = f.lider === 'sim';
      var ehEuMesmo = false;
      try { ehEuMesmo = window.Sync && Sync.modo === 'db' && S.papelAtual().nome === f.nome_curto; } catch (e) {}
      $('#fc-senha').value = ''; $('#fc-senha').placeholder = 'senha inicial (mín. 6)';
      if (!temLogin) {
        $('#fc-login-info').textContent = 'Sem login — defina e-mail + senha e salve.';
        $('#fc-senha').disabled = false; $('#fc-reset').hidden = true;
      } else if (ehLiderAlvo && !ehEuMesmo) {
        $('#fc-login-info').innerHTML = '✓ login de líder/administrador' + (f.email ? ' (' + A.esc(f.email) + ')' : '') +
          ' — por segurança, só a própria pessoa troca essa senha, em <b>Meu cadastro</b>.';
        $('#fc-senha').disabled = true; $('#fc-reset').hidden = true;
      } else {
        $('#fc-login-info').textContent = '✓ login já criado' + (f.email ? ' (' + f.email + ')' : '');
        $('#fc-senha').disabled = true; $('#fc-reset').hidden = false;
      }
      $('#fc-email-c').value = f.email || '';
      $('#fc-mat').value = f.matricula || ''; $('#fc-nc').value = f.nome_completo || ''; $('#fc-ns').value = f.nome_curto || '';
      $('#fc-c1').value = f.celular || ''; $('#fc-c2').value = f.celular2 || ''; $('#fc-nasc').value = f.nascimento || '';
      $('#fc-cargo').value = f.cargo; $('#fc-reg').value = f.regime || ''; togglePl(); $('#fc-pl').value = f.plantao || '';
      $('#fc-lider').value = f.lider === 'sim' ? 'sim' : 'nao'; $('#fc-st').value = f.status || 'ativo';
      $('#fc-adm').value = f.admissao || ''; $('#fc-saldo').value = f.saldo_inicial_banco || 0; $('#fc-df').value = f.dias_ferias_ano || 30;
      $('#fc-fbox').innerHTML = fotoAtual ? '<img src="' + fotoAtual + '">' : 'sem foto';
      $('#fc-tit').textContent = 'Editando: ' + f.nome_curto; $('#fc-cancelar').hidden = false; corpo.scrollTop = 0;
    }
    function dadosForm(authId) {
      var d = {
        id: editId || undefined, matricula: $('#fc-mat').value.trim(), nome_completo: $('#fc-nc').value, nome_curto: $('#fc-ns').value,
        foto: fotoAtual, email: $('#fc-email-c').value.trim(), celular: $('#fc-c1').value, celular2: $('#fc-c2').value, nascimento: $('#fc-nasc').value,
        cargo: $('#fc-cargo').value, regime: $('#fc-reg').value, plantao: $('#fc-reg').value === 'plantao' ? $('#fc-pl').value : '',
        lider: $('#fc-lider').value, status: $('#fc-st').value, admissao: $('#fc-adm').value,
        saldo_inicial_banco: $('#fc-saldo').value, dias_ferias_ano: $('#fc-df').value
      };
      if (authId) d.auth_user_id = authId;
      return d;
    }
    function gravar(authId) {
      return Promise.resolve(S.salvarFuncionario(dadosForm(authId)))
        .then(function () { limpar(); render(); A.toast('Salvo', 'sucesso'); });
    }
    function salvar() {
      $('#fc-erro').textContent = '';
      var loginEmail = $('#fc-email-c').value.trim(), senha = $('#fc-senha').value;
      var criarLogin = !$('#fc-senha').disabled && !!senha;
      try {
        var p;
        if (criarLogin) {
          if (!/^\S+@\S+\.\S+$/.test(loginEmail)) throw new Error('Preencha um e-mail válido — é o login da pessoa.');
          if (senha.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.');
          A.loading(true, 'CRIANDO ACESSO');
          p = window.Sync.criarLogin(loginEmail, senha).then(function (uid) { A.loading(false); return gravar(uid); });
        } else {
          p = gravar(null);
        }
        p.catch(function (e) { A.loading(false); $('#fc-erro').textContent = e.message || String(e); });
      } catch (e) { A.loading(false); $('#fc-erro').textContent = e.message; }
    }
    function render() {
      var lista = S.funcionarios().sort(function (a, b) {
        var ra = a.regime === 'plantao' ? 0 : (a.regime === 'coringa' ? 1 : 2), rb = b.regime === 'plantao' ? 0 : (b.regime === 'coringa' ? 1 : 2);
        if (ra !== rb) return ra - rb;
        var d = ord.indexOf(a.plantao) - ord.indexOf(b.plantao);
        return d || a.nome_curto.localeCompare(b.nome_curto);
      });
      var saldos = S.saldos();
      listaCard.innerHTML = '';
      listaCard.appendChild(A.h('h3', { text: 'Funcionários (' + lista.length + ')' }));
      lista.forEach(function (f) {
        var s = (f.nome_curto in saldos) ? saldos[f.nome_curto] : (Number(f.saldo_inicial_banco) || 0);
        var foto = f.foto ? '<img class="foto-mini" src="' + f.foto + '">' : '<span class="foto-mini vazia">' + A.esc((f.nome_curto || '?').charAt(0)) + '</span>';
        var d = A.h('div', { class: 'card', style: 'margin-top:8px' });
        d.innerHTML = '<div class="card-top" style="align-items:flex-start">' +
          '<div style="display:flex;gap:10px;align-items:center">' + foto + '<div><b class="card-titulo">' + A.esc(f.nome_curto) + '</b>' +
          (f.lider === 'sim' ? ' ★' : '') + '<div class="card-sub">' + (f.matricula || '—') + ' · ' + (CARGO[f.cargo] || '') + ' · ' + (REGIME[f.regime] != null ? REGIME[f.regime] : '') + (f.plantao ? ' ' + f.plantao : '') + '</div></div></div>' +
          '<span class="tag ' + (f.status === 'ativo' ? 'v' : 'n') + '">' + f.status + '</span></div>' +
          '<div class="card-sub">Saldo: <b>' + s + ' h</b>' + (f.auth_user_id ? ' · <span class="tag v">com login</span>' : ' · <span class="tag a">sem login</span>') + '</div>' +
          '<div class="card-acoes"><button data-ed>editar</button><button class="dng" data-rm>excluir</button></div>';
        d.querySelector('[data-ed]').addEventListener('click', function () { editar(f); });
        d.querySelector('[data-rm]').addEventListener('click', function () { if (confirm('Excluir "' + f.nome_curto + '"?')) Promise.resolve(S.removerFuncionario(f.id)).then(render); });
        listaCard.appendChild(d);
      });
      var chips = S.plantoes().map(function (p) {
        var dupla = [p.pessoa_1, p.pessoa_2].filter(Boolean).join(' + ') || '(vazio)';
        return '<span class="chip' + ((!p.pessoa_1 || !p.pessoa_2) ? ' neg' : '') + '"><b>' + p.codigo + '</b> ' + A.esc(dupla) + '</span>';
      }).join('');
      var pl = A.h('div', { style: 'margin-top:14px' });
      pl.innerHTML = '<h3>Plantões</h3><div class="chips">' + chips + '</div>';
      listaCard.appendChild(pl);
    }

    $('#fc-reg').addEventListener('change', togglePl);
    $('#fc-foto').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      window.Foto.reduzir(file, 220, function (err, url) { if (err) { $('#fc-erro').textContent = err.message; return; } fotoAtual = url; $('#fc-fbox').innerHTML = '<img src="' + url + '">'; });
    });
    $('#fc-frm').addEventListener('click', function () { fotoAtual = ''; $('#fc-fbox').textContent = 'sem foto'; $('#fc-foto').value = ''; });
    $('#fc-reset').addEventListener('click', function () {
      $('#fc-senha').disabled = false; $('#fc-senha').placeholder = 'nova senha (mín. 6)';
      $('#fc-senha').focus(); this.hidden = true;
      $('#fc-login-info').textContent = 'Digite a nova senha e clique em Salvar. A pessoa deve trocá-la depois em "Meu cadastro".';
    });
    $('#fc-salvar').addEventListener('click', salvar);
    $('#fc-cancelar').addEventListener('click', limpar);
    togglePl(); render();
  }

  A.registrarTela('funcionarios', { titulo: 'FUNCIONÁRIOS', icone: '👥', desc: 'Cadastro completo da equipe', acesso: 'lider', montar: montar });
})();
