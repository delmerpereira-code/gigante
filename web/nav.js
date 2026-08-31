/* ============================================================================
 *  nav.js — Navegação + "Ver como" + Sair.
 *  Cada página tem <div id="nav"></div> e define <body data-page="...">.
 *  Espera o evento 'dados-prontos' (disparado por boot.js).
 * ==========================================================================*/
(function () {
  'use strict';

  var PAGINAS = [
    { id: 'calendario',   href: 'calendario.html',   rotulo: 'Calendário',    acesso: 'todos' },
    { id: 'escala',       href: 'index.html',        rotulo: 'Escala',        acesso: 'todos' },
    { id: 'ferias',       href: 'ferias.html',       rotulo: 'Férias',        acesso: 'todos' },
    { id: 'permuta',      href: 'permuta.html',      rotulo: 'Permuta',       acesso: 'todos' },
    { id: 'eventos',      href: 'eventos.html',      rotulo: 'Eventos',       acesso: 'todos' },
    { id: 'banco',        href: 'banco.html',        rotulo: 'Banco de horas', acesso: 'todos' },
    { id: 'meu-cadastro', href: 'meu-cadastro.html', rotulo: 'Meu cadastro',  acesso: 'todos' },
    { id: 'cadastro',     href: 'cadastro.html',     rotulo: 'Funcionários',  acesso: 'lider' },
    { id: 'dados',        href: 'dados.html',        rotulo: 'Config / Dados', acesso: 'lider' }
  ];

  document.addEventListener('dados-prontos', function () {
    var alvo = document.getElementById('nav');
    if (!alvo || !window.Store) return;
    var atual = document.body.getAttribute('data-page');
    var lider = Store.ehLider();
    var modoBanco = window.Sync && Sync.modo === 'db';
    var eu = modoBanco && Sync.eu ? Sync.eu() : null;

    var links = PAGINAS
      .filter(function (p) { return p.acesso === 'todos' || lider; })
      .map(function (p) {
        return '<a href="' + p.href + '"' + (p.id === atual ? ' class="on"' : '') + '>' + p.rotulo + '</a>';
      }).join('');

    var direita;
    if (modoBanco) {
      // no banco o papel é o do login; "Ver como" só para o líder (teste)
      var quem = eu ? eu.nome_curto : 'login sem vínculo';
      if (lider) {
        var pessoas = Store.funcionarios().slice()
          .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
        var opts = '<option value="Lider">Líder (você)</option>' +
          pessoas.map(function (f) {
            var reg = f.regime === 'coringa' ? 'coringa' : (f.plantao || '—');
            return '<option value="' + f.nome_curto + '">' + f.nome_curto + ' · ' + reg + '</option>';
          }).join('');
        direita = '<label class="ver-como">Ver como <select id="verComoSel">' + opts + '</select></label>';
      } else {
        direita = '<span class="ver-como">' + quem + '</span>';
      }
      direita += ' <button class="link" id="btnSair">sair</button>';
    } else {
      var ps = Store.funcionarios().slice()
        .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
      var o = '<option value="Lider">Líder (vê tudo)</option>' +
        ps.map(function (f) {
          var reg = f.regime === 'coringa' ? 'coringa' : (f.plantao || (f.lider === 'sim' ? 'líder' : '—'));
          return '<option value="' + f.nome_curto + '">' + f.nome_curto + ' · ' + reg + '</option>';
        }).join('');
      direita = '<label class="ver-como">Ver como <select id="verComoSel">' + o + '</select></label>';
    }

    alvo.className = 'nav';
    alvo.innerHTML = '<div class="nav-links">' + links + '</div>' + direita;

    var sel = document.getElementById('verComoSel');
    if (sel) {
      sel.value = Store.verComo() || 'Lider';
      sel.addEventListener('change', function () { Store.setVerComo(sel.value); location.reload(); });
    }
    var sair = document.getElementById('btnSair');
    if (sair) sair.addEventListener('click', function () {
      Sync.sair().then(function () { location.replace('login.html'); });
    });
  });
})();
