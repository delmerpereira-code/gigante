/* ============================================================================
 *  app.js — Casca do app (SPA): login, home com cartões, roteamento de telas,
 *  modal bottom-sheet, toast, loading. A lógica fica em store.js / sync.js.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var telas = {};   // registro dos módulos

  var App = {
    telas: telas,
    $: $,
    registrarTela: function (nome, def) { def.nome = nome; telas[nome] = def; },
    moduloAtual: null,

    mostrarTela: function (id) {
      var t = document.querySelectorAll('.tela');
      for (var i = 0; i < t.length; i++) t[i].classList.remove('ativa');
      $(id).classList.add('ativa');
      window.scrollTo(0, 0);
    },

    toast: function (msg, tipo) {
      var el = $('toast');
      el.textContent = msg;
      el.className = 'toast on' + (tipo ? ' ' + tipo : '');
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.classList.remove('on'); }, 3200);
    },
    loading: function (on, txt) {
      $('load-txt').textContent = txt || 'CARREGANDO';
      $('load').classList.toggle('on', !!on);
    },

    abrirModal: function (html) {
      $('modal-conteudo').innerHTML = html;
      $('modal').classList.add('on');
      return $('modal-conteudo');
    },
    fecharModal: function () { $('modal').classList.remove('on'); },

    /** Barra de ação fixa no rodapé do módulo. Aceita HTML string ou nós. */
    barra: function (conteudo) {
      var b = $('mod-barra');
      b.innerHTML = '';
      if (typeof conteudo === 'string') b.innerHTML = conteudo;
      else if (conteudo) b.appendChild(conteudo);
      b.hidden = !conteudo;
    },
    /** Botão no canto direito do header do módulo. */
    acaoHeader: function (texto, fn) {
      var a = $('mod-acao');
      var btn = document.createElement('button');
      btn.textContent = texto;
      btn.addEventListener('click', fn);
      a.appendChild(btn);
    },
    faixa: function (msg, aviso) {
      $('mod-faixa').innerHTML = msg ? '<div class="faixa' + (aviso ? ' aviso' : '') + '">' + msg + '</div>' : '';
    },

    abrirModulo: function (nome) {
      var t = telas[nome];
      if (!t) return;
      App.moduloAtual = nome;
      $('mod-titulo').textContent = t.titulo;
      $('mod-acao').innerHTML = '';
      $('mod-faixa').innerHTML = '';
      App.barra(null);
      var corpo = $('mod-corpo');
      corpo.innerHTML = '';
      corpo.scrollTop = 0;
      App.mostrarTela('tela-modulo');
      try { t.montar(corpo); }
      catch (e) { corpo.innerHTML = '<div class="vazio"><div class="ic">⚠️</div><div class="txt">' + (e.message || e) + '</div></div>'; }
    },

    voltarHome: function () { App.moduloAtual = null; renderHome(); App.mostrarTela('tela-home'); },

    // helpers de DOM curtos p/ os módulos
    h: function (tag, attrs, filhos) {
      var e = document.createElement(tag);
      if (attrs) for (var k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') { if (attrs[k]) e.addEventListener(k.slice(2), attrs[k]); }
        else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
      }
      (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
      return e;
    },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  };
  root.App = App;

  // ─── HOME (painel) ──────────────────────────────────────────────────────
  function saudacao() {
    var h = new Date().getHours();
    return h < 12 ? 'bom dia' : (h < 18 ? 'boa tarde' : 'boa noite');
  }
  var MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DOW3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  function proximoTurno(f) {
    if (!f || f.regime !== 'plantao' || !f.plantao || !root.Rotacao) return null;
    var ts = root.Rotacao.proximosTurnos(f.plantao, new Date(), 1, root.Store.rotacaoConfig());
    if (!ts.length) return null;
    var t = ts[0], d = new Date(t.inicio);
    return DOW3[d.getDay()] + ' ' + ('0' + d.getDate()).slice(-2) + '/' + MES3[d.getMonth()] +
      ' · ' + (t.parte === 'diurno' ? 'diurno' : 'noturno');
  }

  function tile(rotulo, valor, sub, modulo) {
    var el = App.h('button', { class: 'rs-tile', onclick: modulo ? function () { App.abrirModulo(modulo); } : null }, [
      App.h('span', { class: 'rs-rot', text: rotulo }),
      App.h('span', { class: 'rs-val', html: valor }),
      sub ? App.h('span', { class: 'rs-sub', text: sub }) : null
    ]);
    return el;
  }

  function renderHome() {
    var S = root.Store;
    var lider = S.ehLider();
    var modoBanco = root.Sync && Sync.modo === 'db';
    var eu = (modoBanco && Sync.eu ? Sync.eu() : null) ||
      (S.papelAtual().tipo === 'funcionario' ? S.funcionarioPorNome(S.papelAtual().nome) : null);
    var nome = eu ? eu.nome_curto : 'Líder';

    // saudação + foto
    $('home-nome').textContent = 'Olá, ' + nome + ' — ' + saudacao();
    var subs = [];
    if (eu) subs.push({ investigador: 'Investigador', delegado: 'Delegado', diretor: 'Diretor', administrador: 'Administrador' }[eu.cargo] || eu.cargo);
    if (eu && eu.plantao) subs.push(eu.plantao);
    if (lider) subs.push('líder');
    $('home-papel').textContent = subs.join(' · ');
    var fb = $('home-foto');
    fb.innerHTML = (eu && eu.foto) ? '<img src="' + eu.foto + '">' : (nome.charAt(0));
    fb.className = 'home-foto' + ((eu && eu.foto) ? '' : ' vazia');

    // comunicado
    var com = $('home-comunicado');
    var txt = S.config('comunicado') || '';
    com.innerHTML = '';
    if (txt || lider) {
      var box = App.h('div', { class: 'comunicado' + (txt ? '' : ' vazio') });
      box.innerHTML = '<div class="comunicado-tit">Comunicado' +
        (lider ? ' <button class="link" id="comEdit">editar</button>' : '') + '</div>' +
        '<div class="comunicado-txt">' + (txt ? App.esc(txt).replace(/\n/g, '<br>') : '<i>sem comunicado</i>') + '</div>';
      com.appendChild(box);
      var be = box.querySelector('#comEdit');
      if (be) be.addEventListener('click', function () { editarComunicado(txt); });
    }

    // resumo (só se for uma pessoa)
    var rs = $('home-resumo');
    rs.innerHTML = '';
    if (eu) {
      var sf = S.saldoFerias(nome);
      var contas = S.contasDe(nome);
      var credito = 0, debito = 0;
      contas.forEach(function (c) { if (c.saldo > 0) debito += c.saldo; else credito += -c.saldo; });
      var pt = proximoTurno(eu);
      rs.appendChild(App.h('div', { class: 'home-sec-tit', text: 'Resumo' }));
      var grid = App.h('div', { class: 'rs-grid' }, [
        tile('Férias', sf.restante + '<small> dias</small>', sf.consumido + ' marcados', 'ferias'),
        tile('Permutas', '<span class="pos">+' + credito + '</span> / <span class="neg">−' + debito + '</span>', 'crédito / débito (h)', 'permuta'),
        tile('Banco de horas', (S.saldoDe(nome)) + '<small> h</small>', null, 'banco'),
        tile('Próximo plantão', pt ? pt.split(' · ')[0] : '—', pt ? pt.split(' · ')[1] : (eu.plantao ? '' : 'sem plantão'), 'escala')
      ]);
      rs.appendChild(grid);
    }

    // módulos — barra de ícones no rodapé
    var bar = $('mod-launcher');
    bar.innerHTML = '';
    Object.keys(telas).forEach(function (n) {
      var t = telas[n];
      if (t.acesso === 'lider' && !lider) return;
      var badge = t.contador ? t.contador() : null;
      bar.appendChild(App.h('button', { class: 'ml-item', onclick: function () { App.abrirModulo(n); } }, [
        App.h('span', { class: 'ml-ic', text: t.icone }),
        App.h('span', { class: 'ml-nome', text: t.titulo }),
        (badge ? App.h('span', { class: 'ml-badge', text: String(badge) }) : null)
      ]));
    });
  }

  function editarComunicado(atual) {
    var m = App.abrirModal('<h2>Comunicado</h2>' +
      '<div class="campo"><label>Mensagem para todos (deixe vazio para remover)</label>' +
      '<textarea id="com-t" rows="5"></textarea></div>' +
      '<div class="modal-acoes"><button class="btn sec" id="com-x">Cancelar</button><button class="btn" id="com-ok">Salvar</button></div>');
    m.querySelector('#com-t').value = atual || '';
    m.querySelector('#com-x').addEventListener('click', App.fecharModal);
    m.querySelector('#com-ok').addEventListener('click', function () {
      Promise.resolve(root.Store.setConfig('comunicado', m.querySelector('#com-t').value.trim()))
        .then(function () { App.fecharModal(); renderHome(); App.toast('Comunicado salvo', 'sucesso'); });
    });
  }

  // ─── LOGIN ───────────────────────────────────────────────────────────────
  function ligarLogin() {
    var f = $('form-login');
    if (!root.DB || !DB.configurado) {
      $('lg-semcfg').hidden = false;
      // modo local (sem Supabase): entra direto
      $('lg-btn').textContent = 'Entrar (modo local)';
      f.addEventListener('submit', function (e) { e.preventDefault(); iniciar(); });
      return;
    }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      $('lg-erro').hidden = true; $('lg-btn').disabled = true;
      DB.entrar($('lg-email').value.trim(), $('lg-senha').value)
        .then(function () { iniciar(); })
        .catch(function (err) {
          $('lg-erro').textContent = /Invalid login/i.test(err.message || '') ? 'E-mail ou senha inválidos.' : (err.message || String(err));
          $('lg-erro').hidden = false; $('lg-btn').disabled = false;
        });
    });
  }

  // ─── BOOTSTRAP ───────────────────────────────────────────────────────────
  function iniciar() {
    App.loading(true);
    var p = (root.Sync && Sync.iniciar) ? Sync.iniciar() : Promise.resolve({ logado: true, modo: 'local' });
    p.then(function (r) {
      App.loading(false);
      if (r && r.logado === false) { App.mostrarTela('tela-login'); return; }
      if (root.Store) Store.onErro = function (m) { App.toast(m, 'erro'); };
      renderHome();
      App.mostrarTela('tela-home');
      if (r && r.semVinculo) App.toast('Seu login não está ligado a um funcionário. Peça ao líder.', 'erro');
      if (r && r.modo === 'offline') App.toast('Sem conexão — última cópia local.', '');
    }).catch(function (e) {
      App.loading(false);
      App.mostrarTela('tela-login');
      $('lg-erro').textContent = 'Erro: ' + (e.message || e); $('lg-erro').hidden = false;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    ligarLogin();
    $('mod-back').addEventListener('click', App.voltarHome);
    $('home-sair').addEventListener('click', function () {
      (root.Sync && Sync.sair ? Sync.sair() : Promise.resolve()).then(function () { location.reload(); });
    });
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) App.fecharModal(); });

    // PWA — registra e recarrega uma vez quando um SW novo assume
    if ('serviceWorker' in navigator) {
      var recarregou = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (recarregou) return; recarregou = true; location.reload();
      });
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        if (reg.waiting) reg.waiting.postMessage('skip');
        reg.addEventListener('updatefound', function () {
          var sw = reg.installing;
          if (sw) sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) sw.postMessage('skip');
          });
        });
      }).catch(function () {});
    }
    var deferido = null;
    function instalar() {
      if (!deferido) return;
      deferido.prompt();
      deferido.userChoice.then(function () {
        deferido = null;
        ['btn-instalar', 'btn-instalar2'].forEach(function (id) { var b = $(id); if (b) b.classList.remove('on'); });
      });
    }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferido = e;
      ['btn-instalar', 'btn-instalar2'].forEach(function (id) { var b = $(id); if (b) b.classList.add('on'); });
    });
    ['btn-instalar', 'btn-instalar2'].forEach(function (id) { var b = $(id); if (b) b.addEventListener('click', instalar); });

    // já logado? (sessão persistida) → entra direto
    if (root.DB && DB.configurado) {
      DB.sessao().then(function (s) { if (s) iniciar(); });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
