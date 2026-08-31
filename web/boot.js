/* ============================================================================
 *  boot.js — Arranque comum. Carregar por ÚLTIMO (depois de sync.js e nav.js).
 *  Roda Sync.iniciar(); se não estiver logado (modo banco), manda para o login.
 *  Quando os dados estão prontos, dispara o evento 'dados-prontos' — cada tela
 *  escuta esse evento no lugar de 'DOMContentLoaded'.
 * ==========================================================================*/
(function () {
  'use strict';

  function banner(msg, cor) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="boot-msg" style="background:' + (cor || '#fdecec') + ';color:#7a1c15;' +
      'padding:8px 14px;font-size:.85rem">' + msg + '</div>');
  }

  function arrancar() {
    if (window.Store) Store.onErro = function (m) { banner(m); };
    var iniciar = (window.Sync && window.Sync.iniciar)
      ? window.Sync.iniciar() : Promise.resolve({ logado: true, modo: 'local' });

    iniciar.then(function (r) {
      if (r && r.logado === false) { location.replace('login.html'); return; }
      if (r && r.semVinculo) banner('Seu login ainda não está ligado a um funcionário. Peça ao Líder para vincular sua matrícula.');
      if (r && r.modo === 'offline') banner('Sem conexão com o servidor — mostrando a última cópia local.', '#fff6e0');
      window.__dados = r;
      document.dispatchEvent(new CustomEvent('dados-prontos', { detail: r }));
    }).catch(function (e) {
      banner('Erro ao carregar: ' + (e.message || e));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
