/* telas/config.js — parâmetros da rotação/banco + backup (só líder) */
(function () {
  'use strict';
  var S = window.Store, A = window.App;

  var CAMPOS = [
    ['ancora_rotacao', 'Âncora da rotação', 'date'],
    ['ordem_rotacao', 'Ordem de entrada no ciclo (separar por ;)', 'text'],
    ['mult_folga_perdida', 'Multiplicador da folga perdida', 'number'],
    ['fator_convocacao', 'Fator das horas em convocação', 'number'],
    ['credito_sobreaviso', 'Crédito de sobreaviso não acionado (por hora)', 'number'],
    ['dias_ferias_padrao', 'Dias de férias por ano (padrão)', 'number'],
    ['antecedencia_ferias_dias', 'Antecedência mínima p/ comunicar férias (dias)', 'number'],
    ['permuta_prazo_horas', 'Prazo da permuta antes do turno (horas)', 'number']
  ];

  function montar(corpo) {
    if (!S.ehLider()) { corpo.innerHTML = '<div class="vazio"><div class="ic">🔒</div><div class="txt">Tela do líder.</div></div>'; return; }
    var modoBanco = window.Sync && Sync.modo === 'db';
    var cfg = S.configTodos();

    var card = A.h('div', { class: 'card' });
    card.innerHTML = '<h3>Parâmetros</h3><div class="form">' +
      CAMPOS.map(function (c) {
        return '<div class="campo' + (c[0] === 'ordem_rotacao' ? ' wide' : '') + '"><label>' + c[1] + '</label>' +
          '<input type="' + c[2] + '" id="cf-' + c[0] + '" value="' + A.esc(cfg[c[0]]) + '"' + (c[2] === 'number' ? ' step="0.25"' : '') + '></div>';
      }).join('') +
      '</div><div class="card-acoes"><button class="pri" id="cf-salvar">Salvar parâmetros</button><span class="ok-msg" id="cf-msg"></span></div>';
    corpo.appendChild(card);

    var bkp = A.h('div', { class: 'card' });
    bkp.innerHTML = '<h3>Backup</h3>' +
      '<div class="card-acoes"><button class="pri" id="cf-exp">Baixar backup (JSON)</button>' +
      '<label class="btn pequeno sec" style="display:inline-block">Restaurar…<input type="file" id="cf-imp" accept="application/json" hidden></label></div>' +
      '<textarea class="in" id="cf-dump" rows="6" readonly style="margin-top:10px;font-family:var(--mono);font-size:11px"></textarea>' +
      '<p class="muted small">' + (modoBanco ? 'Modo Supabase: o backup é a foto atual do banco.' : 'Modo local: dados só neste navegador.') + '</p>';
    corpo.appendChild(bkp);

    var $ = function (s) { return corpo.querySelector(s); };
    $('#cf-salvar').addEventListener('click', function () {
      CAMPOS.forEach(function (c) { S.setConfig(c[0], $('#cf-' + c[0]).value); });
      $('#cf-msg').textContent = 'Parâmetros salvos.';
      A.toast('Parâmetros salvos', 'sucesso');
      setTimeout(function () { $('#cf-msg').textContent = ''; }, 3000);
    });
    $('#cf-exp').addEventListener('click', function () {
      var txt = S.exportar();
      $('#cf-dump').value = txt;
      try {
        var b = new Blob([txt], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = 'plantao-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
      } catch (e) {}
    });
    $('#cf-imp').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { Promise.resolve(S.importar(fr.result)).then(function () { A.toast('Backup restaurado', 'sucesso'); A.abrirModulo('config'); }); }
        catch (err) { A.toast('Arquivo inválido: ' + err.message, 'erro'); }
      };
      fr.readAsText(file);
    });
  }

  A.registrarTela('config', { titulo: 'CONFIG / DADOS', icone: '⚙️', desc: 'Parâmetros e backup', acesso: 'lider', montar: montar });
})();
