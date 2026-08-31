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
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
      }
      (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
      return e;
    },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  };
  root.App = App;

  // ─── HOME ────────────────────────────────────────────────────────────────
  function renderHome() {
    var S = root.Store;
    var papel = S.papelAtual();
    var lider = S.ehLider();
    var modoBanco = root.Sync && Sync.modo === 'db';
    var eu = modoBanco && Sync.eu ? Sync.eu() : null;

    $('home-nome').textContent = eu ? eu.nome_curto : (papel.tipo === 'lider' ? 'Líder' : papel.nome);
    var subs = [];
    if (eu) subs.push({ investigador: 'Investigador', delegado: 'Delegado', diretor: 'Diretor' }[eu.cargo] || eu.cargo);
    if (lider) subs.push('acesso de líder');
    $('home-papel').textContent = subs.join(' · ');

    var wrap = $('home-cards');
    wrap.innerHTML = '';

    // "Ver como" — só líder
    if (lider) {
      var pessoas = S.funcionarios().slice().sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
      var sel = App.h('select', { class: 'in', style: 'margin-bottom:6px' }, []);
      sel.innerHTML = '<option value="Lider">Ver como: Líder</option>' +
        pessoas.map(function (f) { return '<option value="' + App.esc(f.nome_curto) + '">Ver como: ' + App.esc(f.nome_curto) + '</option>'; }).join('');
      sel.value = S.verComo() || 'Lider';
      sel.addEventListener('change', function () { S.setVerComo(sel.value); renderHome(); });
      wrap.appendChild(sel);
    }

    Object.keys(telas).forEach(function (nome) {
      var t = telas[nome];
      if (t.acesso === 'lider' && !lider) return;
      var n = t.contador ? t.contador() : null;
      var card = App.h('button', { class: 'mod-card', onclick: function () { App.abrirModulo(nome); } }, [
        App.h('span', { class: 'ic', text: t.icone }),
        App.h('span', {}, [
          App.h('span', { class: 'nome', text: t.titulo }),
          App.h('span', { class: 'desc', text: t.desc })
        ]),
        (n ? App.h('span', { class: 'badge-n', text: String(n) }) : null)
      ]);
      wrap.appendChild(card);
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
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferido = e; $('btn-instalar').classList.add('on');
    });
    $('btn-instalar').addEventListener('click', function () {
      if (!deferido) return;
      deferido.prompt();
      deferido.userChoice.then(function () { deferido = null; $('btn-instalar').classList.remove('on'); });
    });

    // já logado? (sessão persistida) → entra direto
    if (root.DB && DB.configurado) {
      DB.sessao().then(function (s) { if (s) iniciar(); });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
